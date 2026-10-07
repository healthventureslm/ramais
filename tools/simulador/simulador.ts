/**
 * Simulador de hóspede no WhatsApp, para desenvolvimento sem a Meta.
 * Envia webhooks assinados como a Meta envia e mostra o que o sistema "respondeu"
 * (com META_DRY_RUN=true, as saídas ficam registradas em vez de ir para a Meta).
 *
 *   pnpm sim                              conversa interativa
 *   pnpm sim -- --quarto 302 "o ar está pingando"
 *   pnpm sim -- --de 5491155550000 --nome "Lucía" "Necesito dos toallas"
 *   pnpm sim -- --imagem foto.jpg "olha isso"
 *   pnpm sim -- --audio audio.ogg
 */
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const linha of existsSync(join(raiz, '.env')) ? readFileSync(join(raiz, '.env'), 'utf8').split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const opc = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const api = opc('api') ?? `http://localhost:${process.env.PORTA ?? 3000}`;
const de = opc('de') ?? '5521988887777';
const nome = opc('nome') ?? 'Hóspede Teste';
const quarto = opc('quarto');
const imagem = opc('imagem');
const audio = opc('audio');
const segredo = process.env.META_APP_SECRET ?? 'segredo-dev-do-app';

const seedArq = join(raiz, '.dev', 'seed.json');
if (!existsSync(seedArq)) {
  console.error('rode `pnpm db:seed` antes (falta .dev/seed.json)');
  process.exit(1);
}
const seed = JSON.parse(readFileSync(seedArq, 'utf8')) as {
  canal: { phoneNumberId: string; numero: string };
  locais: { quarto: string; codigo: string }[];
};
const phoneNumberId = seed.canal.phoneNumberId;
let codigoQuarto = quarto ? seed.locais.find((l) => l.quarto === quarto)?.codigo : undefined;
if (quarto && !codigoQuarto) {
  console.error(`quarto ${quarto} não existe no seed`);
  process.exit(1);
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

function midia(arquivo: string) {
  const mime = MIME[extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
  // No dry-run, o "id" da mídia é a própria data URL.
  return { id: `data:${mime};base64,${readFileSync(arquivo).toString('base64')}`, mime_type: mime };
}

async function enviar(texto: string | null, extra: { imagem?: string; audio?: string } = {}) {
  let corpoTexto = texto;
  // O QR do quarto abre o WhatsApp com o código no texto: só na primeira mensagem.
  if (codigoQuarto && corpoTexto !== null) {
    corpoTexto = `${corpoTexto} (código #R-${codigoQuarto})`;
    codigoQuarto = undefined;
  }
  const mensagem: Record<string, unknown> = { from: de, id: `wamid.sim.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  if (extra.imagem) Object.assign(mensagem, { type: 'image', image: { ...midia(extra.imagem), caption: corpoTexto ?? undefined } });
  else if (extra.audio) Object.assign(mensagem, { type: 'audio', audio: { ...midia(extra.audio), voice: true } });
  else Object.assign(mensagem, { type: 'text', text: { body: corpoTexto ?? '' } });

  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'dev-waba-id',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: seed.canal.numero, phone_number_id: phoneNumberId },
              contacts: [{ wa_id: de, profile: { name: nome } }],
              messages: [mensagem],
            },
          },
        ],
      },
    ],
  });
  const assinatura = `sha256=${createHmac('sha256', segredo).update(payload).digest('hex')}`;
  const r = await fetch(`${api}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinatura },
    body: payload,
  });
  if (!r.ok) throw new Error(`webhook respondeu ${r.status}: ${await r.text()}`);
}

const vistas = new Set<string>();
let desde = new Date(Date.now() - 2000).toISOString();

async function aguardarRespostas(ms = 10_000) {
  const fim = Date.now() + ms;
  let ultimaNova = Date.now();
  while (Date.now() < fim) {
    await new Promise((r) => setTimeout(r, 700));
    const r = await fetch(`${api}/dev/saidas?phoneNumberId=${phoneNumberId}&telefone=${de}&desde=${encodeURIComponent(desde)}`);
    if (!r.ok) throw new Error(`/dev/saidas ${r.status} (a api está com META_DRY_RUN=true?)`);
    const saidas = (await r.json()) as { id: string; texto: string; autor_tipo: string; status_envio: string }[];
    for (const s of saidas) {
      if (vistas.has(s.id)) continue;
      vistas.add(s.id);
      ultimaNova = Date.now();
      const quem = s.autor_tipo === 'pessoa' ? 'equipe' : s.autor_tipo === 'ia' ? 'IA' : 'hotel';
      console.log(`  ← [${quem}${s.status_envio === 'falhou' ? ', FALHOU' : ''}] ${s.texto}`);
    }
    // Sem novidade há 3 s depois de alguma resposta: devolve o prompt.
    if (vistas.size > 0 && Date.now() - ultimaNova > 3000) break;
  }
}

async function main() {
  const texto = args.join(' ').trim();
  if (texto || imagem || audio) {
    console.log(`  → ${texto || (imagem ? '[foto]' : '[áudio]')}`);
    await enviar(texto || null, { imagem, audio });
    await aguardarRespostas();
    return;
  }
  console.log(`Simulando ${nome} (${de})${quarto ? `, quarto ${quarto}` : ''}. Linhas vazias saem; "/espera" só escuta.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const linha = (await rl.question('> ')).trim();
    if (!linha) break;
    if (linha === '/espera') {
      await aguardarRespostas(30_000);
      continue;
    }
    desde = new Date(Date.now() - 1000).toISOString();
    await enviar(linha);
    await aguardarRespostas();
  }
  rl.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
