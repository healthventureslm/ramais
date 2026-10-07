/**
 * Teste de carga ponta a ponta, contra a api e o worker rodando (com ou sem IA).
 *
 * Cria uma unidade nova ("Teste de carga …") na organização do seed, com equipe, quartos,
 * hóspedes e escada rápida, e simula:
 *   - hóspedes em 10 idiomas, pelo WhatsApp (webhook assinado, Meta em dry-run) e pelo chat do
 *     quarto, com texto, áudio (voz do Windows) e foto; respondem à identificação, agradecem,
 *     cobram quando demora e respondem a pesquisa de satisfação;
 *   - uma equipe-robô que aceita (ou deixa expirar), responde em português (às vezes com foto
 *     ou áudio), escreve nota interna, transfere quando a IA errou o setor, confirma a triagem,
 *     pede apoio, resolve, assume pela supervisão e troca mensagens diretas.
 *
 * No fim, grava um relatório com acerto do roteamento por idioma, traduções, transcrições,
 * tempos, escada e o gasto com IA (pelo registro do sistema e pela própria OpenRouter).
 *
 *   pnpm carga                       1000 mensagens em ~15 min
 *   pnpm carga -- --mensagens 50 --minutos 3
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import bcrypt from 'bcryptjs';
import { ConfigUnidade } from '@ramais/contracts';
import { carregarEnv, comTenant, criarPool } from '@ramais/db';
import { gerarCodigoLocal } from '@ramais/domain';
import { configHotel, conhecimentoHotelExemplo } from '@ramais/vertical-hotel';
import {
  AUDIOS_EQUIPE,
  AUDIOS_HOSPEDE,
  COBRANCA,
  DESTINOS,
  IDIOMAS,
  LEGENDAS_FOTO,
  OBRIGADO,
  PEDIDOS,
  RESPOSTAS,
  VAGOS,
  type Destino,
  type Idioma,
} from './roteiro.js';

carregarEnv();
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2).filter((a) => a !== '--');
const opc = (nome: string, padrao: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1]! : padrao;
};
const ALVO = Number(opc('mensagens', '1000'));
const MINUTOS = Number(opc('minutos', '15'));
const API = opc('api', `http://localhost:${process.env.PORTA ?? 3000}`);
const SEGREDO = process.env.META_APP_SECRET ?? 'segredo-dev-do-app';
const SENHA = 'ramais-dev-123';
const PIN = '123456';

const owner = criarPool(process.env.DATABASE_URL_OWNER!, 4);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const entre = (a: number, b: number) => a + Math.random() * (b - a);
const sorte = (p: number) => Math.random() < p;
const um = <T>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)]!;
function sortear<T>(pesos: [T, number][]): T {
  let x = Math.random() * pesos.reduce((s, [, p]) => s + p, 0);
  for (const [v, p] of pesos) if ((x -= p) <= 0) return v;
  return pesos[0]![0];
}
const agora = () => new Date().toLocaleTimeString('pt-BR');
const log = (...m: unknown[]) => console.log(`[${agora()}]`, ...m);

// ------------------------------------------------------------------
// Preparação: unidade nova na organização do seed
// ------------------------------------------------------------------

interface Preparo {
  k: string;
  orgId: string;
  unidadeId: string;
  unidadeNome: string;
  phoneNumberId: string;
  setores: Record<string, string>;
  pessoas: { email: string; nome: string; setor: string | null; papel: 'membro' | 'supervisor' | 'gerente' }[];
  quartos: { quarto: string; localId: string; codigo: string; sobrenome: string }[];
}

const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Smith', 'García', 'Müller', 'Rossi', 'Dubois', 'Tanaka', 'Wang', 'Haddad', 'Ivanov', 'Costa', 'Brown', 'López'];
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'João', 'Kátia', 'Lucas', 'Marta', 'Nina', 'Otávio', 'Paula', 'Rafa', 'Sara', 'Téo', 'Vera'];

async function preparar(): Promise<Preparo> {
  const seed = JSON.parse(readFileSync(join(raiz, '.dev', 'seed.json'), 'utf8')) as { orgId: string };
  const k = randomBytes(3).toString('hex');
  const unidadeNome = `Teste de carga ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  // Escada rápida para o teste caber em minutos, e pesquisa de satisfação no encerramento.
  const cfg = ConfigUnidade.parse({
    ...configHotel,
    escalonamento: {
      ofertaSegundos: 30,
      lembrarMin: 1,
      repassarMin: 3,
      avisoSolicitanteMin: 6,
      avisos: [
        { aposMin: 2, alvo: { tipo: 'supervisores' }, foraDoTurno: false },
        { aposMin: 5, alvo: { tipo: 'gerentes' }, foraDoTurno: false },
      ],
    },
    fluxo: {
      ...configHotel.fluxo,
      encerramento: [
        ...configHotel.fluxo.encerramento,
        {
          id: 'pesquisa',
          tipo: 'pesquisa',
          rotulo: 'Pesquisa de satisfação',
          pergunta: { pt: 'De 1 a 5, como foi o atendimento?', es: 'Del 1 al 5, ¿cómo fue la atención?', en: 'From 1 to 5, how was our service?' },
          agradecimento: { pt: 'Obrigado pela avaliação!', es: '¡Gracias por su evaluación!', en: 'Thank you for your rating!' },
          quando: [],
        },
      ],
    },
  });
  const senha = await bcrypt.hash(SENHA, 10);
  const pin = await bcrypt.hash(PIN, 10);
  return comTenant(owner, seed.orgId, async ({ client }) => {
    const u = await client.query<{ id: string }>(`INSERT INTO unidade (org_id, nome, qr_destino) VALUES ($1, $2, 'web') RETURNING id`, [seed.orgId, unidadeNome]);
    const unidadeId = u.rows[0]!.id;
    const j = await client.query<{ id: string }>('INSERT INTO jornada_versao (org_id, unidade_id, numero, config) VALUES ($1, $2, 1, $3) RETURNING id', [
      seed.orgId,
      unidadeId,
      JSON.stringify(cfg),
    ]);
    await client.query('UPDATE unidade SET jornada_versao_id = $2 WHERE id = $1', [unidadeId, j.rows[0]!.id]);
    const phoneNumberId = `carga-${k}`;
    await client.query(
      `INSERT INTO canal_whatsapp (org_id, unidade_id, phone_number_id, waba_id, numero_exibicao, modo_credencial, credencial_ref)
       VALUES ($1, $2, $3, 'carga', '+55 21 90000-0000', 'propria', 'META_TOKEN')`,
      [seed.orgId, unidadeId, phoneNumberId],
    );
    const setores: Record<string, string> = {};
    for (const s of cfg.setores) {
      // A IA encaminha sozinha; o Concierge fica em modo sombra para testar a triagem.
      const r = await client.query<{ id: string }>(
        'INSERT INTO setor (org_id, unidade_id, chave, nome, modo_ia) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [seed.orgId, unidadeId, s.chave, s.nome, s.chave === 'concierge' ? 'sombra' : 'automatico'],
      );
      setores[s.chave] = r.rows[0]!.id;
    }
    const pessoas: Preparo['pessoas'] = [];
    let n = 0;
    const criarPessoa = async (setor: string | null, papel: 'membro' | 'supervisor' | 'gerente') => {
      const nome = `${NOMES[n % NOMES.length]} ${setor ? cfg.setores.find((x) => x.chave === setor)!.nome : 'Gerência'}${papel === 'supervisor' ? ' (sup.)' : ''}`;
      const email = `carga${k}.${n++}@teste.dev`;
      const r = await client.query<{ id: string }>(
        'INSERT INTO pessoa (org_id, nome, email, senha_hash, pin_hash, idiomas, gerente) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [seed.orgId, nome, email, senha, pin, ['pt'], papel === 'gerente'],
      );
      if (setor) {
        await client.query('INSERT INTO lotacao (org_id, pessoa_id, setor_id, papel, recebe, limite_carga) VALUES ($1, $2, $3, $4, $5, $6)', [
          seed.orgId,
          r.rows[0]!.id,
          setores[setor],
          papel === 'supervisor' ? 'supervisor' : 'membro',
          papel === 'supervisor' ? 'ultimo_recurso' : 'sempre',
          8,
        ]);
      }
      pessoas.push({ email, nome, setor, papel });
    };
    const membros: Record<string, number> = { manutencao: 4, governanca: 4, recepcao: 3, alimentos_bebidas: 3, concierge: 2 };
    for (const [setor, qtd] of Object.entries(membros)) {
      for (let i = 0; i < qtd; i++) await criarPessoa(setor, 'membro');
      await criarPessoa(setor, 'supervisor');
    }
    await criarPessoa(null, 'gerente');

    const quartos: Preparo['quartos'] = [];
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const depois = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    for (let andar = 1; andar <= 8; andar++) {
      for (let q = 1; q <= 40; q++) {
        const quarto = `${andar}${String(q).padStart(2, '0')}`;
        const codigo = gerarCodigoLocal((t) => new Uint8Array(randomBytes(t)));
        const r = await client.query<{ id: string }>(
          `INSERT INTO local (org_id, unidade_id, tipo, identificador, codigo_qr) VALUES ($1, $2, 'quarto', $3, $4) RETURNING id`,
          [seed.orgId, unidadeId, quarto, codigo],
        );
        const sobrenome = um(SOBRENOMES);
        await client.query('INSERT INTO hospede_ativo (org_id, unidade_id, local_id, sobrenome, checkin, checkout) VALUES ($1, $2, $3, $4, $5, $6)', [
          seed.orgId,
          unidadeId,
          r.rows[0]!.id,
          sobrenome,
          ontem,
          depois,
        ]);
        quartos.push({ quarto, localId: r.rows[0]!.id, codigo, sobrenome });
      }
    }
    for (const it of conhecimentoHotelExemplo) {
      await client.query('INSERT INTO base_conhecimento (org_id, unidade_id, chave, pergunta, resposta, tags) VALUES ($1, $2, $3, $4, $5, $6)', [
        seed.orgId,
        unidadeId,
        it.id,
        it.pergunta,
        it.resposta,
        it.tags,
      ]);
    }
    return { k, orgId: seed.orgId, unidadeId, unidadeNome, phoneNumberId, setores, pessoas, quartos };
  });
}

// ------------------------------------------------------------------
// Mídia: falas gravadas com a voz do Windows e uma foto gerada
// ------------------------------------------------------------------

const DIR_MIDIA = join(raiz, '.dev', 'carga-midia');

function gerarFalas() {
  mkdirSync(DIR_MIDIA, { recursive: true });
  const falas = [
    ...AUDIOS_HOSPEDE.map((a, i) => ({ arquivo: `hospede-${i}.wav`, voz: a.idioma === 'pt' ? 'Microsoft Maria Desktop' : 'Microsoft Zira Desktop', texto: a.texto })),
    ...AUDIOS_EQUIPE.map((t, i) => ({ arquivo: `equipe-${i}.wav`, voz: 'Microsoft Maria Desktop', texto: t })),
  ].filter((f) => !existsSync(join(DIR_MIDIA, f.arquivo)));
  if (!falas.length) return true;
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
    ...falas.flatMap((f) => [
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      `try { $s.SelectVoice('${f.voz}') } catch {}`,
      `$s.SetOutputToWaveFile('${join(DIR_MIDIA, f.arquivo).replace(/'/g, "''")}', $fmt)`,
      `$s.Speak('${f.texto.replace(/'/g, "''")}')`,
      '$s.Dispose()',
    ]),
  ].join('; ');
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
    return true;
  } catch {
    log('sem voz do Windows: o teste segue sem áudios');
    return false;
  }
}

/** PNG simples (listras), sem dependências: o suficiente para a IA descrever e a equipe ver. */
function fotoPng(): Buffer {
  const w = 320;
  const h = 240;
  const linhas = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    linhas[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const mancha = (x - 200) ** 2 + (y - 90) ** 2 < 2500;
      linhas[o] = mancha ? 120 : 225;
      linhas[o + 1] = mancha ? 100 : 222 - (y >> 3);
      linhas[o + 2] = mancha ? 80 : 215;
    }
  }
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloco = (tipo: string, dados: Buffer) => {
    const t = Buffer.from(tipo);
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([tam, t, dados, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(linhas)), bloco('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------
// HTTP
// ------------------------------------------------------------------

const metricas = { http: 0, httpErros: 0, httpErrosPor: new Map<string, number>() };
/** Última vez que alguém (hóspede ou equipe) fez algo: o teste acaba quando fica tudo quieto. */
let ultimaAtividade = Date.now();

async function http<T = unknown>(metodo: string, caminho: string, corpo?: unknown, cab: Record<string, string> = {}): Promise<{ status: number; corpo: T }> {
  metricas.http++;
  try {
    const r = await fetch(API + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...cab },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    });
    const t = await r.text();
    if (r.status >= 500) {
      metricas.httpErros++;
      const chave = `${metodo} ${caminho.split('?')[0]!.replace(/[0-9a-f-]{36}/g, ':id')} ${r.status}`;
      metricas.httpErrosPor.set(chave, (metricas.httpErrosPor.get(chave) ?? 0) + 1);
    }
    return { status: r.status, corpo: (t ? JSON.parse(t) : null) as T };
  } catch (e) {
    metricas.httpErros++;
    const chave = `${metodo} ${caminho.split('?')[0]!.replace(/[0-9a-f-]{36}/g, ':id')} rede`;
    metricas.httpErrosPor.set(chave, (metricas.httpErrosPor.get(chave) ?? 0) + 1);
    return { status: 0, corpo: null as T };
  }
}

// ------------------------------------------------------------------
// Hóspedes
// ------------------------------------------------------------------

type TipoMsg = 'texto' | 'audio' | 'imagem';

interface Hospede {
  n: number;
  canal: 'whatsapp' | 'web';
  idioma: Idioma;
  destino: Destino;
  telefone: string;
  quarto: Preparo['quartos'][number];
  comQr: boolean;
  chatToken?: string;
  primeiroTipo: TipoMsg;
  vago: boolean;
  // estado
  ativo: boolean;
  inicio: number;
  enviadas: number;
  solicitacaoId?: string;
  daEquipeVistas: number;
  identificou: number;
  agradeceu: boolean;
  cobrou: boolean;
  avaliou: boolean;
  pendente: boolean;
}

const contagem = { hospede: 0, porTipo: { texto: 0, audio: 0, imagem: 0 } as Record<TipoMsg, number>, porCanal: { whatsapp: 0, web: 0 } };
const hospedes: Hospede[] = [];
let P: Preparo;
let temAudio = true;
const FOTO = fotoPng();

function textoDe(destino: Destino, idioma: Idioma): { idioma: Idioma; texto: string } {
  const l = PEDIDOS[destino][idioma];
  if (l?.length) return { idioma, texto: um(l) };
  // Sem frase naquele idioma para o destino: usa inglês (o hóspede estrangeiro escreve em inglês).
  return { idioma: 'en', texto: um(PEDIDOS[destino].en ?? PEDIDOS[destino].pt!) };
}

async function enviarHospede(h: Hospede, m: { tipo: TipoMsg; texto?: string | null; audio?: Buffer; foto?: Buffer }) {
  ultimaAtividade = Date.now();
  h.enviadas++;
  contagem.hospede++;
  contagem.porTipo[m.tipo]++;
  contagem.porCanal[h.canal]++;
  if (h.canal === 'web') {
    const id = randomUUID();
    if (!h.chatToken) {
      const s = await http<{ token: string }>('POST', '/chat/sessao', { codigo: h.quarto.codigo, idioma: h.idioma });
      h.chatToken = s.corpo?.token;
    }
    const cab = { 'x-chat': h.chatToken ?? '' };
    if (m.tipo === 'texto') return http('POST', '/chat/mensagens', { id, texto: m.texto }, cab);
    const arquivo = m.tipo === 'audio' ? { mime: 'audio/wav', dados: m.audio! } : { mime: 'image/png', dados: m.foto! };
    return http('POST', '/chat/midia', { id, tipo: m.tipo, mime: arquivo.mime, base64: arquivo.dados.toString('base64'), legenda: m.texto ?? undefined }, cab);
  }
  // WhatsApp: webhook assinado como a Meta assina. Mídia em dry-run vai como data URL no "id".
  let corpo = m.texto ?? null;
  if (h.comQr && h.enviadas === 1 && corpo !== null && m.tipo === 'texto') corpo = `${corpo} (código #R-${h.quarto.codigo})`;
  const mensagem: Record<string, unknown> = { from: h.telefone, id: `wamid.carga.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  if (m.tipo === 'audio') Object.assign(mensagem, { type: 'audio', audio: { id: `data:audio/wav;base64,${m.audio!.toString('base64')}`, mime_type: 'audio/wav', voice: true } });
  else if (m.tipo === 'imagem') Object.assign(mensagem, { type: 'image', image: { id: `data:image/png;base64,${m.foto!.toString('base64')}`, mime_type: 'image/png', caption: corpo ?? undefined } });
  else Object.assign(mensagem, { type: 'text', text: { body: corpo ?? '' } });
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'carga',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '+5521900000000', phone_number_id: P.phoneNumberId },
              contacts: [{ wa_id: h.telefone, profile: { name: `${um(NOMES)} ${h.quarto.sobrenome}` } }],
              messages: [mensagem],
            },
          },
        ],
      },
    ],
  });
  metricas.http++;
  const r = await fetch(`${API}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', SEGREDO).update(payload).digest('hex')}` },
    body: payload,
  }).catch(() => null);
  if (!r || r.status !== 200) metricas.httpErros++;
}

