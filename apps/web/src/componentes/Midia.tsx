import { AudioPlayer, Button, Dialog, IconButton, Input, VoiceWaveform } from '@healthventureslm/design-system';
import { Camera, Mic, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Foto ou áudio pronto para subir: o servidor recebe base64 (com ou sem o prefixo data:). */
export interface ArquivoPronto {
  tipo: 'imagem' | 'audio';
  mime: string;
  base64: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const LADO_MAX = 1600;
const TAXA = 16_000;

function paraBase64(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsDataURL(b);
  });
}

/** Foto de celular tem 4 a 8 MB: reduz para no máximo 1600 px em JPEG antes de subir. */
export async function prepararFoto(f: File, t: Pick<TextosMidia, 'formatoFoto' | 'fotoGrande'> = TEXTOS_MIDIA): Promise<ArquivoPronto> {
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const tela = document.createElement('canvas');
    tela.width = Math.round(img.width * escala);
    tela.height = Math.round(img.height * escala);
    tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85));
    if (blob) return { tipo: 'imagem', mime: 'image/jpeg', base64: await paraBase64(blob) };
  } catch {
    // Formato que o navegador não abre (ex.: HEIC fora do Safari): tenta o arquivo como veio.
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw new Error(t.formatoFoto);
  if (f.size > MAX_BYTES) throw new Error(t.fotoGrande);
  return { tipo: 'imagem', mime: f.type, base64: await paraBase64(f) };
}

/** PCM em WAV 16 kHz mono: toca em qualquer navegador e a transcrição aceita. */
function wav(amostras: Float32Array, taxaOrigem: number): Blob {
  const passo = taxaOrigem / TAXA;
  const n = Math.floor(amostras.length / passo);
  const buf = new DataView(new ArrayBuffer(44 + n * 2));
  const txt = (o: number, s: string) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)));
  txt(0, 'RIFF');
  buf.setUint32(4, 36 + n * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, TAXA, true);
  buf.setUint32(28, TAXA * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  txt(36, 'data');
  buf.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // Média do trecho: reduz a taxa sem serrilhar.
    const ini = Math.floor(i * passo);
    const fim = Math.min(amostras.length, Math.floor((i + 1) * passo));
    let soma = 0;
    for (let j = ini; j < fim; j++) soma += amostras[j]!;
    const v = Math.max(-1, Math.min(1, soma / Math.max(1, fim - ini)));
    buf.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Grava a voz no navegador. Para sozinho no limite. */
export function useGravador(limiteSeg = 120, t: Pick<TextosMidia, 'semGravador' | 'curto'> = TEXTOS_MIDIA) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const sessao = useRef<{ parar: (enviar: boolean) => Promise<ArquivoPronto | null> } | null>(null);
  const aoLimite = useRef<(() => void) | null>(null);

  const parar = useCallback(async (enviar: boolean) => {
    const s = sessao.current;
    sessao.current = null;
    setGravando(false);
    return s ? s.parar(enviar) : null;
  }, []);

  const iniciar = useCallback(async () => {
    if (sessao.current) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t.semGravador);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const fonte = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const partes: Float32Array[] = [];
    proc.onaudioprocess = (e) => partes.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    fonte.connect(proc);
    proc.connect(ctx.destination);
    const inicio = Date.now();
    const relogio = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= limiteSeg) aoLimite.current?.();
    }, 250);
    setSegundos(0);
    setGravando(true);
    sessao.current = {
      parar: async (enviar) => {
        clearInterval(relogio);
        proc.disconnect();
        fonte.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        const taxa = ctx.sampleRate;
        await ctx.close().catch(() => undefined);
        if (!enviar) return null;
        const total = partes.reduce((n, p) => n + p.length, 0);
        if (total < taxa * 0.5) throw new Error(t.curto);
        const tudo = new Float32Array(total);
        let o = 0;
        for (const p of partes) {
          tudo.set(p, o);
          o += p.length;
        }
        return { tipo: 'audio', mime: 'audio/wav', base64: await paraBase64(wav(tudo, taxa)) };
      },
    };
  }, [limiteSeg, t]);

  useEffect(() => () => void parar(false).catch(() => undefined), [parar]);

  return { gravando, segundos, iniciar, parar, aoLimite };
}

