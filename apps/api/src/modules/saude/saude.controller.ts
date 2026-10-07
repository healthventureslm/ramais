import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type pg from 'pg';
import { Publico } from '../../infra/auth.js';
import { POOL } from '../../infra/tokens.js';

/**
 * Healthcheck do contêiner e do balanceador. Público e sem dado nenhum: só diz se a API
 * responde e alcança o banco. A versão vem do carimbo do build (GIT_COMMIT ou SOURCE_COMMIT), quando houver.
 */
@Controller('saude')
export class SaudeController {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  @Publico()
  @Get()
  async saude() {
    try {
      await this.pool.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('banco indisponível');
    }
    return { ok: true, versao: process.env.GIT_COMMIT || process.env.SOURCE_COMMIT || null };
  }
}