async function iniciarHospede(n: number) {
  const canal = sorte(0.55) ? 'whatsapp' : 'web';
  const idioma = sortear(IDIOMAS);
  const destino = sortear(DESTINOS);
  // Quartos do chat web são exclusivos (a conversa é do quarto); os do WhatsApp podem repetir.
  const livres = P.quartos.filter((q) => !hospedes.some((x) => x.canal === 'web' && x.quarto.localId === q.localId));
  const quarto = canal === 'web' && livres.length ? um(livres) : um(P.quartos);
  const h: Hospede = {
    n,
    canal,
    idioma,
    destino,
    telefone: canal === 'web' ? `quarto:${quarto.localId}` : `55219${String(70000000 + n).padStart(8, '0')}`,
    quarto,
    comQr: canal === 'whatsapp' && sorte(0.5),
    primeiroTipo: 'texto',
    vago: destino !== 'emergencia' && sorte(0.08),
    ativo: true,
    inicio: Date.now(),
    enviadas: 0,
    daEquipeVistas: 0,
    identificou: 0,
    agradeceu: false,
    cobrou: false,
    avaliou: false,
    pendente: false,
  };
  hospedes.push(h);
  if (h.vago) {
    await enviarHospede(h, { tipo: 'texto', texto: um(VAGOS[idioma] ?? VAGOS.en!) });
    await esperar(entre(4000, 12_000));
  }
  // Áudio (pt/en, com a fala do mesmo setor), foto da manutenção com legenda, ou texto.
  const falas = AUDIOS_HOSPEDE.map((a, i) => ({ ...a, i })).filter((a) => a.destino === destino && (a.idioma === idioma || (idioma !== 'pt' && a.idioma === 'en')));
  if (temAudio && falas.length && sorte(0.12)) {
    const f = um(falas);
    h.primeiroTipo = 'audio';
    h.idioma = f.idioma;
    await enviarHospede(h, { tipo: 'audio', audio: readFileSync(join(DIR_MIDIA, `hospede-${f.i}.wav`)) });
  } else if (destino === 'manutencao' && sorte(0.12)) {
    h.primeiroTipo = 'imagem';
    const leg = LEGENDAS_FOTO[idioma] ?? LEGENDAS_FOTO.en!;
    const t = textoDe('manutencao', idioma);
    await enviarHospede(h, { tipo: 'imagem', foto: FOTO, texto: `${t.texto}. ${um(leg)}` });
  } else {
    const t = textoDe(destino, idioma);
    h.idioma = t.idioma;
    await enviarHospede(h, { tipo: 'texto', texto: t.texto });
  }
}

