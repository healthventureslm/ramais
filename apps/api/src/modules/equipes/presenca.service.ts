import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Sessao as SessaoApi } from '@ramais/contracts';
import { resolverCodigoDispositivo, resolverLogin } from '@ramais/db';
import type pg from 'pg';
import { Tokens, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { POOL } from '../../infra/tokens.js';
import { Acoes } from '../solicitacoes/acoes.js';

const MAX_FALHAS_PIN = 5;
const BLOQUEIO_MIN = 5;
const HASH_FALSO = bcrypt.hashSync('sem-usuario', 10);

export function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

/**
 * Presença: entrar no app é entrar no turno. Não é registro de ponto (que é regulamentado):
 * serve só para a distribuição saber quem pode receber agora.
 */
@Injectable()
export class Presencas {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly tokens: Tokens,
  ) {}

  // ---------- Login web ----------

  async loginWeb(email: string, senha: string): Promise<SessaoApi> {
    const l = await resolverLogin(this.pool, email);
    // Mesmo custo com ou sem usuário, para não revelar quem existe.
    if (!l) {
      await bcrypt.compare(senha, HASH_FALSO);
      throw new UnauthorizedException('e-mail ou senha incorretos');
    }
    const pessoa = await this.nucleo.executar(l.orgId, async (c) =>
      (await c.tx.client.query('SELECT id, senha_hash FROM pessoa WHERE id = $1 AND ativo', [l.pessoaId])).rows[0],
    );
    if (!pessoa?.senha_hash || !(await bcrypt.compare(senha, pessoa.senha_hash))) {
      throw new UnauthorizedException('e-mail ou senha incorretos');
    }
    const token = await this.tokens.assinar({
      tipo: 'web',
      orgId: l.orgId,
      pessoaId: l.pessoaId,
      dispositivoId: null,
      unidadeId: null,
      presencaId: null,
    });
    return this.sessaoApi(l.orgId, l.pessoaId, token);
  }

  async sessaoApi(orgId: string, pessoaId: string, token: string): Promise<SessaoApi> {
    return this.nucleo.executar(orgId, async (c) => {
      const p = (await c.tx.client.query('SELECT id, nome, email, admin, gerente, trocar_senha FROM pessoa WHERE id = $1', [pessoaId])).rows[0];
      // Admin e gerente enxergam todas as unidades da organização.
      const todas = p.admin || p.gerente;
      const setores = await c.tx.client.query(
        `SELECT s.id, s.nome, s.chave, s.unidade_id, l.papel FROM lotacao l JOIN setor s ON s.id = l.setor_id
          WHERE l.pessoa_id = $1 AND s.ativo ORDER BY s.nome`,
        [pessoaId],
      );
      const unidades = await c.tx.client.query(
        todas
          ? 'SELECT id, nome FROM unidade ORDER BY nome'
          : `SELECT DISTINCT u.id, u.nome FROM unidade u JOIN setor s ON s.unidade_id = u.id
              JOIN lotacao l ON l.setor_id = s.id WHERE l.pessoa_id = $1 ORDER BY u.nome`,
        todas ? [] : [pessoaId],
      );
      return {
        token,
        orgId,
        pessoa: { id: p.id, nome: p.nome, email: p.email, admin: p.admin, gerente: p.gerente, trocarSenha: p.trocar_senha },
        unidades: unidades.rows,
        setores: setores.rows.map((s) => ({ id: s.id, nome: s.nome, chave: s.chave, unidadeId: s.unidade_id, papel: s.papel })),
      };
    });
  }

  /** Troca da própria senha (obrigatória no primeiro acesso de quem recebeu senha temporária). */
  async trocarSenha(s: Sessao, atual: string, nova: string): Promise<void> {
    if (!s.pessoaId) throw new ForbiddenException();
    await this.nucleo.executar(s.orgId, async (c) => {
      const p = (await c.tx.client.query('SELECT senha_hash FROM pessoa WHERE id = $1', [s.pessoaId])).rows[0];
      if (!p?.senha_hash || !(await bcrypt.compare(atual, p.senha_hash))) throw new BadRequestException('senha atual incorreta');
      if (await bcrypt.compare(nova, p.senha_hash)) throw new ConflictException('a nova senha precisa ser diferente da atual');
      await c.tx.client.query('UPDATE pessoa SET senha_hash = $2, trocar_senha = false WHERE id = $1', [s.pessoaId, await bcrypt.hash(nova, 10)]);
      await this.nucleo.evento(c, { tipo: 'senha_trocada', atorTipo: 'pessoa', atorId: s.pessoaId });
    });
  }

  // ---------- Dispositivos ----------

  /** Admin gera um código de uso único (mostrado como QR) para cadastrar um celular do setor. */
  async gerarCodigoDispositivo(c: Ctx, unidadeId: string, nome: string): Promise<{ dispositivoId: string; codigo: string; expiraEm: Date }> {
    const codigo = randomBytes(9).toString('base64url');
    const expiraEm = new Date(Date.now() + 30 * 60_000);
    const r = await c.tx.client.query<{ id: string }>(
      `INSERT INTO dispositivo (org_id, unidade_id, nome, codigo_cadastro_hash, codigo_expira_em)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [c.tx.orgId, unidadeId, nome, hashCodigo(codigo), expiraEm],
    );
    return { dispositivoId: r.rows[0]!.id, codigo, expiraEm };
  }

  async cadastrarDispositivo(codigo: string, nome: string, plataforma: 'android' | 'ios'): Promise<{ token: string; unidadeId: string }> {
    const d = await resolverCodigoDispositivo(this.pool, hashCodigo(codigo));
    if (!d) throw new UnauthorizedException('código inválido ou expirado');
    await this.nucleo.executar(d.orgId, (c) =>
      c.tx.client.query(
        `UPDATE dispositivo SET nome = $2, plataforma = $3, cadastrado_em = now(), codigo_cadastro_hash = NULL, codigo_expira_em = NULL
          WHERE id = $1`,
        [d.dispositivoId, nome, plataforma],
      ),
    );
    const token = await this.tokens.assinar({
      tipo: 'dispositivo',
      orgId: d.orgId,
      pessoaId: null,
      dispositivoId: d.dispositivoId,
      unidadeId: d.unidadeId,
      presencaId: null,
    });
    return { token, unidadeId: d.unidadeId };
  }

  // ---------- Turno ----------

  /** Entrar no app é entrar no turno: PIN de 6 dígitos no celular cadastrado. */
  async entrarNoApp(disp: Sessao, email: string, pin: string, pushToken?: string): Promise<SessaoApi> {
    const l = await resolverLogin(this.pool, email);
    if (!l || l.orgId !== disp.orgId || !disp.dispositivoId || !disp.unidadeId) {
      throw new UnauthorizedException('e-mail ou PIN incorretos');
    }
    const presencaId = await this.nucleo.executar(disp.orgId, async (c) => {
      const p = (
        await c.tx.client.query('SELECT pin_hash, pin_falhas, pin_bloqueado_ate FROM pessoa WHERE id = $1 AND ativo FOR UPDATE', [l.pessoaId])
      ).rows[0];
      const d = (await c.tx.client.query('SELECT ativo FROM dispositivo WHERE id = $1', [disp.dispositivoId])).rows[0];
      if (!d?.ativo) throw new ForbiddenException('dispositivo desativado');
      if (p?.pin_bloqueado_ate && new Date(p.pin_bloqueado_ate) > new Date()) {
        throw new ForbiddenException('PIN bloqueado temporariamente por tentativas erradas');
      }
      if (!p?.pin_hash || !(await bcrypt.compare(pin, p.pin_hash))) {
        // A falha é gravada (a transação confirma), então o contador sobrevive ao erro.
        const falhas = (p?.pin_falhas ?? 0) + 1;
        const bloquear = falhas >= MAX_FALHAS_PIN;
        await c.tx.client.query(
          `UPDATE pessoa SET pin_falhas = $2,
                  pin_bloqueado_ate = CASE WHEN $3::boolean THEN now() + make_interval(mins => $4) ELSE NULL END
            WHERE id = $1`,
          [l.pessoaId, bloquear ? 0 : falhas, bloquear, BLOQUEIO_MIN],
        );
        return null;
      }
      await c.tx.client.query('UPDATE pessoa SET pin_falhas = 0, pin_bloqueado_ate = NULL WHERE id = $1', [l.pessoaId]);
      // O token de push do celular passa a ser desta pessoa (e deixa de ser de quem estava antes).
      await c.tx.client.query('UPDATE dispositivo SET pessoa_id = $2, push_token = coalesce($3, push_token) WHERE id = $1', [
        disp.dispositivoId,
        l.pessoaId,
        pushToken ?? null,
      ]);
      return this.abrirPresenca(c, l.pessoaId, disp.unidadeId!, disp.dispositivoId);
    });
    if (!presencaId) throw new UnauthorizedException('e-mail ou PIN incorretos');
    const token = await this.tokens.assinar({
      tipo: 'turno',
      orgId: disp.orgId,
      pessoaId: l.pessoaId,
      dispositivoId: disp.dispositivoId,
      unidadeId: disp.unidadeId,
      presencaId,
    });
    return this.sessaoApi(disp.orgId, l.pessoaId, token);
  }

  /** Na web (recepção, supervisão), entrar no turno é um botão. */
  async entrarNaWeb(s: Sessao, unidadeId: string): Promise<{ presencaId: string }> {
    const presencaId = await this.nucleo.executar(s.orgId, (c) => this.abrirPresenca(c, s.pessoaId!, unidadeId, null));
    return { presencaId };
  }

  private async abrirPresenca(c: Ctx, pessoaId: string, unidadeId: string, dispositivoId: string | null): Promise<string> {
    // Uma presença aberta por pessoa: entrar em outro aparelho fecha a anterior.
    await c.tx.client.query(
      `UPDATE presenca SET fim = now(), motivo_fim = 'nova_entrada' WHERE pessoa_id = $1 AND fim IS NULL`,
      [pessoaId],
    );
    const r = await c.tx.client.query<{ id: string }>(
      'INSERT INTO presenca (org_id, unidade_id, pessoa_id, dispositivo_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [c.tx.orgId, unidadeId, pessoaId, dispositivoId],
    );
    await this.nucleo.evento(c, { tipo: 'entrou_turno', atorTipo: 'pessoa', atorId: pessoaId, dados: { unidadeId, dispositivoId } });
    // A fila dos setores dessa pessoa pode andar.
    const setores = await c.tx.client.query<{ setor_id: string }>(
      'SELECT l.setor_id FROM lotacao l JOIN setor s ON s.id = l.setor_id WHERE l.pessoa_id = $1 AND s.unidade_id = $2',
      [pessoaId, unidadeId],
    );
    for (const s of setores.rows) await this.nucleo.distribuir(c, s.setor_id);
    return r.rows[0]!.id;
  }

  /**
   * Sair encerra a presença, devolve ou transfere as conversas abertas e desvincula o
   * token de notificação da pessoa: um celular de quem saiu não recebe nada.
   */
  async sair(s: Sessao, conversas: 'devolver_fila' | 'transferir', transferirPara?: string, motivo = 'saida'): Promise<void> {
    if (!s.pessoaId) return;
    await this.nucleo.executar(s.orgId, (c) => this.encerrar(c, s.pessoaId!, conversas, transferirPara, motivo));
  }

  async encerrar(c: Ctx, pessoaId: string, conversas: 'devolver_fila' | 'transferir', transferirPara: string | undefined, motivo: string) {
    const fechou = await c.tx.client.query(
      `UPDATE presenca SET fim = now(), motivo_fim = $2 WHERE pessoa_id = $1 AND fim IS NULL RETURNING id`,
      [pessoaId, motivo],
    );
    await c.tx.client.query('UPDATE dispositivo SET pessoa_id = NULL, push_token = NULL WHERE pessoa_id = $1', [pessoaId]);
    // Ofertas pendentes voltam para a fila.
    const ofertas = await c.tx.client.query<{ id: string; solicitacao_id: string }>(
      `UPDATE oferta SET resultado = 'cancelada', respondida_em = now() WHERE pessoa_id = $1 AND resultado = 'pendente'
        RETURNING id, solicitacao_id`,
      [pessoaId],
    );
    for (const o of ofertas.rows) {
      const sol = await this.acoes.carregar(c, o.solicitacao_id);
      if (sol.estado === 'oferecida') {
        const nova = await this.acoes.transicionar(c, sol, 'expirar_oferta');
        if (nova.setor_id) await this.nucleo.distribuir(c, nova.setor_id);
      }
    }
    const abertas = await c.tx.client.query<{ id: string }>(
      `SELECT id FROM solicitacao WHERE responsavel_id = $1 AND estado IN ('em_atendimento', 'aguardando_solicitante')`,
      [pessoaId],
    );
    for (const { id } of abertas.rows) {
      const sol = await this.acoes.carregar(c, id);
      if (conversas === 'transferir' && transferirPara) {
        const ok = await c.tx.client.query('SELECT 1 FROM presenca WHERE pessoa_id = $1 AND fim IS NULL', [transferirPara]);
        if (!ok.rowCount) throw new ConflictException('a pessoa escolhida não está no turno');
        await this.acoes.atualizar(c, sol, { responsavel_id: transferirPara, responsavel_anterior_id: pessoaId });
        await this.acoes.notaInterna(c, id, 'Conversa transferida na saída do turno.', { tipo: 'pessoa', id: pessoaId });
      } else if (sol.setor_id) {
        await this.acoes.colocarNaFila(c, sol, sol.setor_id, { ator: { tipo: 'pessoa', id: pessoaId }, motivo: 'saida_turno' });
      }
    }
    if (fechou.rowCount) await this.nucleo.evento(c, { tipo: 'saiu_turno', atorTipo: 'pessoa', atorId: pessoaId, dados: { motivo } });
  }

  /** Atividade no app mantém a presença viva (com folga, para não escrever a cada requisição). */
  async batimento(s: Sessao): Promise<void> {
    if (!s.presencaId) return;
    await this.nucleo.executar(s.orgId, (c) =>
      c.tx.client.query(
        `UPDATE presenca SET ultima_atividade = now() WHERE id = $1 AND fim IS NULL AND ultima_atividade < now() - interval '1 minute'`,
        [s.presencaId],
      ),
    );
  }

  async atualizarPushToken(s: Sessao, token: string): Promise<void> {
    if (!s.dispositivoId) throw new ForbiddenException();
    await this.nucleo.executar(s.orgId, (c) =>
      c.tx.client.query('UPDATE dispositivo SET push_token = $2 WHERE id = $1 AND pessoa_id = $3', [s.dispositivoId, token, s.pessoaId]),
    );
  }
}
