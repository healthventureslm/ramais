import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { config } from './config.js';
import { WorkerModule } from './modulos.js';

async function main() {
  const cfg = config();
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  await app.init();
  console.log(`[worker] pronto${cfg.OPENROUTER_API_KEY ? '' : ' (sem OPENROUTER_API_KEY: roteamento por palavras-chave, sem tradução)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