interface EstadoConversa {
  telefone: string;
  id: string;
  estado: string;
  contexto: Record<string, unknown>;
  setor: string | null;
  da_equipe: number;
  ultima_hospede: Date | null;
}

/** Hóspedes reagem ao que acontece na conversa (lido do banco, como o celular deles veria). */
async function reagirHospedes() {
  const ativos = hospedes.filter((h) => h.ativo && !h.pendente);
  if (!ativos.length) return;
  const r = await comTenant(owner, P.orgId, ({ client }) =>
    client.query<EstadoConversa>(
      `SELECT DISTINCT ON (st.telefone) st.telefone, s.id, s.estado, s.contexto, sc.chave AS setor,
              (SELECT count(*) FROM mensagem m WHERE m.solicitacao_id = s.id AND m.autor_tipo = 'pessoa' AND m.visibilidade = 'externa'
                  AND m.status_envio IN ('enviada', 'entregue', 'lida'))::int AS da_equipe,
              (SELECT max(m.criado_em) FROM mensagem m WHERE m.solicitacao_id = s.id AND m.autor_tipo = 'solicitante') AS ultima_hospede
         FROM solicitacao s JOIN solicitante st ON st.id = s.solicitante_id LEFT JOIN setor sc ON sc.id = s.setor_id
        WHERE s.unidade_id = $1 AND st.telefone = ANY($2)
        ORDER BY st.telefone, s.criado_em DESC`,
      [P.unidadeId, ativos.map((h) => h.telefone)],
    ),
  );
  const porTel = new Map(r.rows.map((x) => [x.telefone, x]));
  for (const h of ativos) {
    const c = porTel.get(h.telefone);
    if (!c) continue;
    h.solicitacaoId = c.id;
    const ctx = c.contexto as { aguardandoIdentificacao?: boolean; coletaPendente?: { campo: string } | null; pesquisa?: unknown };
    const agir = (fn: () => Promise<unknown>, atraso: [number, number]) => {
      h.pendente = true;
      void esperar(entre(...atraso))
        .then(fn)
        .finally(() => (h.pendente = false));
    };
    // Identificação pedida (quarto e sobrenome): responde, no máximo duas vezes.
    const pedeQuarto = ctx.aguardandoIdentificacao || (ctx.coletaPendente && /quarto|sobrenome/.test(ctx.coletaPendente.campo));
    if (pedeQuarto && h.identificou < 2) {
      h.identificou++;
      agir(() => enviarHospede(h, { tipo: 'texto', texto: `${h.quarto.quarto} ${h.quarto.sobrenome}` }), [3000, 9000]);
      continue;
    }
    if (ctx.pesquisa && c.estado === 'resolvida' && !h.avaliou) {
      h.avaliou = true;
      if (sorte(0.75)) agir(() => enviarHospede(h, { tipo: 'texto', texto: String(sortear<number>([[5, 52], [4, 28], [3, 12], [2, 5], [1, 3]])) }), [4000, 15_000]);
      continue;
    }
    if (c.da_equipe > h.daEquipeVistas) {
      h.daEquipeVistas = c.da_equipe;
      if (!h.agradeceu && sorte(0.6)) {
        h.agradeceu = true;
        agir(() => enviarHospede(h, { tipo: 'texto', texto: um(OBRIGADO[h.idioma]) }), [5000, 25_000]);
        continue;
      }
    }
    const esperando = ['na_fila', 'oferecida', 'em_atendimento'].includes(c.estado) && c.da_equipe === 0;
    if (esperando && !h.cobrou && c.ultima_hospede && Date.now() - new Date(c.ultima_hospede).getTime() > 150_000 && sorte(0.5)) {
      h.cobrou = true;
      agir(() => enviarHospede(h, { tipo: 'texto', texto: um(COBRANCA[h.idioma] ?? COBRANCA.en!) }), [1000, 3000]);
      continue;
    }
    const acabou = ['resolvida', 'encerrada', 'cancelada'].includes(c.estado) && (h.avaliou || !ctx.pesquisa);
    // Parada há 2 min sem ninguém da equipe envolvido (ex.: sem IA, a automação não sabe responder).
    const parada = c.estado === 'automacao' && c.ultima_hospede && Date.now() - new Date(c.ultima_hospede).getTime() > 120_000;
    if (acabou || parada || Date.now() - h.inicio > 25 * 60_000) h.ativo = false;
  }
}

