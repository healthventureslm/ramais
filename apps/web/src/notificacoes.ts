import { API } from './api';

/**
 * Notificação no navegador (Web Push), para a equipe e para o hóspede do chat do quarto.
 * O service worker (/sw.js) mostra o aviso quando a página está fechada ou em segundo plano.
 *
 * No iPhone, o Safari só recebe push com o site adicionado à Tela de Início; numa aba comum
 * o recurso não existe e o botão nem aparece.
 */

export type EstadoNotificacao = 'indisponivel' | 'pendente' | 'ativa' | 'bloqueada';

export const suportaNotificacao = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

let chave: Promise<string | null> | null = null;
/** Chave pública VAPID do servidor; nula quando o servidor não tem notificação no navegador. */
function chavePublica(): Promise<string | null> {
  chave ??= fetch(`${API}/notificacoes/chave`)
    .then((r) => (r.ok ? r.json() : { chave: null }))
    .then((j: { chave: string | null }) => j.chave)
    .catch(() => {
      chave = null;
      return null;
    });
  return chave;
}

export async function estadoNotificacao(): Promise<EstadoNotificacao> {
  if (!suportaNotificacao() || !(await chavePublica())) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueada';
  if (Notification.permission === 'default') return 'pendente';
  return 'ativa';
}

function bytesDaChave(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const r = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) r[i] = bruto.charCodeAt(i);
  return r;
}

/** Inscrição deste navegador (cria se preciso). Chave do servidor trocada: refaz. */
async function inscricao(): Promise<PushSubscription | null> {
  const k = await chavePublica();
  if (!k) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const opcoes = { userVisibleOnly: true, applicationServerKey: bytesDaChave(k) };
  const atual = await reg.pushManager.getSubscription();
  if (atual) {
    const usada = atual.options.applicationServerKey;
    const mesma = usada && btoa(String.fromCharCode(...new Uint8Array(usada))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === k;
    if (mesma) return atual;
    await atual.unsubscribe().catch(() => undefined);
  }
  return reg.pushManager.subscribe(opcoes);
}

async function enviar(caminho: string, cabecalhos: Record<string, string>, corpo: unknown) {
  const r = await fetch(API + caminho, { method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`erro ${r.status}`);
}

/**
 * Pede permissão (precisa vir de um toque) e inscreve este navegador.
 * `pedir: false` só renova a inscrição de quem já permitiu, sem perguntar nada.
 */
async function ativar(destino: { caminho: string; cabecalhos: Record<string, string> }, pedir: boolean): Promise<EstadoNotificacao> {
  const estado = await estadoNotificacao();
  if (estado === 'indisponivel' || estado === 'bloqueada') return estado;
  if (estado === 'pendente') {
    if (!pedir) return estado;
    const p = await Notification.requestPermission();
    if (p !== 'granted') return p === 'denied' ? 'bloqueada' : 'pendente';
  }
  const s = await inscricao();
  if (!s) return 'indisponivel';
  await enviar(destino.caminho, destino.cabecalhos, s.toJSON());
  return 'ativa';
}

const daEquipe = (token: string) => ({ caminho: '/notificacoes/inscricao', cabecalhos: { authorization: `Bearer ${token}` } });

export const ativarEquipe = (token: string, pedir = true) => ativar(daEquipe(token), pedir);

/** Saiu da conta: este navegador para de receber os avisos dela (a inscrição do navegador fica). */
export async function desativarEquipe(token: string): Promise<void> {
  if (!suportaNotificacao()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const s = await reg?.pushManager.getSubscription();
  if (s) await enviar('/notificacoes/inscricao/remover', { authorization: `Bearer ${token}` }, { endpoint: s.endpoint }).catch(() => undefined);
}

export const ativarChat = (token: string, pedir = true) => ativar({ caminho: '/chat/notificacoes', cabecalhos: { 'x-chat': token } }, pedir);
