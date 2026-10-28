import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RecusarPedidoReq } from '@ramais/contracts';
import { z } from 'zod';
import { pessoaDa, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo } from '../../infra/nucleo.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { Pedidos } from './pedidos.service.js';

const Filtro = z.enum(['abertos', 'agenda', 'todos']).default('abertos');

/** Pedidos do catálogo para a equipe: lista, agenda e as respostas (confirmar, recusar, lançar, concluir). */
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly pedidos: Pedidos,
  ) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string, @Query('filtro') filtro?: string) {
    const f = Filtro.parse(filtro || undefined);
    return this.nucleo.executar(s.orgId, async (c) => {
      pessoaDa(s);
      return { hoje: await this.pedidos.hoje(c, unidadeId), pedidos: await this.pedidos.listar(c, unidadeId, f) };
    });
  }

  /** O pedido de um atendimento (o cartão ao lado da conversa); nulo se o atendimento não veio do catálogo. */
  @Get('solicitacao/:id')
  porSolicitacao(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.nucleo.executar(s.orgId, async (c) => ({ pedido: await this.pedidos.porSolicitacao(c, id, pessoaDa(s)) }));
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  confirmar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.pedidos.confirmar(s.orgId, id, pessoaDa(s));
  }

  @Post(':id/recusar')
  @HttpCode(200)
  recusar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string, @Body(new Zod(RecusarPedidoReq)) b: z.infer<typeof RecusarPedidoReq>) {
    return this.pedidos.recusar(s.orgId, id, pessoaDa(s), b.motivo);
  }

  @Post(':id/lancar')
  @HttpCode(200)
  lancar(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.pedidos.lancar(s.orgId, id, pessoaDa(s));
  }

  @Post(':id/concluir')
  @HttpCode(200)
  concluir(@SessaoAtual() s: Sessao, @Param('id', Uuid) id: string) {
    return this.pedidos.concluir(s.orgId, id, pessoaDa(s));
  }
}