// ------------------------------------------------------------------
// Equipe
// ------------------------------------------------------------------

interface Atendente {
  email: string;
  nome: string;
  setor: string | null;
  papel: 'membro' | 'supervisor' | 'gerente';
  ritmo: 'rapido' | 'normal' | 'lento';
  token: string;
  id: string;
  vistas: Set<string>;
  agendado: Set<string>;
  respostas: Map<string, number>;
  transferidas: Set<string>;
  resolvendo: Set<string>;
  assumidas: Set<string>;
  triadas: Set<string>;
}

const acoesEquipe = {
  aceites: 0,
  ignoradas: 0,
  respostas: 0,
  fotos: 0,
  audios: 0,
  notas: 0,
  transferencias: 0,
  apoios: 0,
  resolvidos: 0,
  assumidos: 0,
  triagens: 0,
  diretas: 0,
  cientes: 0,
};
const equipe: Atendente[] = [];
let rodando = true;

const ATRASO: Record<Atendente['ritmo'], { aceite: [number, number]; aceita: number; resposta: [number, number] }> = {
  rapido: { aceite: [2000, 9000], aceita: 0.97, resposta: [5000, 20_000] },
  normal: { aceite: [4000, 20_000], aceita: 0.92, resposta: [10_000, 45_000] },
  // O lento às vezes passa do lembrete (1 min) e de "passar adiante" (3 min): exercita a escada.
  lento: { aceite: [15_000, 40_000], aceita: 0.65, resposta: [40_000, 220_000] },
};

const destinoDe = (solicitanteTel: string | undefined) => hospedes.find((h) => h.telefone === solicitanteTel);

async function loopAtendente(a: Atendente) {
  const cab = () => ({ authorization: `Bearer ${a.token}` });
  while (rodando) {
    await esperar(entre(2000, 3500));
    if (a.papel === 'gerente') continue;
    // Ofertas: aceita (ou deixa expirar) com o ritmo da pessoa.
    const of = await http<{ ofertaId: string; solicitacaoId: string }[]>('GET', '/ofertas', undefined, cab());
    for (const o of of.corpo ?? []) {
      if (a.vistas.has(o.ofertaId)) continue;
      a.vistas.add(o.ofertaId);
      if (!sorte(ATRASO[a.ritmo].aceita)) {
        acoesEquipe.ignoradas++;
        continue;
      }
      void esperar(entre(...ATRASO[a.ritmo].aceite)).then(async () => {
        const r = await http('POST', `/ofertas/${o.ofertaId}/aceitar`, undefined, cab());
        if (r.status === 200) acoesEquipe.aceites++;
      });
    }
    // Triagem (modo sombra): quem está na Recepção confirma a sugestão ou corrige.
    if (a.setor === 'recepcao') {
      const lista = await http<{ id: string; triagem: { setorSugerido: { id: string } } | null; solicitante: { telefone: string } | null }[]>(
        'GET',
        `/solicitacoes?filtro=setores&unidadeId=${P.unidadeId}`,
        undefined,
        cab(),
      );
      for (const s of (lista.corpo ?? []).filter((x) => x.triagem && !a.triadas.has(x.id))) {
        a.triadas.add(s.id);
        const h = destinoDe(s.solicitante?.telefone);
        const certo = h && P.setores[h.destino] ? P.setores[h.destino]! : s.triagem!.setorSugerido.id;
        void esperar(entre(3000, 15_000)).then(async () => {
          const r = await http('POST', `/solicitacoes/${s.id}/triagem`, { setorId: certo }, cab());
          if (r.status < 300) acoesEquipe.triagens++;
        });
      }
    }
    // Supervisão: assume conversa do setor com hóspede esperando resposta há mais de 100 s.
    if (a.papel === 'supervisor') {
      const d = await http<{ emAtendimento: { solicitacaoId: string; setorId: string | null; responsavel: { id: string }; esperandoRespostaSeg: number | null }[] }>(
        'GET',
        `/dashboard?unidadeId=${P.unidadeId}`,
        undefined,
        cab(),
      );
      for (const l of d.corpo?.emAtendimento ?? []) {
        if (l.setorId !== P.setores[a.setor!] || l.responsavel.id === a.id || (l.esperandoRespostaSeg ?? 0) < 100 || a.assumidas.has(l.solicitacaoId)) continue;
        a.assumidas.add(l.solicitacaoId);
        if (sorte(0.6)) {
          const r = await http('POST', `/solicitacoes/${l.solicitacaoId}/assumir`, undefined, cab());
          if (r.status === 200) acoesEquipe.assumidos++;
        }
      }
    }
    // Minhas conversas: responde, transfere se a IA errou o setor, resolve.
    const minhas = await http<{ id: string; estado: string; setor: { id: string } | null; solicitante: { telefone: string } | null; origem: string }[]>(
      'GET',
      `/solicitacoes?filtro=minhas&unidadeId=${P.unidadeId}`,
      undefined,
      cab(),
    );
    for (const s of minhas.corpo ?? []) {
      if (!['em_atendimento', 'aguardando_solicitante'].includes(s.estado) || a.agendado.has(s.id)) continue;
      const h = destinoDe(s.solicitante?.telefone);
      // A IA mandou para o setor errado: corrige (vira dado de calibração).
      const certo = h && P.setores[h.destino];
      if (certo && s.setor?.id !== certo && !a.transferidas.has(s.id) && sorte(0.85)) {
        a.transferidas.add(s.id);
        a.agendado.add(s.id);
        void esperar(entre(4000, 15_000))
          .then(() => http('POST', `/solicitacoes/${s.id}/transferir`, { setorId: certo, motivo: 'Não é do nosso setor', correcao: true }, cab()))
          .then((r) => r.status < 300 && acoesEquipe.transferencias++)
          .finally(() => a.agendado.delete(s.id));
        continue;
      }
      if (s.origem !== 'externa') {
        // Pedido de apoio de outro setor: resolve depois de um tempo.
        a.agendado.add(s.id);
        void esperar(entre(20_000, 60_000))
          .then(() => http('POST', `/solicitacoes/${s.id}/resolver`, undefined, cab()))
          .then((r) => r.status < 300 && acoesEquipe.resolvidos++);
        continue;
      }
      const det = await http<{ mensagens: { autorTipo: string; visibilidade: string; criadoEm: string }[] }>('GET', `/solicitacoes/${s.id}`, undefined, cab());
      const externas = (det.corpo?.mensagens ?? []).filter((m) => m.visibilidade === 'externa');
      // Precisa de resposta: o hóspede falou depois da última resposta de alguém da equipe
      // (as automáticas do sistema não contam como resposta).
      const ultimaDoHospede = externas.map((m) => m.autorTipo).lastIndexOf('solicitante');
      const ultimaDaEquipe = externas.map((m) => m.autorTipo).lastIndexOf('pessoa');
      const respondidas = a.respostas.get(s.id) ?? 0;
      if (ultimaDoHospede > ultimaDaEquipe && respondidas < 3) {
        a.agendado.add(s.id);
        void esperar(entre(...ATRASO[a.ritmo].resposta))
          .then(() => responder(a, s.id, h))
          .finally(() => a.agendado.delete(s.id));
      } else if (respondidas > 0 && !a.resolvendo.has(s.id)) {
        // Já respondeu: resolve depois de um tempo (o hóspede ainda pode agradecer antes).
        a.resolvendo.add(s.id);
        a.agendado.add(s.id);
        void esperar(entre(25_000, 70_000))
          .then(() => http('POST', `/solicitacoes/${s.id}/resolver`, undefined, cab()))
          .then((r) => r.status < 300 && acoesEquipe.resolvidos++)
          .finally(() => a.agendado.delete(s.id));
      }
    }
  }
}

