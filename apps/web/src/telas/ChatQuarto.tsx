import { ActionSheet, Banner, Button, EmptyState, HVProvider, IconButton, Textarea } from '@healthventureslm/design-system';
import type { ChatView } from '@ramais/contracts';
import {
  AlertCircle,
  BedDouble,
  Bell,
  BellRing,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  ConciergeBell,
  LayoutGrid,
  Lock,
  MapPinned,
  MessagesSquare,
  Mic,
  SendHorizontal,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { API } from '../api';
import { Avisos, avisar } from '../componentes/Avisos';
import { MidiaMensagem, TEXTOS_MIDIA, useAnexos, type ArquivoPronto, type TextosMidia } from '../componentes/Midia';
import { ativarChat, estadoNotificacao, type EstadoNotificacao } from '../notificacoes';
import { hora } from '../util';

type Idioma = 'pt' | 'en' | 'es';

const TEXTOS = {
  pt: {
    titulo: 'Fale com o hotel',
    boasVindas: 'Escreva aqui o que precisar: toalhas, manutenção, restaurante, recepção. A equipe responde por este chat.',
    privado: 'Só quem está neste quarto durante a sua estadia vê esta conversa.',
    placeholder: 'Mensagem',
    enviar: 'Enviar',
    enviando: 'enviando',
    naoEnviada: 'não enviada',
    tentar: 'Tentar de novo',
    equipe: 'Equipe do hotel',
    qrInvalido: 'Este QR não está mais ativo.',
    qrInvalidoDica: 'Peça ajuda à recepção ou use o QR atual do quarto.',
    semConexao: 'Sem conexão com o hotel. Tentando de novo…',
    quarto: 'Quarto',
    destino: 'para a equipe do hotel',
    hoje: 'Hoje',
    ontem: 'Ontem',
    gravarAudio: 'Gravar áudio',
    avisar: 'Avisar quando o hotel responder',
    avisoAtivo: 'Pronto: você recebe um aviso neste celular quando o hotel responder.',
    avisoBloqueado: 'As notificações deste site estão bloqueadas no navegador.',
    menu: 'Menu principal',
    menuTitulo: 'Com quem você quer falar?',
    menuDica: 'Escolha o setor e a sua conversa vai direto para ele.',
    menuAtual: 'Você está falando com este setor',
    menuCancelar: 'Cancelar',
    menuJaEsta: 'Você já está falando com este setor.',
    midia: {
      ...TEXTOS_MIDIA,
    } satisfies TextosMidia,
  },
  en: {
    titulo: 'Message the hotel',
    boasVindas: 'Write whatever you need here: towels, maintenance, restaurant, front desk. The team replies in this chat.',
    privado: 'Only people in this room during your stay can see this conversation.',
    placeholder: 'Message',
    enviar: 'Send',
    enviando: 'sending',
    naoEnviada: 'not sent',
    tentar: 'Try again',
    equipe: 'Hotel team',
    qrInvalido: 'This QR code is no longer active.',
    qrInvalidoDica: 'Please ask the front desk, or use the current QR code in your room.',
    semConexao: 'No connection to the hotel. Retrying…',
    quarto: 'Room',
    destino: 'to the hotel team',
    hoje: 'Today',
    ontem: 'Yesterday',
    gravarAudio: 'Record voice message',
    avisar: 'Notify me when the hotel replies',
    avisoAtivo: 'Done: you will get a notification on this phone when the hotel replies.',
    avisoBloqueado: 'Notifications for this site are blocked in your browser.',
    menu: 'Main menu',
    menuTitulo: 'Who would you like to talk to?',
    menuDica: 'Choose a department and your conversation goes straight to it.',
    menuAtual: 'You are talking to this department',
    menuCancelar: 'Cancel',
    menuJaEsta: 'You are already talking to this department.',
    midia: {
      enviarFoto: 'Send photo',
      gravarAudio: 'Record voice message',
      descartar: 'Discard',
      enviarAudio: 'Send voice message',
      gravando: 'Recording',
      tituloFoto: 'Send photo',
      fotoVai: (d: string) => `The photo goes ${d}.`,
      legenda: 'Caption (optional)',
      cancelar: 'Cancel',
      enviar: 'Send',
      previa: 'Photo preview',
      microfone: 'Allow the microphone in your browser to record.',
      semGravador: 'This browser cannot record audio.',
      curto: 'Voice message too short.',
      formatoFoto: 'Photo format not supported. Use JPG or PNG.',
      fotoGrande: 'Photo larger than 10 MB.',
      transcrevendo: 'Transcribing…',
      semTranscricao: 'No transcript.',
      fotoIndisponivel: 'Photo unavailable.',
      audioIndisponivel: 'Audio unavailable.',
      carregandoFoto: 'Loading photo',
    } satisfies TextosMidia,
  },
  es: {
    titulo: 'Hable con el hotel',
    boasVindas: 'Escriba aquí lo que necesite: toallas, mantenimiento, restaurante, recepción. El equipo responde por este chat.',
    privado: 'Solo quienes están en esta habitación durante su estadía ven esta conversación.',
    placeholder: 'Mensaje',
    enviar: 'Enviar',
    enviando: 'enviando',
    naoEnviada: 'no enviado',
    tentar: 'Reintentar',
    equipe: 'Equipo del hotel',
    qrInvalido: 'Este código QR ya no está activo.',
    qrInvalidoDica: 'Pida ayuda en recepción o use el QR actual de la habitación.',
    semConexao: 'Sin conexión con el hotel. Reintentando…',
    quarto: 'Habitación',
    destino: 'al equipo del hotel',
    hoje: 'Hoy',
    ontem: 'Ayer',
    gravarAudio: 'Grabar audio',
    avisar: 'Avisarme cuando el hotel responda',
    avisoAtivo: 'Listo: recibirá un aviso en este celular cuando el hotel responda.',
    avisoBloqueado: 'Las notificaciones de este sitio están bloqueadas en el navegador.',
    menu: 'Menú principal',
    menuTitulo: '¿Con quién quiere hablar?',
    menuDica: 'Elija el sector y su conversación va directo a él.',
    menuAtual: 'Está hablando con este sector',
    menuCancelar: 'Cancelar',
    menuJaEsta: 'Ya está hablando con este sector.',
    midia: {
      enviarFoto: 'Enviar foto',
      gravarAudio: 'Grabar audio',
      descartar: 'Descartar',
      enviarAudio: 'Enviar audio',
      gravando: 'Grabando',
      tituloFoto: 'Enviar foto',
      fotoVai: (d: string) => `La foto va ${d}.`,
      legenda: 'Descripción (opcional)',
      cancelar: 'Cancelar',
      enviar: 'Enviar',
      previa: 'Vista previa',
      microfone: 'Permita el micrófono en el navegador para grabar.',
      semGravador: 'Este navegador no graba audio.',
      curto: 'Audio demasiado corto.',
      formatoFoto: 'Formato de foto no aceptado. Use JPG o PNG.',
      fotoGrande: 'Foto mayor de 10 MB.',
      transcrevendo: 'Transcribiendo…',
      semTranscricao: 'Sin transcripción.',
      fotoIndisponivel: 'Foto no disponible.',
      audioIndisponivel: 'Audio no disponible.',
      carregandoFoto: 'Cargando foto',
    } satisfies TextosMidia,
  },
};

/**
 * Idioma do celular do hóspede, qualquer um. PT/ES/EN vêm prontos; os outros começam em inglês e
 * a tela é traduzida pela API (uma vez por idioma; fica guardada neste navegador).
 */
/** ?lang=ja força um idioma (teste, demonstração): a tela não segue mais a conversa. */
function idiomaForcado(): string | null {
  const pedido = new URLSearchParams(window.location.search).get('lang');
  return pedido && /^[a-z]{2,3}([_-][a-z0-9]{2,8})?$/i.test(pedido) ? pedido : null;
}

function normalizarIdioma(bruto: string): string {
  const l = bruto.toLowerCase().replace('_', '-');
  const base = l.split('-')[0]!;
  // Chinês: simplificado e tradicional são escritas diferentes.
  return base === 'zh' ? l : base;
}

function idiomaDoNavegador(): string {
  return normalizarIdioma(idiomaForcado() ?? (navigator.language || 'pt'));
}
const pronto = (l: string): l is Idioma => l === 'pt' || l === 'en' || l === 'es';

/** Ícone de cada setor no Menu principal (setor novo, sem ícone próprio, usa o de conversa). */
const ICONE_SETOR: Record<string, typeof Wrench> = {
  recepcao: ConciergeBell,
  governanca: BedDouble,
  manutencao: Wrench,
  alimentos_bebidas: UtensilsCrossed,
  concierge: MapPinned,
};

/** Nome do setor no idioma da tela: PT e ES do cadastro; os outros idiomas usam o nome em inglês. */
function nomeDoSetor(s: ChatView['setores'][number], idioma: string): string {
  const base = idioma.split('-')[0];
  if (base === 'pt') return s.nome;
  if (base === 'es') return s.nomes.es ?? s.nome;
  return s.nomes.en ?? s.nome;
}

/** Os textos da tela numa lista só (a foto vai "{0}"), para traduzir de uma vez. */
function planificar(t: Textos): { chaves: string[]; textos: string[] } {
  const chaves: string[] = [];
  const textos: string[] = [];
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string') {
      chaves.push(k);
      textos.push(v);
    }
  }
  for (const [k, v] of Object.entries(t.midia)) {
    chaves.push(`midia.${k}`);
    textos.push(typeof v === 'function' ? v('{0}') : v);
  }
  return { chaves, textos };
}

