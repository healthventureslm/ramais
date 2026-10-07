import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Carrega o .env da raiz do monorepo, sem sobrescrever variáveis já definidas. */
export function carregarEnv(inicio = process.cwd()): void {
  let dir = resolve(inicio);
  for (;;) {
    const arquivo = join(dir, '.env');
    if (existsSync(arquivo)) {
      for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
        if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
      }
      return;
    }
    const pai = dirname(dir);
    if (pai === dir) return;
    dir = pai;
  }
}
