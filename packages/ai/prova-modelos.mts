/**
 * Prova rápida de modelos para tradução e base de conhecimento, com as mesmas exigências da
 * produção (JSON estruturado, provedor sem retenção). Mede acerto, tempo e custo.
 *   npx tsx prova-modelos.mts google/gemini-2.5-flash-lite openai/gpt-4.1-nano …
 */
import { carregarEnv } from '../db/src/index.ts';
import { conhecimentoHotelExemplo } from '../verticals/hotel/src/index.ts';
import { ClienteOpenRouter, RespondedorLLM, TradutorLLM, type UsoIA } from './src/index.ts';

carregarEnv();
const modelos = process.argv.slice(2);
const TRADUCOES: { texto: string; para: string; de?: string; confere: RegExp; chave: string[] }[] = [
  { texto: 'Boa noite! O técnico já está subindo, chega em 10 minutos.', para: 'ja', confere: /[぀-ヿ一-鿿]/, chave: ['10'] },
  { texto: 'Seu pedido foi encaminhado para a Governança. Já te respondemos por aqui.', para: 'ar', confere: /[؀-ۿ]/, chave: [] },
  { texto: 'O café da manhã é das 6h30 às 10h30 no térreo.', para: 'ru', confere: /[Ѐ-ӿ]/, chave: ['6', '10'] },
  { texto: 'Reserva feita para hoje às 20h, mesa para 4 pessoas.', para: 'de', confere: /(Reservierung|Tisch|reserviert)/i, chave: ['20', '4'] },
  { texto: 'The air conditioning in room 1204 is dripping water on the floor', para: 'pt', confere: /(ar[- ]condicionado|pingando|vazando|água)/i, chave: ['1204'] },
  { texto: '部屋のテレビがつきません。誰か来てもらえますか？', para: 'pt', confere: /(TV|televis)/i, chave: [] },
];
const PERGUNTAS: { texto: string; responde: boolean; confere?: RegExp }[] = [
  { texto: 'What is the Wi-Fi password?', responde: true, confere: /Hotel-Hospedes|card|cartão/i },
  { texto: '朝食は何時からですか？', responde: true, confere: /6[:h]?30|6時/ },
  { texto: 'Gibt es einen Parkplatz?', responde: true, confere: /60/ },
  { texto: 'O chuveiro do meu quarto está sem água quente', responde: false },
];

const linhas: string[] = [];
for (const modelo of modelos) {
  const usos: UsoIA[] = [];
  const cliente = new ClienteOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY!, semRetencao: true, aoUsar: (u) => usos.push(u) });
  const tradutor = new TradutorLLM(cliente, modelo);
  const respondedor = new RespondedorLLM(cliente, modelo);
  let tOk = 0;
  let kOk = 0;
  const erros: string[] = [];
  const exemplos: string[] = [];
  for (const t of TRADUCOES) {
    try {
      const r = await tradutor.traduzir(t.texto, t.para);
      const ok = t.confere.test(r.texto) && t.chave.every((n) => r.texto.includes(n));
      if (ok) tOk++;
      else exemplos.push(`  tradução ${t.para} duvidosa: ${r.texto.slice(0, 90)}`);
    } catch (e) {
      erros.push(`tradução ${t.para}: ${(e as Error).message.slice(0, 100)}`);
    }
  }
  for (const pq of PERGUNTAS) {
    try {
      const r = await respondedor.responder(pq.texto, conhecimentoHotelExemplo);
      const ok = pq.responde ? r.responde && Boolean(r.resposta) && (!pq.confere || pq.confere.test(r.resposta ?? '')) : !r.responde;
      if (ok) kOk++;
      else exemplos.push(`  base "${pq.texto}": responde=${r.responde} ${String(r.resposta ?? '').slice(0, 80)}`);
    } catch (e) {
      erros.push(`base "${pq.texto}": ${(e as Error).message.slice(0, 100)}`);
    }
  }
  const custo = usos.reduce((s, u) => s + (u.custoUsd ?? 0), 0);
  const tempo = usos.filter((u) => u.ok).reduce((s, u) => s + u.latenciaMs, 0) / Math.max(1, usos.filter((u) => u.ok).length);
  linhas.push(
    `${modelo.padEnd(42)} tradução ${tOk}/${TRADUCOES.length} · base ${kOk}/${PERGUNTAS.length} · ${usos.length} chamadas (${usos.filter((u) => !u.ok).length} falhas) · ${(tempo / 1000).toFixed(1)} s · US$ ${custo.toFixed(6)}`,
  );
  for (const e of erros) linhas.push(`  ERRO ${e}`);
  linhas.push(...exemplos);
  console.log(linhas.slice(-1 - erros.length - exemplos.length).join('\n'));
}
