import { importPKCS8, SignJWT } from 'jose';

/**
 * Envio pelo FCM HTTP v1. No Android, mensagem só de dados com prioridade alta
 * (o app monta a notificação no canal "Atribuições" via Notifee, com som insistente).
 * No iOS, o FCM repassa ao APNs com nível sensível ao tempo.
 *
 * Nenhuma notificação é garantida: quem garante é o escalonamento.
 */

interface ContaServico {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface Push {
  enviar(token: string, p: { titulo: string; corpo: string; dados: Record<string, string>; alta: boolean }): Promise<'ok' | 'token_invalido'>;
}

export class PushLog implements Push {
  async enviar(token: string, p: { titulo: string; corpo: string }) {
    console.log(`[push:log] ${token.slice(0, 12)}… ${p.titulo} — ${p.corpo}`);
    return 'ok' as const;
  }
}

export class PushFcm implements Push {
  private readonly conta: ContaServico;
  private acesso: { token: string; expira: number } | null = null;

  constructor(contaB64: string) {
    this.conta = JSON.parse(Buffer.from(contaB64, 'base64').toString('utf8')) as ContaServico;
  }

  private async tokenAcesso(): Promise<string> {
    if (this.acesso && this.acesso.expira > Date.now() + 60_000) return this.acesso.token;
    const chave = await importPKCS8(this.conta.private_key, 'RS256');
    const agora = Math.floor(Date.now() / 1000);
    const asser = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.conta.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(agora)
      .setExpirationTime(agora + 3600)
      .sign(chave);
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: asser }),
    });
    if (!r.ok) throw new Error(`FCM oauth ${r.status}`);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    this.acesso = { token: j.access_token, expira: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  async enviar(token: string, p: { titulo: string; corpo: string; dados: Record<string, string>; alta: boolean }) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${this.conta.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.tokenAcesso()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          data: { ...p.dados, titulo: p.titulo, corpo: p.corpo },
          android: { priority: p.alta ? 'HIGH' : 'NORMAL', ttl: '120s' },
          apns: {
            headers: { 'apns-priority': p.alta ? '10' : '5', 'apns-push-type': 'alert' },
            payload: {
              aps: {
                alert: { title: p.titulo, body: p.corpo },
                sound: 'atribuicao.caf',
                'interruption-level': p.alta ? 'time-sensitive' : 'active',
              },
            },
          },
        },
      }),
    });
    if (r.status === 404 || r.status === 400) {
      const j = (await r.json().catch(() => ({}))) as { error?: { details?: { errorCode?: string }[] } };
      if (j.error?.details?.some((d) => d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT')) {
        return 'token_invalido' as const;
      }
    }
    if (!r.ok) throw new Error(`FCM ${r.status}`);
    return 'ok' as const;
  }
}
