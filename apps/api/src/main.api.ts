import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type pg from 'pg';
import { config } from './config.js';
import { Tokens } from './infra/auth.js';
import { POOL } from './infra/tokens.js';
import { ApiModule } from './modulos.js';
import { Presencas } from './modules/equipes/presenca.service.js';
import { iniciarTempoReal } from './modules/tempo-real/gateway.js';

async function main() {
  const cfg = config();
  // rawBody: a assinatura do webhook da Meta é calculada sobre os bytes exatos.
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, { rawBody: true, bufferLogs: false });
  app.enableCors({ origin: cfg.WEB_ORIGEM.split(',').map((o) => o.trim()), credentials: true });
  // Foto e áudio chegam em base64 (até 10 MB de arquivo).
  app.useBodyParser('json', { limit: '16mb' });
  app.enableShutdownHooks();

  const presencas = app.get(Presencas);
  await app.init();
  iniciarTempoReal(app.getHttpServer(), app.get<pg.Pool>(POOL), app.get(Tokens), cfg.WEB_ORIGEM, (s) => {
    if (s.tipo === 'turno') presencas.batimento(s).catch(() => undefined);
  });
  await app.listen(cfg.PORTA);
  console.log(`[api] ouvindo em :${cfg.PORTA}${cfg.META_DRY_RUN ? ' (META_DRY_RUN: nada é enviado à Meta)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