/** Textos da mídia: a equipe vê em português; o chat do quarto passa os do idioma do hóspede. */
export const TEXTOS_MIDIA = {
  enviarFoto: 'Enviar foto',
  gravarAudio: 'Gravar áudio',
  descartar: 'Descartar áudio',
  enviarAudio: 'Enviar áudio',
  gravando: 'Gravando áudio',
  tituloFoto: 'Enviar foto',
  fotoVai: (destino: string) => `A foto vai ${destino}.`,
  legenda: 'Legenda (opcional)',
  cancelar: 'Cancelar',
  enviar: 'Enviar',
  previa: 'Prévia da foto',
  microfone: 'Libere o microfone no navegador para gravar áudio.',
  semGravador: 'Este navegador não grava áudio.',
  curto: 'Áudio muito curto.',
  formatoFoto: 'Formato de foto não aceito. Use JPG ou PNG.',
  fotoGrande: 'Foto maior que 10 MB.',
  transcrevendo: 'Transcrevendo…',
  semTranscricao: 'Sem transcrição.',
  fotoIndisponivel: 'Foto indisponível.',
  audioIndisponivel: 'Áudio indisponível.',
  carregandoFoto: 'Carregando foto',
};
export type TextosMidia = typeof TEXTOS_MIDIA;

const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Foto e áudio de um compositor, sem leiaute: o seletor de foto (com prévia e legenda), a
 * gravação e a barra que a substitui enquanto grava. Quem usa decide onde ficam os botões.
 */
export function useAnexos({
  destino,
  comLegenda = true,
  aoEnviar,
  aoErro,
  t = TEXTOS_MIDIA,
}: {
  destino: string;
  comLegenda?: boolean;
  aoEnviar: (a: ArquivoPronto, legenda: string | null) => Promise<void>;
  aoErro: (msg: string) => void;
  t?: TextosMidia;
}) {
  const g = useGravador(120, t);
  const seletor = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<(ArquivoPronto & { previa: string }) | null>(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(a: ArquivoPronto, l: string | null) {
    setEnviando(true);
    try {
      await aoEnviar(a, l);
      return true;
    } catch (e) {
      aoErro((e as Error).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function terminarGravacao() {
    try {
      const a = await g.parar(true);
      if (a) await enviar(a, null);
    } catch (e) {
      aoErro((e as Error).message);
    }
  }
  g.aoLimite.current = () => void terminarGravacao();

  const gravar = () => g.iniciar().catch((e: Error) => aoErro(e.name === 'NotAllowedError' ? t.microfone : e.message));
  const escolherFoto = () => seletor.current?.click();

  /** Barra da gravação: descartar, onda, tempo e enviar. */
  const barraGravacao = g.gravando ? (
    <div className="gravacao" role="group" aria-label={t.gravando}>
      <IconButton label={t.descartar} variant="danger" onClick={() => void g.parar(false)}>
        <Trash2 />
      </IconButton>
      <VoiceWaveform recording height={32} className="gravacao__onda" />
      <span className="dado gravacao__tempo">{relogio(g.segundos)}</span>
      <Button iconLeft={<Send />} onClick={() => void terminarGravacao()}>
        {t.enviarAudio}
      </Button>
    </div>
  ) : null;

  /** O seletor escondido e a prévia da foto: renderize uma vez, em qualquer lugar. */
  const extras = (
    <>
      <input
        ref={seletor}
        hidden
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const a = await prepararFoto(f, t);
            setLegenda('');
            setFoto({ ...a, previa: a.base64 });
          } catch (erro) {
            aoErro((erro as Error).message);
          }
        }}
      />
      <Dialog
        open={Boolean(foto)}
        onClose={() => setFoto(null)}
        title={t.tituloFoto}
        description={t.fotoVai(destino)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFoto(null)}>
              {t.cancelar}
            </Button>
            <Button
              loading={enviando}
              onClick={async () => {
                if (foto && (await enviar(foto, legenda.trim() || null))) setFoto(null);
              }}
            >
              {t.enviar}
            </Button>
          </>
        }
      >
        {foto && (
          <div className="pilha">
            <img src={foto.previa} alt={t.previa} className="midia-foto midia-foto--previa" />
            {comLegenda && <Input label={t.legenda} value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={1000} />}
          </div>
        )}
      </Dialog>
    </>
  );

  return { gravando: g.gravando, enviando, gravar, escolherFoto, barraGravacao, extras };
}