async function responder(a: Atendente, id: string, h: Hospede | undefined) {
  const cab = { authorization: `Bearer ${a.token}` };
  const setor = (h && h.destino in RESPOSTAS ? h.destino : a.setor ?? 'recepcao') as keyof typeof RESPOSTAS;
  if (sorte(0.1)) {
    const sup = equipe.find((x) => x.setor === a.setor && x.papel === 'supervisor');
    const r = await http('POST', `/solicitacoes/${id}/mensagens`, { texto: `@${sup?.nome.split(' ')[0] ?? 'equipe'} vou precisar de ajuda com este`, visibilidade: 'interna' }, cab);
    if (r.status < 300) acoesEquipe.notas++;
  }
  if (a.setor === 'manutencao' && sorte(0.04)) {
    const r = await http('POST', `/solicitacoes/${id}/apoio`, { setorId: P.setores.governanca, texto: 'Depois do reparo, precisa de limpeza no banheiro.' }, cab);
    if (r.status < 300) acoesEquipe.apoios++;
  }
  const x = Math.random();
  let r: { status: number };
  if (x < 0.07 && temAudio) {
    r = await http('POST', `/solicitacoes/${id}/midia`, { tipo: 'audio', mime: 'audio/wav', base64: readFileSync(join(DIR_MIDIA, `equipe-${Math.floor(Math.random() * AUDIOS_EQUIPE.length)}.wav`)).toString('base64'), visibilidade: 'externa' }, cab);
    if (r.status < 300) acoesEquipe.audios++;
  } else if (x < 0.13) {
    r = await http('POST', `/solicitacoes/${id}/midia`, { tipo: 'imagem', mime: 'image/png', base64: FOTO.toString('base64'), legenda: 'Segue a foto de como ficou.', visibilidade: 'externa' }, cab);
    if (r.status < 300) acoesEquipe.fotos++;
  } else {
    r = await http('POST', `/solicitacoes/${id}/mensagens`, { texto: um(RESPOSTAS[setor]), visibilidade: 'externa' }, cab);
  }
  if (r.status < 300) {
    ultimaAtividade = Date.now();
    acoesEquipe.respostas++;
    a.respostas.set(id, (a.respostas.get(id) ?? 0) + 1);
  }
}

/** Mensagens diretas entre a equipe, algumas urgentes, uma ou outra em áudio. */
async function loopDiretas() {
  while (rodando) {
    await esperar(entre(20_000, 45_000));
    const de = um(equipe);
    const para = um(equipe.filter((x) => x !== de));
    const urgente = sorte(0.2);
    const cab = { authorization: `Bearer ${de.token}` };
    const r =
      temAudio && sorte(0.15)
        ? await http('POST', '/diretas/midia', { paraPessoaId: para.id, tipo: 'audio', mime: 'audio/wav', base64: readFileSync(join(DIR_MIDIA, 'equipe-1.wav')).toString('base64'), urgente }, cab)
        : await http('POST', '/diretas', { paraPessoaId: para.id, texto: urgente ? 'Urgente: preciso de você no lobby agora' : 'Consegue me cobrir no próximo pedido?', urgente }, cab);
    if (r.status < 300) acoesEquipe.diretas++;
  }
}

async function loopCiente() {
  while (rodando) {
    await esperar(15_000);
    for (const a of equipe) {
      const l = await http<{ id: string; urgentes_pendentes: number }[]>('GET', '/diretas', undefined, { authorization: `Bearer ${a.token}` });
      for (const c of (l.corpo ?? []).filter((x) => x.urgentes_pendentes > 0)) {
        const msgs = await http<{ id: string; urgente: boolean; ciente_em: string | null; autor_id: string }[]>('GET', `/diretas/${c.id}`, undefined, { authorization: `Bearer ${a.token}` });
        for (const m of (msgs.corpo ?? []).filter((x) => x.urgente && !x.ciente_em && x.autor_id !== a.id)) {
          const r = await http('POST', `/diretas/mensagens/${m.id}/ciente`, undefined, { authorization: `Bearer ${a.token}` });
          if (r.status < 300) acoesEquipe.cientes++;
        }
      }
    }
  }
}

// ------------------------------------------------------------------
// Gasto pela OpenRouter (a chave nunca é impressa)
// ------------------------------------------------------------------

