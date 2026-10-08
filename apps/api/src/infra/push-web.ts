import webpush from 'web-push';
import type { Config } from '../config.js';

export interface InscricaoWeb {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** O que o service worker do navegador mostra. `url` é aberta no toque. */
export interface AvisoWeb {
  titulo: string;
  corpo: string;
  url: string;
  /** Avisos com a mesma etiqueta se substituem (uma conversa, um aviso). */
  etiqueta?: string;
  /** Fica na tela até a pessoa tocar (pedido novo, urgente). */
  insistente?: boolean;
}

/**
 * Notificação no navegador pelo Web Push (padrão aberto, sem Firebase): a equipe na web e o
 * hóspede no chat do quarto recebem com a aba fechada. Chaves VAPID na configuração; sem elas,
 * fica desligado. Como o FCM, nada aqui é garantido: quem garante é o escalonamento.
 */
export class PushWeb {
  readonly chavePublica: string | null;
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(c: Pick<Config, 'VAPID_PUBLICA' | 'VAPID_PRIVADA' | 'VAPID_CONTATO'>) {
    this.vapid = c.VAPID_PUBLICA && c.VAPID_PRIVADA ? { subject: c.VAPID_CONTATO, publicKey: c.VAPID_PUBLICA, privateKey: c.VAPID_PRIVADA } : null;
    this.chavePublica = this.vapid?.publicKey ?? null;
  }

  get disponivel(): boolean {
    return this.vapid !== null;
  }

  async enviar(i: InscricaoWeb, a: AvisoWeb): Promise<'ok' | 'expirada' | 'falhou'> {
    if (!this.vapid) return 'falhou';
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(a), {
        vapidDetails: this.vapid,
        // Aviso velho não serve: se o navegador ficou 10 min fora do ar, deixa para lá.
        TTL: 600,
        urgency: a.insistente ? 'high' : 'normal',
      });
      return 'ok';
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: o navegador cancelou a inscrição (desinstalou, limpou dados, negou depois).
      if (status === 404 || status === 410) return 'expirada';
      console.warn(`[push-web] ${status ?? ''} ${(e as Error).message}`);
      return 'falhou';
    }
  }
}
