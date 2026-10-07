import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CadastrarDispositivoReq, EntrarTurnoReq, LoginWebReq, SairTurnoReq } from '@ramais/contracts';
import { z } from 'zod';
import { ApenasSessoes, pessoaDa, Publico, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Presencas } from './presenca.service.js';

@Controller()
export class EquipesController {
  constructor(
    private readonly presencas: Presencas,
    private readonly nucleo: Nucleo,
  ) {}

  @Publico()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body(new Zod(LoginWebReq)) b: LoginWebReq) {
    return this.presencas.loginWeb(b.email, b.senha);
  }

  @Post('auth/senha')
  @HttpCode(200)
  async trocarSenha(
    @SessaoAtual() s: Sessao,
    @Body(new Zod(z.object({ atual: z.string().min(1), nova: z.string().min(8, 'mínimo de 8 caracteres').max(200) }))) b: { atual: string; nova: string },
  ) {
    await this.presencas.trocarSenha(s, b.atual, b.nova);
    return { ok: true };
  }

  @Get('auth/eu')
  async eu(@SessaoAtual() s: Sessao) {
    const sessao = await this.presencas.sessaoApi(s.orgId, pessoaDa(s), '');
    const turno = await this.nucleo.executar(s.orgId, (c) =>
      c.tx.client.query('SELECT id, unidade_id, inicio FROM presenca WHERE pessoa_id = $1 AND fim IS NULL', [s.pessoaId]),
    );
    return { ...sessao, token: undefined, tipoSessao: s.tipo, turno: turno.rows[0] ?? null };
  }

  /** Celular do setor: troca o código de cadastro (QR do admin) por um token de dispositivo. */
  @Publico()
  @Post('auth/dispositivo')
  @HttpCode(200)
  cadastrar(@Body(new Zod(CadastrarDispositivoReq)) b: CadastrarDispositivoReq) {
    return this.presencas.cadastrarDispositivo(b.codigo, b.nome, b.plataforma);
  }

  @ApenasSessoes('dispositivo')
  @Post('turno/entrar')
  @HttpCode(200)
  entrar(@SessaoAtual() s: Sessao, @Body(new Zod(EntrarTurnoReq)) b: EntrarTurnoReq) {
    return this.presencas.entrarNoApp(s, b.email, b.pin, b.pushToken);
  }

  @ApenasSessoes('web')
  @Post('turno/entrar-web')
  @HttpCode(200)
  entrarWeb(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ unidadeId: z.uuid() }))) b: { unidadeId: string }) {
    pessoaDa(s);
    return this.presencas.entrarNaWeb(s, b.unidadeId);
  }

  @Post('turno/sair')
  @HttpCode(200)
  async sair(@SessaoAtual() s: Sessao, @Body(new Zod(SairTurnoReq)) b: SairTurnoReq) {
    await this.presencas.sair(s, b.conversas, b.transferirPara);
    return { ok: true };
  }

  @ApenasSessoes('turno')
  @Post('turno/push-token')
  @HttpCode(200)
  async pushToken(@SessaoAtual() s: Sessao, @Body(new Zod(z.object({ token: z.string().min(10) }))) b: { token: string }) {
    await this.presencas.atualizarPushToken(s, b.token);
    return { ok: true };
  }

  @Get('setores')
  setores(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query(
        `SELECT s.id, s.chave, s.nome,
                (SELECT count(*)::int FROM lotacao l JOIN presenca p ON p.pessoa_id = l.pessoa_id AND p.fim IS NULL
                  WHERE l.setor_id = s.id) AS em_turno
           FROM setor s WHERE s.unidade_id = $1 AND s.ativo ORDER BY s.nome`,
        [unidadeId],
      );
      return r.rows.map((l) => ({ id: l.id, chave: l.chave, nome: l.nome, emTurno: l.em_turno }));
    });
  }

  /** Busca por nome, com status: base da mensagem direta ("ramal"). */
  @Get('pessoas')
  pessoas(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Query('busca') busca?: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query(
        // Busca por nome ou por setor ("manutenção" lista quem está lá); quem está no turno primeiro.
        // Gerência e administração valem para todas as unidades, mesmo sem setor.
        `SELECT p.id, p.nome,
                EXISTS (SELECT 1 FROM presenca pr WHERE pr.pessoa_id = p.id AND pr.fim IS NULL) AS em_turno,
                coalesce((SELECT string_agg(DISTINCT st.nome, ', ') FROM lotacao l JOIN setor st ON st.id = l.setor_id WHERE l.pessoa_id = p.id),
                         CASE WHEN p.gerente THEN 'Gerência' WHEN p.admin THEN 'Administração' END) AS setores
           FROM pessoa p
          WHERE p.ativo
            AND (p.admin OR p.gerente OR EXISTS (SELECT 1 FROM lotacao l JOIN setor s ON s.id = l.setor_id AND s.unidade_id = $1 WHERE l.pessoa_id = p.id))
            AND ($2::text IS NULL OR p.nome ILIKE '%' || $2 || '%'
                 OR EXISTS (SELECT 1 FROM lotacao l JOIN setor s ON s.id = l.setor_id
                             WHERE l.pessoa_id = p.id AND s.unidade_id = $1 AND s.nome ILIKE '%' || $2 || '%'))
          ORDER BY 3 DESC, p.nome LIMIT 50`,
        [unidadeId, busca?.trim() || null],
      );
      return r.rows.map((l) => ({ id: l.id, nome: l.nome, emTurno: l.em_turno, setores: l.setores }));
    });
  }

  @Get('locais')
  locais(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Query('busca') busca?: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query(
        `SELECT l.id, l.identificador, l.tipo,
                (SELECT h.sobrenome FROM hospede_ativo h WHERE h.local_id = l.id AND current_date BETWEEN h.checkin AND h.checkout LIMIT 1) AS hospede
           FROM local l WHERE l.unidade_id = $1 AND l.ativo AND ($2::text IS NULL OR l.identificador ILIKE $2 || '%')
          ORDER BY l.identificador LIMIT 50`,
        [unidadeId, busca?.trim() || null],
      );
      return r.rows;
    });
  }
}
