/**
 * Prova da base de conhecimento do hotel de demonstração com o modelo de produção: perguntas que
 * a IA deve responder (vários idiomas) e pedidos que ela deve RECUSAR, para irem ao setor.
 * Uma resposta a um pedido é o erro grave: o pedido some sem ninguém da equipe ver.
 *   npx tsx packages/ai/prova-base.mts
 */
import { carregarEnv } from '../db/src/index.ts';
import { DEMO_CONHECIMENTO } from '../../tools/seed/demo-dados.ts';
import { ClienteOpenRouter, RespondedorLLM } from './src/index.ts';
carregarEnv();
const r = new RespondedorLLM(new ClienteOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY!, semRetencao: true }), process.env.IA_MODELO_RESPOSTA!);
const itens = DEMO_CONHECIMENTO.map((k) => ({ id: k.chave, pergunta: k.pergunta, resposta: k.resposta, tags: k.tags }));
const responder: [string, string][] = [
  ['Que horas é o check-out?', 'checkin-checkout'], ['Posso chegar às 10h da manhã e já entrar no quarto?', 'checkin-antecipado'],
  ['Preciso levar passaporte?', 'documentos'], ['Can I leave my bags after check out?', 'bagagem'], ['Aceitam Pix?', 'pagamento'],
  ['Preciso da nota em nome da empresa', 'nota-fiscal'], ['Can I smoke on the balcony?', 'nao-fumantes'], ['Is there a safe in the room?', 'cofre'],
  ['O ar não liga, como faço?', 'ar-condicionado'], ['¿A qué hora limpian la habitación?', 'arrumacao'], ['O frigobar é pago?', 'frigobar'],
  ['Até que horas tem jantar?', 'restaurante'], ['Do you have room service?', 'room-service'], ['O bar abre que horas?', 'bar'],
  ['Têm comida vegana?', 'restricoes-alimentares'], ['Posso levar toalha para a praia?', 'toalha-praia'], ['How far is the airport?', 'aeroporto'],
  ['Como chamo um Uber?', 'taxi'], ['Is there a subway nearby?', 'metro'], ['O que posso fazer por aqui hoje?', 'passeios'],
  ['Where can I exchange money?', 'cambio'], ['Tem farmácia aqui perto?', 'farmacia'], ['Qual o número da ambulância no Brasil?', 'hospital-emergencia'],
  ['Vocês lavam roupa?', 'lavanderia'], ['Tem lei do silêncio?', 'silencio'],
  ['Como funciona esse chat?', 'como-funciona-chat'], ['Do you speak English?', 'idiomas'], ['朝食は何時ですか？', 'cafe'], ['Wie ist das WLAN-Passwort?', 'wifi'],
];
const recusar = [
  'Me traz duas toalhas, por favor', 'O ar-condicionado está pingando no chão', 'Quero reservar uma mesa para o jantar às 20h',
  'Please send someone to fix the shower', 'Me acorda amanhã às 7h', 'Perdi meu celular no restaurante', 'Pode chamar um táxi para mim agora?',
  'Quero trocar de quarto, o meu está barulhento', 'Tem cobrança errada na minha conta', 'Posso levar meu cachorro?',
  'Quero pedir um hambúrguer e uma Coca no quarto', 'Podem buscar minha roupa para lavar?', 'Chego amanhã às 9h, deixem o quarto pronto',
  'Please wake me up at 6:30 tomorrow', 'Preciso da nota fiscal em nome da empresa XPTO, CNPJ 12.345.678/0001-90', 'Can you book a tour to Christ the Redeemer for tomorrow?',
];
let ok = 0, total = 0; const falhas: string[] = [];
for (const [p, esperado] of responder) {
  total++; const x = await r.responder(p, itens);
  if (x.responde && x.fontes.includes(esperado)) ok++; else falhas.push(`RESPONDER "${p}" → ${x.responde ? 'fontes ' + x.fontes.join(',') : 'não respondeu'} (esperado ${esperado})`);
}
for (const p of recusar) {
  total++; const x = await r.responder(p, itens);
  if (!x.responde) ok++; else falhas.push(`RECUSAR "${p}" → respondeu: ${(x.resposta ?? '').slice(0, 70)}`);
}
console.log(`${ok}/${total} certos`); for (const f of falhas) console.log('  ' + f);
