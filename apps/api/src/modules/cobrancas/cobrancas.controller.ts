import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { resolverCobranca } from '@ramais/db';
import type pg from 'pg';
import { Publico } from '../../infra/auth.js';
import { POOL } from '../../infra/tokens.js';
import { Cobrancas } from './cobrancas.service.js';

/**
 * Aviso do Salabim Pay (charge.paid e afins). Não confiamos no corpo: ele só diz qual link
 * conferir, e a situação vem da consulta ao provedor. Sem aviso, o temporizador confere sozinho.
 */
@Controller('webhooks/salabim')
@Publico()
export class CobrancasController {
  constructor(
    private readonly cobrancas: Cobrancas,
    @Inject(POOL) private readonly pool: pg.Pool,
  ) {}

  @Post()
  @HttpCode(200)
  async aviso(@Body() corpo: unknown) {
    const ids = [...new Set(JSON.stringify(corpo ?? {}).match(/pl_[A-Za-z0-9]{8,64}/g) ?? [])].slice(0, 5);
    for (const id of ids) {
      const alvo = await resolverCobranca(this.pool, id);
      if (alvo) await this.cobrancas.conferir(alvo.orgId, alvo.cobrancaId, null);
    }
    return { ok: true };
  }
}