function montar(chaves: string[], textos: string[]): Textos {
  const t = { ...TEXTOS.en, midia: { ...TEXTOS.en.midia } } as Record<string, unknown> & { midia: Record<string, unknown> };
  chaves.forEach((k, i) => {
    const v = textos[i]!;
    if (!k.startsWith('midia.')) t[k] = v;
    else if (k === 'midia.fotoVai') t.midia.fotoVai = (d: string) => v.replace('{0}', d);
    else t.midia[k.slice(6)] = v;
  });
  return t as unknown as Textos;
}

const chaveTextos = (l: string) => `ramais.chat.textos.${l}`;
function textosGuardados(l: string): Textos | null {
  try {
    const g = JSON.parse(localStorage.getItem(chaveTextos(l)) ?? 'null') as { origem: string[]; textos: string[] } | null;
    const { chaves, textos } = planificar(TEXTOS.en);
    // Mudou algum texto da tela desde que foi traduzido: traduz de novo.
    if (!g || JSON.stringify(g.origem) !== JSON.stringify(textos)) return null;
    return montar(chaves, g.textos);
  } catch {
    return null;
  }
}

const iniciais = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

class ErroChat extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** O segredo da sessão fica só neste navegador, por QR. */
const chaveToken = (codigo: string) => `ramais.chat.${codigo}`;
function tokenSalvo(codigo: string): string | null {
  try {
    return localStorage.getItem(chaveToken(codigo));
  } catch {
    return null;
  }
}
function salvarToken(codigo: string, token: string | null) {
  try {
    if (token) localStorage.setItem(chaveToken(codigo), token);
    else localStorage.removeItem(chaveToken(codigo));
  } catch {
    // sem armazenamento: a sessão vale enquanto a aba estiver aberta
  }
}

