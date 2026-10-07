import { Controller, ForbiddenException, Get, HttpCode, Inject, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type pg from 'pg';
import type { PgBoss } from 'pg-boss';
import type { Config } from '../../config.js';
import { Publico } from '../../infra/auth.js';
import { assinaturaValida } from '../../infra/meta.js';
import { BOSS, CONFIG, POOL } from '../../infra/tokens.js';

/**
 * Webhook da Meta. Grava o payload bruto e responde 200 na hora; o processamento é
 * idempotente pelo ID da mensagem. Worker fora do ar só atrasa, nunca perde.
 */
@Controller('webhooks/whatsapp')
export class WebhookController {
  constructor(
    @Inject(CONFIG) private readonly cfg: Config,
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(BOSS) private readonly boss: PgBoss,
  ) {}

  /** Verificação do endpoint no painel da Meta. */
  @Publico()
  @Get()
  verificar(@Query('hub.mode') modo: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') desafio: string) {
    if (modo === 'subscribe' && token === this.cfg.META_VERIFY_TOKEN) return desafio;
    throw new ForbiddenException();
  }

  @Publico()
  @Post()
  @HttpCode(200)
  async receber(@Req() req: Request & { rawBody?: Buffer }) {
    const corpo = req.rawBody;
    if (!corpo || !assinaturaValida(this.cfg.META_APP_SECRET, corpo, req.header('x-hub-signature-256'))) {
      throw new UnauthorizedException('assinatura inválida');
    }
    const r = await this.pool.query<{ id: string }>(
      'INSERT INTO sistema.webhook_bruto (payload) VALUES ($1) RETURNING id',
      [corpo.toString('utf8')],
    );
    // Se a fila falhar, a varredura reprocessa o que ficou sem `processado_em`.
    await this.boss.send('webhook', { id: Number(r.rows[0]!.id) }).catch((e) => console.error('[webhook] enfileirar', e));
    return 'ok';
  }
}
