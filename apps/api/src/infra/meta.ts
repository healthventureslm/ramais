import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Config } from '../config.js';

/**
 * Cliente da WhatsApp Cloud API, direto na Meta, sem intermediário.
 * A diferença entre WABA própria e gerenciada é só qual credencial usar.
 */

export interface CanalEnvio {
  phoneNumberId: string;
  credencialRef: string;
}

export class ErroMeta extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 4xx de parâmetro não adianta repetir. */
    readonly definitivo: boolean,
  ) {
    super(message);
    this.name = 'ErroMeta';
  }
}

/** Códigos de idioma dos templates aprovados. */
export const IDIOMA_TEMPLATE: Record<string, string> = { pt: 'pt_BR', es: 'es', en: 'en' };

export function assinaturaValida(segredo: string, corpo: Buffer, cabecalho: string | undefined): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false;
  const esperado = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'));
  const recebido = Buffer.from(cabecalho.slice(7));
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export class ClienteMeta {
  private readonly base: string;

  constructor(private readonly cfg: Config) {
    this.base = `https://graph.facebook.com/${cfg.META_API_VERSAO}`;
  }

  get dryRun(): boolean {
    return this.cfg.META_DRY_RUN;
  }

  private token(canal: CanalEnvio): string {
    // credencial_ref aponta para o nome do segredo. Em dev, cai no META_TOKEN.
    const t = process.env[canal.credencialRef] ?? this.cfg.META_TOKEN;
    if (!t) throw new ErroMeta(`credencial ausente: ${canal.credencialRef}`, 0, true);
    return t;
  }

  private async post(canal: CanalEnvio, corpo: Record<string, unknown>): Promise<string> {
    if (this.dryRun) {
      const id = `dry.${randomUUID()}`;
      console.log(`[meta:dry-run] → ${String(corpo.to)}: ${JSON.stringify(corpo.text ?? corpo.template)}`);
      return id;
    }
    const r = await fetch(`${this.base}/${canal.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token(canal)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...corpo }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!r.ok || !json.messages?.[0]?.id) {
      const definitivo = r.status >= 400 && r.status < 500 && r.status !== 429;
      throw new ErroMeta(json.error?.message ?? `Meta ${r.status}`, r.status, definitivo);
    }
    return json.messages[0].id;
  }

  enviarTexto(canal: CanalEnvio, para: string, texto: string): Promise<string> {
    return this.post(canal, { to: para, type: 'text', text: { body: texto, preview_url: false } });
  }

  /** Foto ou áudio: sobe o arquivo na Meta e manda pelo id. Áudio não leva legenda no WhatsApp. */
  async enviarMidia(
    canal: CanalEnvio,
    para: string,
    m: { tipo: 'imagem' | 'audio'; dados: Buffer; mime: string; legenda?: string | null },
  ): Promise<string> {
    const tipo = m.tipo === 'imagem' ? 'image' : 'audio';
    if (this.dryRun) {
      const id = `dry.${randomUUID()}`;
      console.log(`[meta:dry-run] → ${para}: ${tipo} ${m.mime} ${m.dados.length} bytes${m.legenda ? ` "${m.legenda}"` : ''}`);
      return id;
    }
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('type', m.mime);
    form.set('file', new Blob([new Uint8Array(m.dados)], { type: m.mime }), `arquivo.${m.mime.split('/')[1] ?? 'bin'}`);
    const r = await fetch(`${this.base}/${canal.phoneNumberId}/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token(canal)}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!r.ok || !json.id) {
      throw new ErroMeta(json.error?.message ?? `upload Meta ${r.status}`, r.status, r.status >= 400 && r.status < 500 && r.status !== 429);
    }
    const corpo = m.tipo === 'imagem' ? { id: json.id, ...(m.legenda ? { caption: m.legenda } : {}) } : { id: json.id };
    return this.post(canal, { to: para, type: tipo, [tipo]: corpo });
  }

  enviarTemplate(canal: CanalEnvio, para: string, nome: string, idioma: string, parametros: string[]): Promise<string> {
    return this.post(canal, {
      to: para,
      type: 'template',
      template: {
        name: nome,
        language: { code: IDIOMA_TEMPLATE[idioma] ?? 'en' },
        components: [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }],
      },
    });
  }

  async baixarMidia(canal: CanalEnvio, mediaId: string): Promise<{ dados: Buffer; mime: string }> {
    if (this.dryRun) {
      // No simulador, o "id" da mídia é uma data URL.
      const m = /^data:([^;]+);base64,(.*)$/s.exec(mediaId);
      if (!m) throw new ErroMeta('mídia simulada inválida', 400, true);
      return { mime: m[1]!, dados: Buffer.from(m[2]!, 'base64') };
    }
    const auth = { authorization: `Bearer ${this.token(canal)}` };
    const meta = await fetch(`${this.base}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
    if (!meta.ok) throw new ErroMeta(`mídia ${mediaId}: ${meta.status}`, meta.status, meta.status === 404);
    const info = (await meta.json()) as { url: string; mime_type: string };
    const arq = await fetch(info.url, { headers: auth, signal: AbortSignal.timeout(30_000) });
    if (!arq.ok) throw new ErroMeta(`download ${mediaId}: ${arq.status}`, arq.status, false);
    return { dados: Buffer.from(await arq.arrayBuffer()), mime: info.mime_type };
  }
}