async function gastoOpenRouter(): Promise<number | null> {
  const chave = process.env.OPENROUTER_API_KEY;
  if (!chave) return null;
  for (const url of ['https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/auth/key']) {
    try {
      const r = await fetch(url, { headers: { authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: { usage?: number } };
      if (typeof j.data?.usage === 'number') return j.data.usage;
    } catch {
      // tenta o outro endereço
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Relatório
// ------------------------------------------------------------------

const q = <T = Record<string, any>>(sql: string, p: unknown[] = []) => comTenant(owner, P.orgId, ({ client }) => client.query(sql, p)).then((r) => r.rows as T[]);
const pc = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seg = (v: unknown) => (v === null || v === undefined ? '—' : Number(v) < 90 ? `${Math.round(Number(v))} s` : `${(Number(v) / 60).toFixed(1)} min`);
const usd = (v: number) => `US$ ${v.toFixed(4)}`;

async function relatorio(inicio: Date, fim: Date, gastoAntes: number | null, gastoDepois: number | null) {
  const U = P.unidadeId;
  const [sol] = await q(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE origem = 'externa')::int AS externas, count(*) FILTER (WHERE origem = 'interna')::int AS apoios,
            count(*) FILTER (WHERE resolvida_em IS NOT NULL)::int AS resolvidas,
            count(*) FILTER (WHERE estado IN ('automacao','na_fila','oferecida','em_atendimento','aguardando_solicitante'))::int AS abertas,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM primeira_resposta_em - criado_em)) FILTER (WHERE primeira_resposta_em IS NOT NULL) AS p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM primeira_resposta_em - criado_em)) FILTER (WHERE primeira_resposta_em IS NOT NULL) AS p90,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolvida_em - criado_em)) FILTER (WHERE resolvida_em IS NOT NULL) AS res50,
            count(*) FILTER (WHERE supervisor_notificado_em IS NOT NULL)::int AS escaladas
       FROM solicitacao WHERE unidade_id = $1`,
    [U],
  );
  const [msg] = await q(
    `SELECT count(*) FILTER (WHERE m.autor_tipo = 'solicitante')::int AS do_hospede,
            count(*) FILTER (WHERE m.autor_tipo = 'pessoa' AND m.visibilidade = 'externa')::int AS equipe,
            count(*) FILTER (WHERE m.autor_tipo IN ('ia','sistema') AND m.visibilidade = 'externa')::int AS automaticas,
            count(*) FILTER (WHERE m.status_envio = 'falhou')::int AS falharam,
            count(*) FILTER (WHERE m.status_envio = 'pendente')::int AS pendentes
       FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id WHERE s.unidade_id = $1`,
    [U],
  );
  // Acerto do roteamento: a primeira decisão da IA em cada conversa contra o setor esperado.
  const decisoes = await q<{ telefone: string; setor: string | null; acao: string; confianca: number | null; resumo: string | null; automatica: boolean; idioma: string }>(
    `SELECT DISTINCT ON (s.id) st.telefone, d.setor_escolhido AS setor, d.acao, d.confianca, s.resumo, s.idioma,
            EXISTS (SELECT 1 FROM evento e WHERE e.solicitacao_id = s.id AND e.tipo = 'resposta_automatica') AS automatica
       FROM solicitacao s JOIN solicitante st ON st.id = s.solicitante_id
       LEFT JOIN decisao_ia d ON d.solicitacao_id = s.id AND d.setor_escolhido NOT IN ('vago', 'nenhum')
      WHERE s.unidade_id = $1 AND s.origem = 'externa'
      ORDER BY s.id, d.criado_em`,
    [U],
  );
  const porIdioma = new Map<string, { ok: number; n: number }>();
  const porDestino = new Map<string, { ok: number; n: number }>();
  let idiomaCerto = 0;
  let idiomaN = 0;
  for (const d of decisoes) {
    const h = hospedes.find((x) => x.telefone === d.telefone);
    if (!h) continue;
    const ok =
      h.destino === 'base' ? d.automatica : h.destino === 'emergencia' ? (d.resumo ?? '').startsWith('EMERGÊNCIA') : d.setor === h.destino;
    for (const [mapa, chave] of [[porIdioma, h.idioma], [porDestino, h.destino]] as const) {
      const v = mapa.get(chave) ?? { ok: 0, n: 0 };
      v.n++;
      if (ok) v.ok++;
      mapa.set(chave, v);
    }
    idiomaN++;
    if (d.idioma === h.idioma) idiomaCerto++;
  }
  const traducoes = (
    await q(
      `SELECT count(*) FILTER (WHERE m.autor_tipo = 'solicitante' AND s.idioma <> 'pt' AND (m.texto IS NOT NULL OR m.tipo = 'audio'))::int AS hospede_estrangeiro,
              count(*) FILTER (WHERE m.autor_tipo = 'solicitante' AND s.idioma <> 'pt' AND (m.texto IS NOT NULL OR m.tipo = 'audio')
                AND EXISTS (SELECT 1 FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma = 'pt'))::int AS traduzidas_pt,
              count(*) FILTER (WHERE m.autor_tipo = 'pessoa' AND m.visibilidade = 'externa' AND s.idioma <> 'pt' AND m.status_envio = 'enviada' AND m.tipo = 'texto')::int AS equipe_estrangeiro,
              count(*) FILTER (WHERE m.autor_tipo = 'pessoa' AND m.visibilidade = 'externa' AND s.idioma <> 'pt' AND m.status_envio = 'enviada' AND m.tipo = 'texto'
                AND EXISTS (SELECT 1 FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'traducao' AND d.idioma = s.idioma))::int AS equipe_traduzidas,
              count(*) FILTER (WHERE m.tipo = 'audio')::int AS audios,
              count(*) FILTER (WHERE m.tipo = 'audio' AND EXISTS (SELECT 1 FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'transcricao'))::int AS transcritos,
              count(*) FILTER (WHERE m.tipo = 'imagem' AND m.autor_tipo = 'solicitante')::int AS fotos,
              count(*) FILTER (WHERE m.tipo = 'imagem' AND m.autor_tipo = 'solicitante' AND EXISTS (SELECT 1 FROM mensagem_derivado d WHERE d.mensagem_id = m.id AND d.tipo = 'descricao'))::int AS descritas
         FROM mensagem m JOIN solicitacao s ON s.id = m.solicitacao_id WHERE s.unidade_id = $1`,
      [U],
    )
  )[0]!;
  const eventos = await q<{ tipo: string; n: number }>(
    `SELECT e.tipo, count(*)::int AS n FROM evento e JOIN solicitacao s ON s.id = e.solicitacao_id WHERE s.unidade_id = $1 GROUP BY 1 ORDER BY 2 DESC`,
    [U],
  );
  const ev = (t: string) => eventos.find((x) => x.tipo === t)?.n ?? 0;
  const [ofertas] = await q(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE o.resultado = 'aceita')::int AS aceitas, count(*) FILTER (WHERE o.resultado = 'expirada')::int AS expiradas,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM o.respondida_em - o.ofertada_em)) FILTER (WHERE o.resultado = 'aceita') AS aceite50
       FROM oferta o JOIN solicitacao s ON s.id = o.solicitacao_id WHERE s.unidade_id = $1`,
    [U],
  );
  const [notas] = await q(
    `SELECT count(*)::int AS n, avg((e.dados->>'nota')::int) AS media FROM evento e JOIN solicitacao s ON s.id = e.solicitacao_id
      WHERE s.unidade_id = $1 AND e.tipo = 'pesquisa_respondida'`,
    [U],
  );
  const [diretas] = await q(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE m.urgente)::int AS urgentes, count(*) FILTER (WHERE m.urgente AND m.ciente_em IS NOT NULL)::int AS cientes,
            count(*) FILTER (WHERE m.tipo = 'audio')::int AS audios, count(*) FILTER (WHERE m.tipo = 'audio' AND m.transcricao IS NOT NULL)::int AS transcritos
       FROM mensagem_interna m JOIN conversa_interna c ON c.id = m.conversa_id WHERE c.unidade_id = $1 AND m.criado_em >= $2`,
    [U, inicio],
  );
  const uso = await q<{ tarefa: string; chamadas: number; falhas: number; usd: string | null; tokens: number; latencia: number | null }>(
    `SELECT u.tarefa, count(*)::int AS chamadas, count(*) FILTER (WHERE NOT u.ok)::int AS falhas, sum(u.custo_usd) AS usd,
            sum(u.tokens_entrada + u.tokens_saida)::int AS tokens, avg(u.latencia_ms) FILTER (WHERE u.ok) AS latencia
       FROM uso_ia u LEFT JOIN solicitacao s ON s.id = u.solicitacao_id
      WHERE (u.unidade_id = $1 OR s.unidade_id = $1 OR (u.unidade_id IS NULL AND u.solicitacao_id IS NULL)) AND u.criado_em >= $2 AND u.criado_em <= $3
      GROUP BY 1 ORDER BY sum(u.custo_usd) DESC NULLS LAST`,
    [U, inicio, new Date(fim.getTime() + 60_000)],
  );
  const modelos = await q<{ modelo: string; chamadas: number; usd: string | null }>(
    `SELECT u.modelo, count(*)::int AS chamadas, sum(u.custo_usd) AS usd
       FROM uso_ia u LEFT JOIN solicitacao s ON s.id = u.solicitacao_id
      WHERE (u.unidade_id = $1 OR s.unidade_id = $1 OR (u.unidade_id IS NULL AND u.solicitacao_id IS NULL)) AND u.criado_em >= $2 AND u.criado_em <= $3
      GROUP BY 1 ORDER BY sum(u.custo_usd) DESC NULLS LAST`,
    [U, inicio, new Date(fim.getTime() + 60_000)],
  );
  const custoSistema = uso.reduce((s, x) => s + Number(x.usd ?? 0), 0);
  const custoOpenRouter = gastoAntes !== null && gastoDepois !== null ? gastoDepois - gastoAntes : null;
  const falhasFila = await owner
    .query<{ name: string; n: number }>(`SELECT name, count(*)::int AS n FROM pgboss.job WHERE state = 'failed' AND created_on >= $1 GROUP BY 1`, [inicio])
    .then((r) => r.rows)
    .catch(() => []);
  const minutos = (fim.getTime() - inicio.getTime()) / 60_000;

  const linhas: string[] = [];
  const L = (s = '') => linhas.push(s);
  L(`# Teste de carga · ${P.unidadeNome}`);
  L();
  L(`- Duração: **${minutos.toFixed(1)} min** · ${contagem.hospede} mensagens de hóspedes enviadas (${(contagem.hospede / minutos).toFixed(0)}/min) · ${hospedes.length} hóspedes`);
  L(`- Canais: WhatsApp ${contagem.porCanal.whatsapp} · chat do quarto ${contagem.porCanal.web} · texto ${contagem.porTipo.texto}, áudio ${contagem.porTipo.audio}, foto ${contagem.porTipo.imagem}`);
  L(`- No banco: ${msg!.do_hospede} mensagens de hóspedes (${msg!.do_hospede === contagem.hospede ? 'nenhuma perdida' : `diferença de ${contagem.hospede - msg!.do_hospede}`}) · ${msg!.equipe} respostas da equipe · ${msg!.automaticas} automáticas · ${msg!.falharam} não entregues · ${msg!.pendentes} ainda pendentes`);
  L(`- IA: ${process.env.OPENROUTER_API_KEY ? 'ligada' : 'desligada (regras)'}`);
  L();
  L('## Custo da IA');
  L();
  L(`- Registrado pelo sistema: **${usd(custoSistema)}** em ${uso.reduce((s, x) => s + x.chamadas, 0)} chamadas`);
  L(`- Pela OpenRouter (uso da chave antes e depois): **${custoOpenRouter === null ? 'indisponível' : usd(custoOpenRouter)}**`);
  L(`- Por mensagem de hóspede: ${usd(custoSistema / Math.max(1, contagem.hospede))} · por pedido: ${usd(custoSistema / Math.max(1, sol!.externas))} · projeção para 1000 mensagens: ${usd((custoSistema / Math.max(1, contagem.hospede)) * 1000)}`);
  L();
  L('| Tarefa | Chamadas | Falhas | Tokens | Tempo médio | Custo |');
  L('|---|---:|---:|---:|---:|---:|');
  for (const u of uso) L(`| ${u.tarefa} | ${u.chamadas} | ${u.falhas} | ${u.tokens ?? 0} | ${u.latencia === null ? '—' : `${(Number(u.latencia) / 1000).toFixed(1)} s`} | ${usd(Number(u.usd ?? 0))} |`);
  L();
  L('| Modelo | Chamadas | Custo |');
  L('|---|---:|---:|');
  for (const m of modelos) L(`| ${m.modelo} | ${m.chamadas} | ${usd(Number(m.usd ?? 0))} |`);
  L();
  L('## Roteamento (primeira decisão da IA contra o setor esperado)');
  L();
  const tot = [...porDestino.values()].reduce((s, v) => ({ ok: s.ok + v.ok, n: s.n + v.n }), { ok: 0, n: 0 });
  L(`- Acerto geral: **${pc(tot.ok, tot.n)}** (${tot.ok}/${tot.n}) · idioma detectado certo: ${pc(idiomaCerto, idiomaN)}`);
  L();
  L('| Destino esperado | Acerto |');
  L('|---|---:|');
  for (const [k, v] of porDestino) L(`| ${k} | ${pc(v.ok, v.n)} (${v.ok}/${v.n}) |`);
  L();
  L('| Idioma | Acerto |');
  L('|---|---:|');
  for (const [k, v] of [...porIdioma].sort((a, b) => b[1].n - a[1].n)) L(`| ${k} | ${pc(v.ok, v.n)} (${v.ok}/${v.n}) |`);
  L();
  L('## Funcionalidades');
  L();
  L(`- Tradução para a equipe (hóspede em outro idioma → português): ${pc(traducoes.traduzidas_pt, traducoes.hospede_estrangeiro)}`);
  L(`- Tradução para o hóspede (equipe em português → idioma do hóspede): ${pc(traducoes.equipe_traduzidas, traducoes.equipe_estrangeiro)}`);
  L(`- Áudios transcritos (hóspede e equipe): ${pc(traducoes.transcritos, traducoes.audios)} · fotos de hóspedes descritas: ${pc(traducoes.descritas, traducoes.fotos)}`);
  L(`- Respondidos pela base de conhecimento: ${ev('resposta_automatica')} · emergências: ${decisoes.filter((d) => (d.resumo ?? '').startsWith('EMERGÊNCIA')).length}`);
  L(`- Identificação (quarto e sobrenome): ${ev('identificado') + ev('identificacao_confirmada')} confirmadas · vínculos por QR: ${ev('vinculo_qr')}`);
  L(`- Ofertas: ${ofertas!.total} · aceitas ${ofertas!.aceitas} · expiradas ${ofertas!.expiradas} · aceite (mediana) ${seg(ofertas!.aceite50)}`);
  L(`- Escada: ${ev('escalonada')} avisos · ${ev('lembrete_resposta')} lembretes · ${ev('repassada')} passados adiante · ${ev('assumida')} assumidos pela supervisão`);
  L(`- Transferências: ${ev('transferida')} · triagem do modo sombra: ${acoesEquipe.triagens} · pedidos de apoio: ${sol!.apoios}`);
  L(`- Pesquisa: ${notas!.n} respostas, média ${notas!.media === null ? '—' : Number(notas!.media).toFixed(2)}`);
  L(`- Diretas: ${diretas!.n} (${diretas!.urgentes} urgentes, ${diretas!.cientes} com ciente) · áudios ${diretas!.audios}, transcritos ${diretas!.transcritos}`);
  L();
  L('## Tempos');
  L();
  L(`- Pedidos: ${sol!.externas} · resolvidos ${pc(sol!.resolvidas, sol!.externas)} · ainda abertos ${sol!.abertas} · escalados ${pc(sol!.escaladas, sol!.externas)}`);
  L(`- 1ª resposta da equipe: mediana ${seg(sol!.p50)} · 90% ${seg(sol!.p90)} · resolução (mediana) ${seg(sol!.res50)}`);
  L();
  L('## Erros');
  L();
  L(`- Requisições: ${metricas.http} · erros (5xx ou rede): ${metricas.httpErros}`);
  for (const [k, n] of metricas.httpErrosPor) L(`  - ${k}: ${n}`);
  L(`- Jobs que falharam nas filas: ${falhasFila.length ? falhasFila.map((f) => `${f.name} ${f.n}`).join(', ') : 'nenhum'}`);
  L();
  L('## O que a equipe-robô fez');
  L();
  L(`- ${JSON.stringify(acoesEquipe)}`);
  return linhas.join('\n');
}

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