/**
 * Botões de foto e áudio de um compositor da equipe. Enquanto grava, a linha vira a barra da
 * gravação (onda, tempo, descartar, enviar). A foto abre uma prévia com legenda opcional.
 */
export function AnexarMidia({
  desativado,
  children,
  t = TEXTOS_MIDIA,
  ...opcoes
}: {
  t?: TextosMidia;
  desativado?: boolean;
  /** "para o hóspede", "para Marcos"… aparece na prévia da foto. */
  destino: string;
  comLegenda?: boolean;
  aoEnviar: (a: ArquivoPronto, legenda: string | null) => Promise<void>;
  aoErro: (msg: string) => void;
  /** O resto da linha do compositor (dica, botão de enviar texto), escondido durante a gravação. */
  children?: ReactNode;
}) {
  const a = useAnexos({ ...opcoes, t });
  if (a.barraGravacao) return a.barraGravacao;
  return (
    <div className="linha anexos">
      <IconButton label={t.enviarFoto} disabled={desativado || a.enviando} onClick={a.escolherFoto}>
        <Camera />
      </IconButton>
      <IconButton label={t.gravarAudio} disabled={desativado || a.enviando} onClick={() => void a.gravar()}>
        <Mic />
      </IconButton>
      {children}
      {a.extras}
    </div>
  );
}

/**
 * Foto ou áudio dentro de uma bolha. O áudio sempre mostra a transcrição embaixo,
 * como no WhatsApp; enquanto ela não chega, avisa que está transcrevendo.
 */
export function MidiaMensagem({
  tipo,
  url,
  transcricao,
  criadoEm,
  alt,
  carregar,
  t = TEXTOS_MIDIA,
}: {
  t?: Pick<TextosMidia, 'transcrevendo' | 'semTranscricao' | 'fotoIndisponivel' | 'audioIndisponivel' | 'carregandoFoto'>;
  tipo: string;
  url: string | null;
  transcricao: string | null;
  criadoEm: string;
  alt: string;
  /** Busca o arquivo com a credencial de quem está vendo e devolve uma URL local. */
  carregar: (url: string) => Promise<string>;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!url) return;
    let u: string | null = null;
    let vivo = true;
    carregar(url)
      .then((x) => {
        u = x;
        if (vivo) setLocal(x);
        else URL.revokeObjectURL(x);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [url, carregar]);

  if (tipo !== 'imagem' && tipo !== 'audio') return null;
  const recente = Date.now() - new Date(criadoEm).getTime() < 90_000;
  return (
    <div className="midia">
      {falhou ? (
        <span className="midia__nota">{tipo === 'imagem' ? t.fotoIndisponivel : t.audioIndisponivel}</span>
      ) : tipo === 'imagem' ? (
        local ? (
          <a href={local} target="_blank" rel="noreferrer">
            <img src={local} alt={alt} className="midia-foto" />
          </a>
        ) : (
          <div className="midia-foto midia-foto--carregando" aria-label={t.carregandoFoto} />
        )
      ) : (
        <>
          {local ? <AudioPlayer src={local} bare showMute={false} bars={28} /> : <VoiceWaveform height={32} bars={32} />}
          {transcricao ? (
            <div className="midia__transcricao">{transcricao}</div>
          ) : (
            <span className="midia__nota">{recente ? t.transcrevendo : t.semTranscricao}</span>
          )}
        </>
      )}
    </div>
  );
}
