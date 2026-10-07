/**
 * Fronteiras do monólito modular: cada módulo só importa os módulos que este mapa permite.
 * Separar um módulo em serviço depois é extrair uma pasta, não desembaraçar dependências.
 * Roda junto com os testes do servidor.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** módulo → módulos de que pode depender (infra e config são livres para todos). */
const PERMITIDO: Record<string, string[]> = {
  solicitacoes: ['distribuicao'],
  distribuicao: ['solicitacoes'],
  equipes: ['solicitacoes'],
  jornada: ['solicitacoes', 'distribuicao'],
  canais: ['jornada'],
  'tempo-real': [],
  dashboard: [],
  diretas: [],
  admin: ['equipes'],
  dev: [],
};
const LIVRES = new Set(['infra', 'config']);
const ORQUESTRADORES = new Set(['worker', 'modulos', 'main.api', 'main.worker']);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function moduloDe(arquivo: string): string {
  const partes = relative(raiz, arquivo).split(sep);
  return (partes[0] === 'modules' ? partes[1]! : partes[0]!).replace(/\.(js|ts)$/, '');
}

const erros: string[] = [];
const grafo = new Map<string, Set<string>>();
for (const arq of arquivos(raiz)) {
  const de = moduloDe(arq);
  if (LIVRES.has(de) || ORQUESTRADORES.has(de)) {
    if (de === 'infra') {
      // infra não pode depender de módulos de negócio.
      for (const m of readFileSync(arq, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
        const alvo = moduloDe(resolve(dirname(arq), m[1]!));
        if (alvo !== 'infra' && alvo !== 'config') erros.push(`${relative(raiz, arq)}: infra importa ${alvo}`);
      }
    }
    continue;
  }
  for (const m of readFileSync(arq, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
    const alvo = moduloDe(resolve(dirname(arq), m[1]!));
    if (alvo === de || LIVRES.has(alvo)) continue;
    if (ORQUESTRADORES.has(alvo)) {
      erros.push(`${relative(raiz, arq)}: módulo importa ${alvo} (só a montagem importa módulos)`);
      continue;
    }
    if (!(PERMITIDO[de] ?? []).includes(alvo)) erros.push(`${relative(raiz, arq)}: ${de} não pode importar ${alvo}`);
    if (!grafo.has(de)) grafo.set(de, new Set());
    grafo.get(de)!.add(alvo);
  }
}

if (!PERMITIDO.solicitacoes) erros.push('mapa sem solicitacoes');
// Ciclos são permitidos só entre solicitacoes ⇄ distribuicao (núcleo do atendimento).
const CICLO_ACEITO = new Set(['solicitacoes>distribuicao', 'distribuicao>solicitacoes']);
for (const [a, bs] of grafo) for (const b of bs) if (grafo.get(b)?.has(a) && !CICLO_ACEITO.has(`${a}>${b}`)) erros.push(`ciclo: ${a} ⇄ ${b}`);

if (erros.length) {
  console.error(`fronteiras violadas:\n  ${erros.join('\n  ')}`);
  process.exit(1);
}
console.log(`fronteiras ok (${grafo.size} módulos com dependências)`);
