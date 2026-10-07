import { randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Presencas } from '../equipes/presenca.service.js';
import { exigirAdmin } from './guarda.js';

const Lotacao = z.object({
  setorId: z.uuid(),
  papel: z.enum(['membro', 'supervisor']).default('membro'),
  recebe: z.enum(['sempre', 'ultimo_recurso', 'nunca']).default('sempre'),
  limiteCarga: z.number().int().min(1).max(50).default(5),
});

const PessoaReq = z.object({
  /** As lotações editadas são as desta unidade; as de outras unidades da rede ficam como estão. */
  unidadeId: z.uuid(),
  nome: z.string().trim().min(2).max(120),
  email: z.email(),
  idiomas: z.array(z.string().min(2).max(5)).min(1).default(['pt']),
  admin: z.boolean().default(false),
  gerente: z.boolean().default(false),
  lotacoes: z.array(Lotacao).default([]),
});
type PessoaReq = z.infer<typeof PessoaReq>;

const PessoaAtualizar = PessoaReq.omit({ email: true }).extend({ ativo: z.boolean().default(true) });
type PessoaAtualizar = z.infer<typeof PessoaAtualizar>;

/** Senha temporária legível (sem caracteres ambíguos) e PIN de 6 dígitos. */
function senhaTemporaria(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = randomBytes(12);
  return Array.from(b, (x) => alfabeto[x % alfabeto.length]).join('');
}
const pin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Gestão da equipe pela tela: pessoas, lotações nos setores, senha temporária e PIN.
 * Senha e PIN novos aparecem uma vez só, para o admin repassar; a pessoa troca a senha
 * no primeiro acesso.
 */
