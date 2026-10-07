import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import type pg from 'pg';
import type { Config } from '../../config.js';
import { Publico } from '../../infra/auth.js';
import { CONFIG, POOL } from '../../infra/tokens.js';

/**
 * Só em META_DRY_RUN: mostra ao simulador o que "teria sido enviado" pelo WhatsApp.
 * Usa o papel do app, mas atravessa tenants pelo telefone; por isso nunca existe fora do dry-run.
 */
@Controller('dev')
export class DevController {
  constructor(
    @Inject(CONFIG) private readonly cfg: Config,
    @Inject(POOL) private readonly pool: pg.Pool,
  ) {}

  @Publico()
  @Get('saidas')
  async saidas(@Query('phoneNumberId') phoneNumberId: string, @Query('telefone') telefone: string, @Query('desde') desde?: string) {
    if (!this.cfg.META_DRY_RUN) throw new NotFoundException();
    const canal = await this.pool.query('SELECT * FROM sistema.resolver_canal($1)', [phoneNumberId]);
    const org = canal.rows[0]?.org_id;
    if (!org) throw new NotFoundException('canal não encontrado');
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.org_id', $1, true)", [org]);
      const r = await c.query(
        `SELECT m.id, m.criado_em, m.autor_tipo, m.status_envio,
                coalesce((SELECT d.texto FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma <> 'pt'
                           ORDER BY d.criado_em DESC LIMIT 1), m.texto) AS texto
           FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id JOIN solicitante so ON so.id = s.solicitante_id
          WHERE so.telefone = $1 AND m.visibilidade = 'externa' AND m.autor_tipo <> 'solicitante'
            AND m.status_envio IN ('enviada', 'entregue', 'lida', 'falhou')
            AND m.criado_em > coalesce($2::timestamptz, now() - interval '1 hour')
          ORDER BY m.criado_em`,
        [telefone, desde ?? null],
      );
      await c.query('COMMIT');
      return r.rows;
    } finally {
      c.release();
    }
  }
}
