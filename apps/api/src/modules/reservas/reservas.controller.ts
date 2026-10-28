import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Inject, Post, Put, Query, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { resolverOfertaVoa } from '@ramais/db';
import type pg from 'pg';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { pessoaDa, Publico, SessaoAtual, type Sessao } from '../../infra/auth.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { CONFIG, POOL } from '../../infra/tokens.js';
import { Uuid, Zod } from '../../infra/validacao.js';
import { ClienteVoa } from '../../infra/voa.js';
import { Reservas, type EventoVoa } from './reservas.service.js';

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const ConfigReq = z.object({ unidadeId: z.uuid(), voaHotelId: z.number().int().positive().nullable() });

/**
 * Reserva de hospedagem pela VOA: o webhook de pagamento (público, conferido pelo segredo
 * combinado com a VOA) e a configuração do hotel de cada unidade (admin).
 */
@Controller()
export class ReservasController {
  constructor(
    private readonly nucleo: Nucleo,
    private readonly reservas: Reservas,
    private readonly voa: ClienteVoa,
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  /** A VOA avisa a cada mudança de pagamento. Responde rápido; o mesmo aviso pode chegar de novo. */
  @Publico()
  @Post('webhooks/voa')
  @HttpCode(200)
  async webhook(@Headers('authorization') auth: string | undefined, @Body() corpo: EventoVoa) {
    if (!this.cfg.VOA_WEBHOOK_SEGREDO) throw new ServiceUnavailableException('webhook da VOA não configurado');
    if (!auth || !iguais(auth.trim(), this.cfg.VOA_WEBHOOK_SEGREDO)) throw new UnauthorizedException();
    const uuid = typeof corpo?.checkout_uuid === 'string' ? corpo.checkout_uuid : null;
    if (!uuid) return { ok: true, ignorado: 'sem checkout_uuid' };
    const chave = [uuid, corpo.status ?? '', corpo.booking_status ?? '', corpo.booking_id ?? ''].join('|');
    const novo = await this.pool.query('INSERT INTO sistema.voa_evento (chave, payload) VALUES ($1, $2) ON CONFLICT DO NOTHING', [chave, JSON.stringify(corpo)]);
    if (!novo.rowCount) return { ok: true, repetido: true };
    const alvo = await resolverOfertaVoa(this.pool, uuid);
    if (!alvo) return { ok: true, ignorado: 'oferta desconhecida' };
    await this.nucleo.executar(alvo.orgId, (c) => this.reservas.aoPagamento(c, alvo.reservaId, corpo));
    return { ok: true };
  }

  private async exigirAdmin(c: Ctx, s: Sessao) {
    const r = await c.tx.client.query('SELECT admin FROM pessoa WHERE id = $1 AND ativo', [pessoaDa(s)]);
    if (!r.rows[0]?.admin) throw new ForbiddenException('só administradores');
  }

  @Get('admin/reservas')
  config(@SessaoAtual() s: Sessao, @Query('unidadeId', Uuid) unidadeId: string) {
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      const u = await c.tx.client.query<{ voa_hotel_id: number | null }>('SELECT voa_hotel_id FROM unidade WHERE id = $1', [unidadeId]);
      const resumo = await c.tx.client.query<{ estado: string; n: number; total: string | null }>(
        `SELECT estado, count(*)::int AS n, sum(total) AS total FROM reserva_hospedagem
          WHERE unidade_id = $1 AND criado_em > now() - interval '30 days' GROUP BY estado`,
        [unidadeId],
      );
      return {
        voaHotelId: u.rows[0]?.voa_hotel_id ?? null,
        integracao: this.voa.disponivel,
        webhook: Boolean(this.cfg.VOA_WEBHOOK_SEGREDO),
        urlWebhook: this.cfg.WEB_URL_PUBLICA ? `${this.cfg.WEB_URL_PUBLICA.replace(/\/$/, '')}/api/webhooks/voa` : null,
        ultimos30d: resumo.rows.map((x) => ({ estado: x.estado, quantidade: x.n, total: x.total ? Number(x.total) : 0 })),
      };
    });
  }

  /** Liga a reserva automática nesta unidade: confere o hotel na VOA antes de gravar. */
  @Put('admin/reservas')
  async salvar(@SessaoAtual() s: Sessao, @Body(new Zod(ConfigReq)) b: z.infer<typeof ConfigReq>) {
    let hotel: string | null = null;
    if (b.voaHotelId !== null) {
      if (!this.voa.disponivel) throw new ServiceUnavailableException('falta o token da VOA no servidor (VOA_API_TOKEN)');
      hotel = await this.voa.nomeDoHotel(b.voaHotelId);
    }
    return this.nucleo.executar(s.orgId, async (c) => {
      await this.exigirAdmin(c, s);
      await c.tx.client.query('UPDATE unidade SET voa_hotel_id = $2 WHERE id = $1', [b.unidadeId, b.voaHotelId]);
      return { ok: true, hotel };
    });
  }
}