@Controller('admin/pessoas')
export class EquipeController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly presencas: Presencas,
  ) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await exigirAdmin(c, s);
      const r = await c.tx.client.query(
        `SELECT p.id, p.nome, p.email, p.idiomas, p.admin, p.gerente, p.ativo, p.trocar_senha, p.pin_hash IS NOT NULL AS tem_pin,
                p.pin_bloqueado_ate > now() AS pin_bloqueado,
                EXISTS (SELECT 1 FROM presenca pr WHERE pr.pessoa_id = p.id AND pr.fim IS NULL) AS em_turno,
                coalesce((SELECT json_agg(json_build_object('setorId', l.setor_id, 'papel', l.papel, 'recebe', l.recebe, 'limiteCarga', l.limite_carga))
                            FROM lotacao l JOIN setor st ON st.id = l.setor_id
                           WHERE l.pessoa_id = p.id AND st.unidade_id = $1), '[]') AS lotacoes
           FROM pessoa p
          WHERE p.admin OR p.gerente OR EXISTS (SELECT 1 FROM lotacao l JOIN setor st ON st.id = l.setor_id WHERE l.pessoa_id = p.id AND st.unidade_id = $1)
             OR NOT EXISTS (SELECT 1 FROM lotacao l WHERE l.pessoa_id = p.id)
          ORDER BY p.ativo DESC, p.nome`,
        [unidadeId],
      );
      return r.rows.map((l) => ({
        id: l.id,
        nome: l.nome,
        email: l.email,
        idiomas: l.idiomas,
        admin: l.admin,
        gerente: l.gerente,
        ativo: l.ativo,
        trocarSenha: l.trocar_senha,
        temPin: l.tem_pin,
        pinBloqueado: Boolean(l.pin_bloqueado),
        emTurno: l.em_turno,
        lotacoes: l.lotacoes,
      }));
    });
  }

  @Post()
  @HttpCode(201)
  criar(@SessaoAtual() s: Sessao, @Body(new Zod(PessoaReq)) b: PessoaReq) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const adminId = await exigirAdmin(c, s);
      const senha = senhaTemporaria();
      const novoPin = pin();
      let id: string;
      try {
        // Savepoint: um e-mail repetido não derruba a transação inteira.
        await c.tx.client.query('SAVEPOINT nova_pessoa');
        const r = await c.tx.client.query<{ id: string }>(
          `INSERT INTO pessoa (org_id, nome, email, senha_hash, pin_hash, idiomas, admin, gerente, trocar_senha, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9) RETURNING id`,
          [s.orgId, b.nome, b.email.toLowerCase(), await bcrypt.hash(senha, 10), await bcrypt.hash(novoPin, 10), b.idiomas, b.admin, b.gerente, adminId],
        );
        id = r.rows[0]!.id;
      } catch (e) {
        await c.tx.client.query('ROLLBACK TO SAVEPOINT nova_pessoa');
        // O e-mail é único no sistema todo (o login acha a organização por ele).
        if ((e as { code?: string }).code === '23505') throw new ConflictException('já existe uma pessoa com este e-mail');
        throw e;
      }
      await this.gravarLotacoes(c, id, b.unidadeId, b.lotacoes);
      await this.nucleo.evento(c, { tipo: 'pessoa_criada', atorTipo: 'pessoa', atorId: adminId, dados: { pessoaId: id } });
      return { id, senhaTemporaria: senha, pin: novoPin };
    });
  }

  @Put(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(PessoaAtualizar)) b: PessoaAtualizar) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const adminId = await exigirAdmin(c, s);
      if (id === adminId && (!b.admin || !b.ativo)) throw new BadRequestException('você não pode tirar o próprio acesso de administrador');
      const r = await c.tx.client.query<{ ativo: boolean }>('SELECT ativo FROM pessoa WHERE id = $1', [id]);
      if (!r.rows[0]) throw new BadRequestException('pessoa não encontrada');
      await c.tx.client.query('UPDATE pessoa SET nome = $2, idiomas = $3, admin = $4, gerente = $5, ativo = $6 WHERE id = $1', [
        id,
        b.nome,
        b.idiomas,
        b.admin,
        b.gerente,
        b.ativo,
      ]);
      // Desativar tira do turno e devolve as conversas abertas para a fila.
      if (r.rows[0].ativo && !b.ativo) await this.presencas.encerrar(c, id, 'devolver_fila', undefined, 'desativada');
      await this.gravarLotacoes(c, id, b.unidadeId, b.lotacoes);
      await this.nucleo.evento(c, { tipo: 'pessoa_alterada', atorTipo: 'pessoa', atorId: adminId, dados: { pessoaId: id, ativo: b.ativo } });
      return { ok: true };
    });
  }

  /** Nova senha temporária e/ou novo PIN (também desbloqueia o PIN). Aparecem uma vez só. */
  @Post(':id/redefinir')
  @HttpCode(200)
  redefinir(
    @SessaoAtual() s: Sessao,
    @Param('id', Uuid) id: string,
    @Body(new Zod(z.object({ senha: z.boolean().default(false), pin: z.boolean().default(false) }))) b: { senha: boolean; pin: boolean },
  ) {
    if (!b.senha && !b.pin) throw new BadRequestException('escolha senha, PIN ou os dois');
    return this.nucleo.executar(s.orgId, async (c) => {
      const adminId = await exigirAdmin(c, s);
      const saida: { senhaTemporaria?: string; pin?: string } = {};
      if (b.senha) {
        saida.senhaTemporaria = senhaTemporaria();
        await c.tx.client.query('UPDATE pessoa SET senha_hash = $2, trocar_senha = true WHERE id = $1', [id, await bcrypt.hash(saida.senhaTemporaria, 10)]);
      }
      if (b.pin) {
        saida.pin = pin();
        await c.tx.client.query('UPDATE pessoa SET pin_hash = $2, pin_falhas = 0, pin_bloqueado_ate = NULL WHERE id = $1', [id, await bcrypt.hash(saida.pin, 10)]);
      }
      await this.nucleo.evento(c, { tipo: 'credencial_redefinida', atorTipo: 'pessoa', atorId: adminId, dados: { pessoaId: id, senha: b.senha, pin: b.pin } });
      return saida;
    });
  }

  /** Substitui as lotações da pessoa nos setores desta organização. */
  private async gravarLotacoes(c: Ctx, pessoaId: string, unidadeId: string, lotacoes: z.infer<typeof Lotacao>[]) {
    const daUnidade = new Set(
      (await c.tx.client.query<{ id: string }>('SELECT id FROM setor WHERE unidade_id = $1', [unidadeId])).rows.map((x) => x.id),
    );
    const ids = new Set<string>();
    for (const l of lotacoes) {
      if (ids.has(l.setorId)) throw new BadRequestException('setor repetido nas lotações');
      if (!daUnidade.has(l.setorId)) throw new BadRequestException('setor de outra unidade');
      ids.add(l.setorId);
    }
    await c.tx.client.query('DELETE FROM lotacao WHERE pessoa_id = $1 AND setor_id = ANY($2::uuid[])', [pessoaId, [...daUnidade]]);
    for (const l of lotacoes) {
      await c.tx.client.query(
        'INSERT INTO lotacao (org_id, pessoa_id, setor_id, papel, recebe, limite_carga) VALUES ($1, $2, $3, $4, $5, $6)',
        [c.tx.orgId, pessoaId, l.setorId, l.papel, l.recebe, l.limiteCarga],
      );
    }
    // Lotação nova pode destravar uma fila.
    for (const id of ids) await this.nucleo.distribuir(c, id);
  }
}