async function chamar<T>(metodo: string, caminho: string, token: string | null, corpo?: unknown): Promise<T> {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-chat': token } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new ErroChat(r.status, json?.message ?? `erro ${r.status}`);
  return json as T;
}

interface Pendente {
  clienteId: string;
  tipo: 'texto' | 'imagem' | 'audio';
  texto: string | null;
  criadoEm: string;
  falhou: boolean;
  enviar: () => Promise<void>;
}

/**
 * Chat do quarto, aberto pelo QR: o hóspede escreve, manda foto ou áudio, e a equipe responde
 * aqui, como no WhatsApp. Não precisa de conta nem de app. A conversa é a da estadia atual.
 */
export function ChatQuarto({ codigo }: { codigo: string }) {
  // Começa no idioma do celular; quando o hóspede escreve, a tela passa para o idioma da conversa
  // (celular em inglês, conversa em português: tela em português).
  const [idioma, setIdioma] = useState(idiomaDoNavegador);
  const [t, setT] = useState<Textos>(() => (pronto(idioma) ? TEXTOS[idioma] : (textosGuardados(idioma) ?? TEXTOS.en)));
  useEffect(() => {
    setT(pronto(idioma) ? TEXTOS[idioma] : (textosGuardados(idioma) ?? TEXTOS.en));
  }, [idioma]);
  const token = useRef<string | null>(tokenSalvo(codigo));
  const [dados, setDados] = useState<ChatView | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [texto, setTexto] = useState('');
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : idioma;
  }, [idioma]);
  const telaPronta = Boolean(dados);

  /** Abre a sessão pelo QR (primeira vez, ou depois que a anterior venceu). */
  const abrirSessao = useCallback(async () => {
    try {
      const s = await chamar<{ token: string }>('POST', '/chat/sessao', null, { codigo, idioma: navigator.language });
      token.current = s.token;
      salvarToken(codigo, s.token);
      return true;
    } catch (e) {
      if (e instanceof ErroChat && e.status === 404) setInvalido(true);
      return false;
    }
  }, [codigo]);

  /** Toda chamada com a sessão: se ela venceu (check-out, QR novo), abre outra e tenta uma vez. */
  const comSessao = useCallback(
    async <T,>(fn: (tk: string) => Promise<T>): Promise<T> => {
      if (!token.current && !(await abrirSessao())) throw new ErroChat(404, 'qr');
      try {
        return await fn(token.current!);
      } catch (e) {
        if (e instanceof ErroChat && e.status === 401) {
          salvarToken(codigo, null);
          token.current = null;
          if (await abrirSessao()) return fn(token.current!);
        }
        throw e;
      }
    },
    [abrirSessao, codigo],
  );

  const carregar = useCallback(async () => {
    try {
      const v = await comSessao((tk) => chamar<ChatView>('GET', '/chat', tk));
      setDados(v);
      if (v.idioma && !idiomaForcado()) {
        const conversa = normalizarIdioma(v.idioma);
        // zh-tw do celular e "zh" da conversa são o mesmo idioma: mantém a escrita do celular.
        setIdioma((atual) => (atual.split('-')[0] === conversa.split('-')[0] ? atual : conversa));
      }
      setOffline(false);
      // A bolha "enviando" sai quando a mensagem gravada chega.
      const gravadas = new Set(v.mensagens.map((m) => m.clienteId).filter(Boolean));
      setPendentes((p) => p.filter((x) => !gravadas.has(x.clienteId)));
    } catch (e) {
      if (!(e instanceof ErroChat && e.status === 404)) setOffline(true);
    }
  }, [comSessao]);

  useEffect(() => {
    void carregar();
    // Sem tempo real para o hóspede: busca a cada 3 s com a aba visível, e na hora ao voltar.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void carregar();
    }, 3000);
    const voltar = () => document.visibilityState === 'visible' && void carregar();
    document.addEventListener('visibilitychange', voltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', voltar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!telaPronta || pronto(idioma) || textosGuardados(idioma)) return;
    const { chaves, textos } = planificar(TEXTOS.en);
    comSessao((tk) => chamar<{ textos: string[]; traduzido: boolean }>('POST', '/chat/textos', tk, { idioma, textos }))
      .then((r) => {
        if (!r.traduzido) return;
        setT(montar(chaves, r.textos));
        try {
          localStorage.setItem(chaveTextos(idioma), JSON.stringify({ origem: textos, textos: r.textos }));
        } catch {
          // sem armazenamento: traduz de novo na próxima visita
        }
      })
      .catch(() => undefined);
  }, [telaPronta, idioma, comSessao]);

  // Aviso no celular quando o hotel responder (com o chat fechado). Quem já permitiu é inscrito
  // de novo em silêncio: cada leitura do QR é uma sessão nova.
  const [notificacao, setNotificacao] = useState<EstadoNotificacao | null>(null);
  useEffect(() => {
    if (!telaPronta) return;
    void estadoNotificacao().then((e) => {
      setNotificacao(e);
      if (e === 'ativa') void comSessao((tk) => ativarChat(tk, false)).catch(() => undefined);
    });
  }, [telaPronta, comSessao]);
  async function pedirAviso() {
    try {
      const e = await comSessao((tk) => ativarChat(tk));
      setNotificacao(e);
      if (e === 'ativa') avisar(t.avisoAtivo, 'success');
      else if (e === 'bloqueada') avisar(t.avisoBloqueado, 'warning');
    } catch {
      avisar(t.semConexao, 'error');
    }
  }
  const escreveu = pendentes.length > 0 || Boolean(dados?.mensagens.some((m) => m.autor === 'hospede'));

  // Menu principal: o hóspede escolhe o setor; a conversa vai para lá a qualquer momento.
  const [menuAberto, setMenuAberto] = useState(false);
  async function escolherSetor(chave: string) {
    setMenuAberto(false);
    try {
      const r = await comSessao((tk) => chamar<{ jaEstava: boolean }>('POST', '/chat/setor', tk, { chave }));
      if (r.jaEstava) avisar(t.menuJaEsta, 'info');
      void carregar();
    } catch {
      avisar(t.semConexao, 'error');
    }
  }

  const total = (dados?.mensagens.length ?? 0) + pendentes.length;
  useEffect(() => {
    void fim.current?.scrollIntoView({ block: 'end' });
  }, [total]);

  const carregarArquivo = useCallback(
    (url: string) =>
      comSessao(async (tk) => {
        const r = await fetch(API + url, { headers: { 'x-chat': tk } });
        if (!r.ok) throw new ErroChat(r.status, 'arquivo');
        return URL.createObjectURL(await r.blob());
      }),
    [comSessao],
  );

  /** Mostra na hora como "enviando"; se a rede falhar, fica "não enviada" com tentar de novo. */
  async function postar(p: Omit<Pendente, 'falhou' | 'enviar' | 'criadoEm'>, envio: (tk: string) => Promise<unknown>) {
    const enviar = async () => {
      setPendentes((l) => l.map((x) => (x.clienteId === p.clienteId ? { ...x, falhou: false } : x)));
      try {
        await comSessao(envio);
        void carregar();
      } catch (e) {
        setPendentes((l) => l.map((x) => (x.clienteId === p.clienteId ? { ...x, falhou: true } : x)));
        if (e instanceof ErroChat && e.status === 400) avisar(e.message, 'error');
      }
    };
    setPendentes((l) => [...l, { ...p, criadoEm: new Date().toISOString(), falhou: false, enviar }]);
    await enviar();
  }

  async function enviarMidia(a: ArquivoPronto, legenda: string | null) {
    const id = crypto.randomUUID();
    await postar({ clienteId: id, tipo: a.tipo, texto: legenda }, (tk) => chamar('POST', '/chat/midia', tk, { id, ...a, legenda: legenda ?? undefined }));
  }

  const anexos = useAnexos({ destino: t.destino, aoEnviar: enviarMidia, aoErro: (msg) => avisar(msg, 'error'), t: t.midia });
  const campo = useRef<HTMLDivElement | null>(null);

  if (invalido) {
    return (
      <HVProvider>
        <main className="zap zap--vazio">
          <EmptyState align="center" icon={<ConciergeBell />} title={t.qrInvalido} description={t.qrInvalidoDica} />
        </main>
      </HVProvider>
    );
  }

  const itens = montarItens(dados, pendentes, t);
  const temTexto = Boolean(texto.trim());

  return (
    <HVProvider>
      <main className="zap" aria-label={t.titulo}>
        <header className="zap__cabeca">
          <span className="zap__avatar" aria-hidden="true">
            {dados ? iniciais(dados.hotel) : ''}
          </span>
          <div className="zap__quem">
            <strong>{dados?.hotel ?? t.titulo}</strong>
            <span>{dados ? `${t.quarto} ${dados.quarto} · ${t.titulo}` : ''}</span>
          </div>
        </header>
        {dados && dados.setores.length > 0 && (
          <div className="zap__menu">
            <Button block variant="ghost" iconLeft={<LayoutGrid />} iconRight={<ChevronDown />} onClick={() => setMenuAberto(true)}>
              {t.menu}
            </Button>
          </div>
        )}
        <ActionSheet
          open={menuAberto}
          onClose={() => setMenuAberto(false)}
          title={t.menuTitulo}
          description={t.menuDica}
          cancelLabel={t.menuCancelar}
          items={(dados?.setores ?? []).map((s) => {
            const Icone = ICONE_SETOR[s.chave] ?? MessagesSquare;
            return {
              id: s.chave,
              label: nomeDoSetor(s, idioma),
              description: dados?.setorAtual === s.chave ? t.menuAtual : undefined,
              icon: <Icone />,
              onSelect: () => void escolherSetor(s.chave),
            };
          })}
        />
        {offline && <Banner variant="warning" title={t.semConexao} />}
        {notificacao === 'pendente' && escreveu && (
          <div className="zap__notificar">
            <Button size="sm" variant="secondary" iconLeft={<Bell />} onClick={() => void pedirAviso()}>
              {t.avisar}
            </Button>
          </div>
        )}
        {notificacao === 'ativa' && escreveu && (
          <p className="zap__notificar zap__notificar--ativo">
            <BellRing aria-hidden="true" />
            {t.avisoAtivo}
          </p>
        )}
        <div className="zap__parede" aria-live="polite">
          <p className="zap__aviso">
            <Lock aria-hidden="true" />
            {itens.length === 0 ? `${t.boasVindas} ${t.privado}` : t.privado}
          </p>
          {itens.map((m, i) => {
            const antes = itens[i - 1];
            const novoDia = !antes || dia(antes.criadoEm) !== dia(m.criadoEm);
            // Como no WhatsApp: o "rabinho" e o nome só no primeiro balão de uma sequência.
            const primeiro = novoDia || !antes || antes.meu !== m.meu || antes.nome !== m.nome;
            return (
              <Fragment key={m.chave}>
                {novoDia && <div className="zap__dia">{rotuloDia(m.criadoEm, t)}</div>}
                <div className={`zap__linha ${m.meu ? 'zap__linha--meu' : ''} ${primeiro ? 'zap__linha--inicio' : ''}`}>
                  <div className={`zap__bolha ${m.meu ? 'zap__bolha--meu' : 'zap__bolha--deles'} ${primeiro ? 'zap__bolha--rabo' : ''}`}>
                    {primeiro && m.nome && <div className="zap__nome">{m.nome}</div>}
                    {m.tipo !== 'texto' &&
                      (m.midiaUrl ? (
                        <MidiaMensagem tipo={m.tipo} url={m.midiaUrl} transcricao={m.transcricao} criadoEm={m.criadoEm} alt={m.nome ?? t.equipe} carregar={carregarArquivo} t={t.midia} />
                      ) : (
                        <div className="midia midia-foto--carregando zap__subindo" aria-label={t.enviando} />
                      ))}
                    {m.texto && (
                      <span className="zap__texto" dir="auto">
                        {m.texto}
                      </span>
                    )}
                    <span className={`zap__meta ${m.estado === 'falhou' ? 'zap__meta--falhou' : ''}`}>
                      {m.estado === 'falhou' && <>{t.naoEnviada} </>}
                      <span>{hora(m.criadoEm)}</span>
                      {m.estado === 'enviando' && <Clock3 aria-label={t.enviando} />}
                      {m.estado === 'enviado' && <Check aria-hidden="true" />}
                      {m.estado === 'visto' && <CheckCheck className="zap__visto" aria-hidden="true" />}
                      {m.estado === 'falhou' && <AlertCircle aria-hidden="true" />}
                    </span>
                    {m.tentar && (
                      <div className="zap__tentar">
                        <Button size="sm" variant="quiet" onClick={() => void m.tentar?.()}>
                          {t.tentar}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          <div ref={fim} />
        </div>
        <footer className="zap__rodape">
          {anexos.barraGravacao ? (
            <div className="zap__campo zap__campo--gravando">{anexos.barraGravacao}</div>
          ) : (
            <>
              <div className="zap__campo" ref={campo}>
                <Textarea
                  rows={1}
                  dir="auto"
                  className="zap__texto-campo"
                  value={texto}
                  placeholder={t.placeholder}
                  aria-label={t.placeholder}
                  onChange={(e) => {
                    setTexto(e.target.value);
                    // Cresce com o texto, até umas cinco linhas.
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
                  }}
                  onKeyDown={(e) => {
                    // Teclado físico: Enter envia. No celular, Enter quebra a linha (como no WhatsApp).
                    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
                      e.preventDefault();
                      enviarTexto();
                    }
                  }}
                />
                <IconButton label={t.midia.enviarFoto} disabled={!dados || anexos.enviando} onClick={anexos.escolherFoto}>
                  <Camera />
                </IconButton>
              </div>
              {/* Botão redondo: enviar quando há texto, gravar áudio quando não há. */}
              {temTexto ? (
                <IconButton className="zap__redondo" label={t.enviar} variant="solid" size="lg" disabled={!dados} onClick={enviarTexto}>
                  <SendHorizontal />
                </IconButton>
              ) : (
                <IconButton className="zap__redondo" label={t.gravarAudio} variant="solid" size="lg" disabled={!dados || anexos.enviando} onClick={() => void anexos.gravar()}>
                  <Mic />
                </IconButton>
              )}
            </>
          )}
          {anexos.extras}
        </footer>
      </main>
      <Avisos />
    </HVProvider>
  );

  function enviarTexto() {
    const v = texto.trim();
    if (!v) return;
    setTexto('');
    const el = campo.current?.querySelector('textarea');
    if (el) el.style.height = 'auto';
    const id = crypto.randomUUID();
    void postar({ clienteId: id, tipo: 'texto', texto: v }, (tk) => chamar('POST', '/chat/mensagens', tk, { id, texto: v }));
  }
}

type Textos = (typeof TEXTOS)[Idioma];

interface Item {
  chave: string;
  meu: boolean;
  /** Primeiro nome de quem da equipe escreveu (as automáticas não têm nome, como num contato). */
  nome: string | null;
  tipo: string;
  texto: string | null;
  transcricao: string | null;
  midiaUrl: string | null;
  criadoEm: string;
  /** Só nas do hóspede: relógio, um tique (chegou), dois tiques azuis (a equipe já respondeu depois). */
  estado: 'enviando' | 'falhou' | 'enviado' | 'visto' | null;
  tentar?: () => void;
}

function montarItens(dados: ChatView | null, pendentes: Pendente[], t: Textos): Item[] {
  const msgs = dados?.mensagens ?? [];
  const ultimaEquipe = Math.max(-1, ...msgs.map((m, i) => (m.autor === 'equipe' ? i : -1)));
  const gravados: Item[] = msgs.map((m, i) => ({
    chave: m.id,
    meu: m.autor === 'hospede',
    nome: m.autor === 'equipe' ? (m.autorNome ?? t.equipe) : null,
    tipo: m.tipo,
    texto: m.texto,
    transcricao: m.transcricao,
    midiaUrl: m.midiaUrl,
    criadoEm: m.criadoEm,
    estado: m.autor === 'hospede' ? (i < ultimaEquipe ? 'visto' : 'enviado') : null,
  }));
  const locais: Item[] = pendentes.map((p) => ({
    chave: p.clienteId,
    meu: true,
    nome: null,
    tipo: p.tipo,
    texto: p.texto,
    transcricao: null,
    midiaUrl: null,
    criadoEm: p.criadoEm,
    estado: p.falhou ? 'falhou' : 'enviando',
    tentar: p.falhou ? () => void p.enviar() : undefined,
  }));
  return [...gravados, ...locais];
}

const dia = (iso: string) => new Date(iso).toDateString();

function rotuloDia(iso: string, t: Textos): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoje.toDateString()) return t.hoje;
  if (d.toDateString() === ontem.toDateString()) return t.ontem;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long' });
}
