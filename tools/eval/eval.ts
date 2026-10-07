/**
 * Conjunto de regressão do roteamento. Roda os casos rotulados contra o catálogo e o motor
 * e mostra acurácia, matriz de confusão, faixas de confiança e o AUROC (a confiança
 * separa acertos de erros?). Rode antes de publicar qualquer mudança de catálogo.
 *
 *   pnpm eval                                  casos de tools/eval/casos/hotel.jsonl, motor da .env
 *   pnpm eval -- --casos outro.jsonl
 *   pnpm eval -- --correcoes <unidadeId>       usa também as correções reais da equipe (banco local)
 *   pnpm eval -- --minimo 0.85                 falha (exit 1) se a acurácia ficar abaixo
 *   pnpm eval -- --comparar google/gemini-3.1-flash-lite,openai/gpt-4o-mini   compara motores em sombra
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClienteOpenRouter, criarMotorRoteamento, MotorPalavras, Roteador, TradutorLLM } from '@ramais/ai';
import type { MotorDecisao } from '@ramais/contracts';
import { carregarEnv, comTenant, criarPool } from '@ramais/db';
import { aplicarGate, relatorio, sugerirLimite, type Amostra } from '@ramais/domain';
import { configHotel } from '@ramais/vertical-hotel';

carregarEnv();
const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== '--');
const opc = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface Caso {
  texto: string;
  setor: string;
}

const cfg = configHotel;
const setores = cfg.setores.map((s) => ({ chave: s.chave, descricao: s.descricao, casosDeBorda: s.casosDeBorda }));

async function carregarCasos(): Promise<Caso[]> {
  const arquivo = opc('casos') ?? join(aqui, 'casos', 'hotel.jsonl');
  const casos = readFileSync(arquivo, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Caso);
  const unidade = opc('correcoes');
  if (unidade) {
    const pool = criarPool(process.env.DATABASE_URL_OWNER!, 1);
    const org = (await pool.query('SELECT org_id FROM sistema.resolver_canal($1)', [opc('canal') ?? 'dev-phone-id'])).rows[0]?.org_id;
    if (org) {
      const reais = await comTenant(pool, org, async ({ client }) =>
        (
          await client.query(
            `SELECT c.texto, s.chave AS setor FROM correcao c JOIN setor s ON s.id = c.setor_correto_id WHERE s.unidade_id = $1`,
            [unidade],
          )
        ).rows as Caso[],
      );
      console.log(`+ ${reais.length} correções reais da equipe`);
      casos.push(...reais);
    }
    await pool.end();
  }
  return casos;
}

function motores(): MotorDecisao[] {
  const chave = process.env.OPENROUTER_API_KEY;
  const comparar = opc('comparar');
  if (!chave) {
    if (comparar) console.warn('sem OPENROUTER_API_KEY: --comparar ignorado, usando só o motor de regras');
    return [new MotorPalavras(cfg.setores)];
  }
  const cliente = new ClienteOpenRouter({ apiKey: chave, semRetencao: process.env.IA_SEM_RETENCAO !== 'false' });
  const metodo = (process.env.IA_CONFIANCA as 'logprobs' | 'autoconsistencia') ?? 'autoconsistencia';
  const modelos = comparar ? comparar.split(',') : [process.env.IA_MODELO_ROTEAMENTO ?? 'google/gemini-3.1-flash-lite'];
  return [...modelos.map((m) => criarMotorRoteamento(cliente, m.trim(), metodo, Number(process.env.IA_AMOSTRAS ?? 3))), new MotorPalavras(cfg.setores)];
}

async function avaliar(motor: MotorDecisao, casos: Caso[]) {
  const roteador = new Roteador(motor);
  const chave = process.env.OPENROUTER_API_KEY;
  const pivot = chave && process.env.IA_PIVOT_INGLES !== 'false' ? new TradutorLLM(new ClienteOpenRouter({ apiKey: chave }), process.env.IA_MODELO_TRADUCAO ?? 'google/gemini-3.1-flash-lite') : null;
  const amostras: Amostra[] = [];
  const latencias: number[] = [];
  const acoes: Record<string, number> = {};
  for (const c of casos) {
    let ingles: string | null = null;
    if (pivot && !motor.nome.startsWith('regras')) ingles = (await pivot.traduzir(c.texto, 'en').catch(() => null))?.texto ?? null;
    const r = await roteador.rotear({ texto: c.texto, textoIngles: ingles, historico: [], fatos: {}, setores });
    latencias.push(r.latenciaMs);
    amostras.push({ previsto: r.saida.setor, correto: c.setor, confianca: r.confianca.setor });
    const g = aplicarGate(r, cfg.limites).acao;
    acoes[g] = (acoes[g] ?? 0) + 1;
  }
  return { amostras, latencias, acoes };
}

function pct(x: number | null) {
  return x === null ? '  —  ' : `${(x * 100).toFixed(1).padStart(5)}%`;
}

const casos = await carregarCasos();
console.log(`${casos.length} casos · catálogo ${cfg.vertical} (${cfg.setores.length} setores)\n`);
let pior = 1;
for (const motor of motores()) {
  const { amostras, latencias, acoes } = await avaliar(motor, casos);
  const r = relatorio(amostras);
  pior = Math.min(pior, r.acuracia);
  const ord = [...latencias].sort((a, b) => a - b);
  console.log(`== ${motor.nome}`);
  console.log(`acurácia ${pct(r.acuracia)}   AUROC ${pct(r.auroc)}   latência p50 ${ord[Math.floor(ord.length / 2)]} ms  p95 ${ord[Math.floor(ord.length * 0.95)]} ms`);
  console.log(`gate: ${Object.entries(acoes).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.log('faixas de confiança:');
  for (const f of r.faixas) if (f.n) console.log(`  ${pct(f.de)} – ${pct(f.ate)}  n=${String(f.n).padStart(3)}  acerto ${pct(f.acuracia)}`);
  console.log(`limite sugerido p/ encaminhar (95%): ${pct(sugerirLimite(amostras, 0.95, 10))}`);
  const erros = amostras.map((a, i) => ({ ...a, texto: casos[i]!.texto })).filter((a) => a.previsto !== a.correto);
  if (erros.length) {
    console.log('erros:');
    for (const e of erros) console.log(`  [${e.correto} → ${e.previsto} @${e.confianca.toFixed(2)}] ${e.texto}`);
  }
  console.log('');
}

const minimo = opc('minimo');
if (minimo && pior < Number(minimo)) {
  console.error(`acurácia ${pct(pior)} abaixo do mínimo ${minimo}: não publique este catálogo`);
  process.exit(1);
}
