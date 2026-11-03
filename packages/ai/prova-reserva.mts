/**
 * Prova do leitor de reserva com o modelo de produção, nas frases que confundiam a reserva
 * (correções de pessoas, idade de adulto, "cada"). Sem custo relevante: uma chamada por frase.
 *   npx tsx packages/ai/prova-reserva.mts
 */
import { carregarEnv } from '../db/src/index.ts';
import { ClienteOpenRouter, ExtratorReservaLLM } from './src/index.ts';
carregarEnv();
const x = new ExtratorReservaLLM(new ClienteOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY!, semRetencao: true }), process.env.IA_MODELO_RESPOSTA!);
const hoje = new Date().toISOString().slice(0, 10);
const conhecido = { checkIn: '2026-11-20', checkOut: '2026-12-04', adultos: 7, criancas: 7, idadesCriancas: [5, 5, 5, 5, 5, 5, 5] };
const casos: [string, Record<string, unknown> | null, string, (e: Record<string, unknown>) => boolean][] = [
  ['95 anos', { ...conhecido, idadesCriancas: [] }, 'Qual a idade de cada criança? A idade muda o preço e o tipo de quarto.', (e) => (e.idadesCriancas as number[]).includes(95)],
  ['5 anos cada', { ...conhecido, idadesCriancas: [] }, 'Qual a idade de cada criança? A idade muda o preço e o tipo de quarto.', (e) => (e.idadesCriancas as number[]).length >= 1 && (e.idadesCriancas as number[]).every((i) => i === 5)],
  ['ta entao na verdade são 2 adultos apenas, e nenhuma criança', conhecido, 'Não encontrei disponibilidade de 20/11 a 04/12 para 7 adultos, 7 crianças. Quer tentar outras datas ou mudar o número de pessoas?', (e) => e.adultos === 2 && e.criancas === 0],
  ['nao, nao tem nenhuma criança', { ...conhecido, adultos: 2 }, 'Não encontrei disponibilidade de 20/11 a 04/12 para 2 adultos, 7 crianças. Quer tentar outras datas ou mudar o número de pessoas?', (e) => e.criancas === 0],
  ['somos eu, minha esposa e nosso filho de 8 anos', null, 'Quantos adultos e quantas crianças? Se houver crianças, diga a idade de cada uma.', (e) => e.adultos === 2 && e.criancas === 1 && (e.idadesCriancas as number[])[0] === 8],
];
let ok = 0;
for (const [texto, conhecidoAqui, pergunta, certo] of casos) {
  const e = (await x.extrair(texto, { hoje, diaSemana: 'Tuesday', conhecido: conhecidoAqui, pergunta })) as unknown as Record<string, unknown>;
  const passou = certo(e);
  if (passou) ok++;
  console.log(`${passou ? 'ok  ' : 'ERRO'} "${texto}" → adultos ${e.adultos}, crianças ${e.criancas}, idades ${JSON.stringify(e.idadesCriancas)}`);
}
console.log(`${ok}/${casos.length}`);