async function principal() {
  if (!existsSync(join(raiz, '.dev', 'seed.json'))) throw new Error('rode `pnpm db:seed` antes');
  const saude = await http('GET', '/auth/eu');
  if (saude.status === 0) throw new Error(`a api não responde em ${API}`);
  log(`preparando a unidade de teste (${ALVO} mensagens em ~${MINUTOS} min, IA ${process.env.OPENROUTER_API_KEY ? 'ligada' : 'desligada'})`);
  P = await preparar();
  writeFileSync(join(raiz, '.dev', `carga-${P.k}.json`), JSON.stringify(P, null, 2));
  temAudio = gerarFalas();
  log(`unidade "${P.unidadeNome}" criada: ${P.pessoas.length} pessoas, ${P.quartos.length} quartos`);

  for (const p of P.pessoas) {
    const r = await http<{ token: string; pessoa: { id: string } }>('POST', '/auth/login', { email: p.email, senha: SENHA });
    if (r.status !== 200) throw new Error(`login de ${p.email} falhou (${r.status})`);
    const ritmo: Atendente['ritmo'] = p.papel === 'supervisor' ? 'normal' : sortear<Atendente['ritmo']>([['rapido', 40], ['normal', 45], ['lento', 15]]);
    const a: Atendente = {
      ...p,
      ritmo,
      token: r.corpo.token,
      id: r.corpo.pessoa.id,
      vistas: new Set(),
      agendado: new Set(),
      respostas: new Map(),
      transferidas: new Set(),
      resolvendo: new Set(),
      assumidas: new Set(),
      triadas: new Set(),
    };
    if (p.papel !== 'gerente') await http('POST', '/turno/entrar-web', { unidadeId: P.unidadeId }, { authorization: `Bearer ${a.token}` });
    equipe.push(a);
  }
  log(`equipe no turno: ${equipe.filter((a) => a.papel !== 'gerente').length} pessoas`);

  const gastoAntes = await gastoOpenRouter();
  const inicio = new Date();
  const laços = [...equipe.map((a) => loopAtendente(a)), loopDiretas(), loopCiente()];

  // Hóspedes chegam espalhados no tempo. Cada um manda ~3 mensagens (pedido, identificação,
  // agradecimento, nota); para de chegar gente quando o total está perto do pedido.
  const totalHospedes = Math.max(1, Math.round(ALVO / 3.2));
  const intervalo = (MINUTOS * 60_000) / totalHospedes;
  let n = 0;
  const chegadas = (async () => {
    while (n < totalHospedes && contagem.hospede < ALVO * 0.8) {
      void iniciarHospede(n++);
      await esperar(entre(0.3, 1.7) * intervalo);
    }
    // Hóspedes mandaram menos do que a estimativa (com IA, muita coisa se resolve na primeira
    // mensagem): continua chegando gente, no mesmo ritmo, até perto do total pedido.
    while (contagem.hospede < ALVO * 0.85) {
      void iniciarHospede(n++);
      await esperar(entre(0.3, 1.7) * intervalo);
    }
  })();
  const reacoes = (async () => {
    while (rodando) {
      await esperar(4000);
      await reagirHospedes().catch((e) => log('reação falhou:', (e as Error).message));
    }
  })();
  const progresso = setInterval(async () => {
    const [c] = await q<{ usd: string | null; n: number }>(`SELECT sum(custo_usd) AS usd, count(*)::int AS n FROM uso_ia WHERE criado_em >= $1`, [inicio]).catch(() => [{ usd: null, n: 0 }]);
    const [fila] = await owner
      .query<{ n: number }>(`SELECT count(*)::int AS n FROM pgboss.job WHERE name IN ('mensagem-entrada','mensagem-saida','midia-derivar') AND state IN ('created','active','retry')`)
      .then((r) => r.rows)
      .catch(() => [{ n: -1 }]);
    log(
      `hóspedes ${n}/${totalHospedes} · mensagens ${contagem.hospede}/${ALVO} · ativos ${hospedes.filter((h) => h.ativo).length} · fila ${fila!.n} · IA ${c!.n} chamadas, ${usd(Number(c!.usd ?? 0))} · equipe ${acoesEquipe.respostas} respostas`,
    );
  }, 15_000);

  await chegadas;
  // Depois da última chegada: termina quando as conversas acabam, ou quando fica tudo quieto
  // (fila vazia e 90 s sem ninguém agir), ou no máximo 6 min depois.
  log('todos os hóspedes chegaram; esperando as conversas terminarem');
  const limite = Date.now() + 6 * 60_000;
  while (Date.now() < limite) {
    await esperar(5000);
    const ativos = hospedes.filter((h) => h.ativo).length;
    const [fila] = await owner
      .query<{ n: number }>(`SELECT count(*)::int AS n FROM pgboss.job WHERE name IN ('mensagem-entrada','mensagem-saida','midia-derivar') AND state IN ('created','active','retry')`)
      .then((r) => r.rows);
    const quieto = Date.now() - ultimaAtividade > 90_000;
    if (fila!.n === 0 && (ativos === 0 || quieto)) break;
  }
  rodando = false;
  clearInterval(progresso);
  await reacoes;
  await Promise.race([Promise.all(laços), esperar(8000)]);
  for (const a of equipe.filter((x) => x.papel !== 'gerente')) await http('POST', '/turno/sair', { conversas: 'devolver_fila' }, { authorization: `Bearer ${a.token}` });
  await esperar(5000);
  const fim = new Date();
  // A OpenRouter leva alguns segundos para contabilizar as últimas chamadas.
  await esperar(gastoAntes === null ? 0 : 20_000);
  const gastoDepois = await gastoOpenRouter();
  const texto = await relatorio(inicio, fim, gastoAntes, gastoDepois);
  const arquivo = join(raiz, '.dev', `carga-relatorio-${P.k}.md`);
  writeFileSync(arquivo, texto);
  console.log(`\n${texto}\n\nrelatório: ${arquivo}`);
  await owner.end();
}

principal().catch(async (e) => {
  console.error(e);
  rodando = false;
  await owner.end().catch(() => undefined);
  process.exit(1);
});
