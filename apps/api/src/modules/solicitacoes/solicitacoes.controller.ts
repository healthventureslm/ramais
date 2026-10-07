import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfirmarLocalReq, MidiaReq, PedidoApoioReq, PreviaTraducaoReq, ResponderReq, TransferirReq } from '@ramais/contracts';
import { z } from 'zod';
import type { Armazenamento } from '../../infra/armazenamento.js';
import { pessoaDa, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { ARMAZENAMENTO } from '../../infra/infra.module.js';
import { Nucleo } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Distribuicao } from '../distribuicao/distribuicao.service.js';
import { Acoes } from './acoes.js';
import { Comandos } from './comandos.js';
import { Consultas, type Filtro } from './consultas.js';

@Controller()
export class SolicitacoesController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly consultas: Consultas,
    private readonly comandos: Comandos,
    private readonly acoes: Acoes,
    private readonly distribuicao: Distribuicao,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
  ) {}

  private admin(s: Sessao) {
    return this.nucleo.executar(s.orgId, async (c) => {
      // Admin e gerente veem todos os pedidos da unidade.
      const r = await c.tx.client.query('SELECT admin, gerente FROM pessoa WHERE id = $1', [s.pessoaId]);
      return Boolean(r.rows[0]?.admin || r.rows[0]?.gerente);
    });
  }

  @Get('solicitacoes')
  async listar(@SessaoAtual() s: Sessao, @Query('filtro') filtro: Filtro = 'minhas', @Query('unidadeId') unidadeId?: string) {
    const pessoaId = pessoaDa(s);
    const admin = await this.admin(s);
    const f: Filtro = ['minhas', 'setores', 'unidade', 'fechadas'].includes(filtro) ? filtro : 'minhas';
    return this.nucleo.executar(s.orgId, (c) => this.consultas.listar(c, pessoaId, admin, f, unidadeId ? new Uuid().transform(unidadeId) : undefined));
  }

  @Get('solicitacoes/:id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    const pessoaId = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const sol = await this.acoes.carregar(c, id, false);
      await this.comandos.exigirAcesso(c, sol, pessoaId);
      await this.comandos.registrarVisualizacao(c, id, pessoaId);
      const d = await this.consultas.detalhe(c, id);
      if (!d) throw new NotFoundException();
      return d;
    });
  }

  @Post('solicitacoes/:id/mensagens')
  @HttpCode(201)
  responder(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(ResponderReq)) b: ResponderReq) {
    return this.comandos.responder(s.orgId, id, pessoaDa(s), b);
  }

  /** A equipe vê a tradução da própria resposta antes de enviar. */
  @Post('solicitacoes/:id/midia')
  @HttpCode(201)
  enviarMidia(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(MidiaReq)) b: MidiaReq) {
    return this.comandos.enviarMidia(s.orgId, id, pessoaDa(s), b);
  }

  @Post('solicitacoes/:id/previa-traducao')
  @HttpCode(200)
  previa(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(PreviaTraducaoReq)) b: { texto: string }) {
    return this.comandos.previaTraducao(s.orgId, id, pessoaDa(s), b.texto);
  }

  @Post('solicitacoes/:id/pegar')
  @HttpCode(200)
  async pegar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    const pessoaId = pessoaDa(s);
    await this.nucleo.executar(s.orgId, async (c) => {
      const sol = await this.acoes.carregar(c, id, false);
      const p = await this.comandos.permissao(c, sol, pessoaId);
      // Pegar é do supervisor (ou de quem é do setor, quando a fila é aberta).
      if (!(p.supervisor || p.admin || p.lotado)) throw new ForbiddenException();
    });
    await this.distribuicao.pegar(s.orgId, id, pessoaId);
    return { ok: true };
  }

  /** Supervisão (do setor), gerente ou admin assume uma conversa que já está com outra pessoa. */
  @Post('solicitacoes/:id/assumir')
  @HttpCode(200)
  assumir(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.comandos.assumir(s.orgId, id, pessoaDa(s));
  }

  @Post('solicitacoes/:id/transferir')
  @HttpCode(200)
  async transferir(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(TransferirReq)) b: TransferirReq) {
    await this.comandos.transferir(s.orgId, id, pessoaDa(s), b);
    return { ok: true };
  }

  /** Modo sombra: confirma a sugestão da IA (mesmo setor) ou corrige (outro setor). */
  @Post('solicitacoes/:id/triagem')
  @HttpCode(200)
  async triagem(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(z.object({ setorId: z.uuid() }))) b: { setorId: string }) {
    await this.comandos.triar(s.orgId, id, pessoaDa(s), b.setorId);
    return { ok: true };
  }

  @Post('solicitacoes/:id/apoio')
  @HttpCode(201)
  apoio(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(PedidoApoioReq)) b: PedidoApoioReq) {
    return this.comandos.pedirApoio(s.orgId, id, pessoaDa(s), b);
  }

  @Post('solicitacoes/:id/resolver')
  @HttpCode(200)
  async resolver(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    await this.comandos.resolver(s.orgId, id, pessoaDa(s));
    return { ok: true };
  }

  @Post('solicitacoes/:id/encerrar')
  @HttpCode(200)
  async encerrar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    await this.comandos.encerrar(s.orgId, id, pessoaDa(s));
    return { ok: true };
  }

  @Post('solicitacoes/:id/confirmar-local')
  @HttpCode(200)
  async confirmarLocal(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(ConfirmarLocalReq)) b: { localId: string }) {
    await this.comandos.confirmarLocal(s.orgId, id, pessoaDa(s), b.localId);
    return { ok: true };
  }

  // ---------- Ofertas ----------

  @Get('ofertas')
  ofertas(@SessaoAtual() s: Sessao) {
    const pessoaId = pessoaDa(s);
    return this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query(
        `SELECT o.id, o.solicitacao_id, o.expira_em, s.resumo, s.urgencia, st.nome AS setor
           FROM oferta o JOIN solicitacao s ON s.id = o.solicitacao_id LEFT JOIN setor st ON st.id = s.setor_id
          WHERE o.pessoa_id = $1 AND o.resultado = 'pendente' AND o.expira_em > now() ORDER BY o.ofertada_em`,
        [pessoaId],
      );
      return r.rows.map((l) => ({
        ofertaId: l.id,
        solicitacaoId: l.solicitacao_id,
        expiraEm: new Date(l.expira_em).toISOString(),
        resumo: l.resumo,
        urgencia: l.urgencia,
        setor: l.setor,
      }));
    });
  }

  @Post('ofertas/:id/aceitar')
  @HttpCode(200)
  async aceitar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return { solicitacaoId: await this.distribuicao.aceitar(s.orgId, id, pessoaDa(s)) };
  }

  @Post('ofertas/:id/recusar')
  @HttpCode(200)
  async recusar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    await this.distribuicao.recusar(s.orgId, id, pessoaDa(s));
    return { ok: true };
  }

  // ---------- Mídia ----------

  /** A foto e o áudio originais, conferindo tenant e acesso antes de liberar. */
  @Get('midia/:mensagemId')
  async midia(@SessaoAtual() s: Sessao, @Param('mensagemId', Uuid) mensagemId: string, @Res() res: Response) {
    const pessoaId = pessoaDa(s);
    const m = await this.nucleo.executar(s.orgId, async (c) => {
      const r = await c.tx.client.query('SELECT solicitacao_id, midia_chave, midia_mime FROM mensagem WHERE id = $1', [mensagemId]);
      const l = r.rows[0];
      if (!l?.midia_chave) throw new NotFoundException();
      const sol = await this.acoes.carregar(c, l.solicitacao_id, false);
      await this.comandos.exigirAcesso(c, sol, pessoaId);
      await this.nucleo.evento(c, { solicitacaoId: sol.id, tipo: 'midia_vista', atorTipo: 'pessoa', atorId: pessoaId, dados: { mensagemId } });
      return l as { midia_chave: string; midia_mime: string | null };
    });
    const url = await this.armazenamento.urlTemporaria(m.midia_chave);
    if (url) return res.redirect(url);
    const dados = await this.armazenamento.ler(m.midia_chave);
    res.setHeader('content-type', m.midia_mime ?? 'application/octet-stream');
    res.setHeader('cache-control', 'private, max-age=300');
    res.send(dados);
  }
}
