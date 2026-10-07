import { Inject, Injectable, Logger } from '@nestjs/common';
import { ValorMeta, WebhookMeta, type MensagemMeta, type StatusMeta } from '@ramais/contracts';
import { comTenant, resolverCanal } from '@ramais/db';
import type pg from 'pg';
import type { PgBoss } from 'pg-boss';
import { BOSS, POOL } from '../../infra/tokens.js';
import type { EntradaMensagem } from '../jornada/orquestrador.js';

const ORDEM_STATUS: Record<string, number> = { pendente: 0, enviada: 1, entregue: 2, lida: 3 };
const STATUS_META: Record<StatusMeta['status'], string> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' };

/** Converte o payload bruto em jobs `mensagem-entrada` (ordenados por conversa) e atualiza status de envio. */
@Injectable()
export class ProcessarWebhook {
  private readonly log = new Logger('webhook');

  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(BOSS) private readonly boss: PgBoss,
  ) {}

  async processar(id: number): Promise<void> {
    const r = await this.pool.query('SELECT payload, processado_em FROM sistema.webhook_bruto WHERE id = $1', [id]);
    const linha = r.rows[0];
    if (!linha || linha.processado_em) return;
    const payload = WebhookMeta.safeParse(linha.payload);
    if (!payload.success) {
      await this.pool.query('UPDATE sistema.webhook_bruto SET processado_em = now(), erro = $2 WHERE id = $1', [id, 'payload desconhecido']);
      return;
    }
    for (const entrada of payload.data.entry) {
      for (const mudanca of entrada.changes) {
        if (mudanca.field !== 'messages') continue;
        const valor = ValorMeta.safeParse(mudanca.value);
        if (!valor.success) continue;
        const v = valor.data;
        const canal = await resolverCanal(this.pool, v.metadata.phone_number_id);
        if (!canal) {
          this.log.warn(`número sem canal cadastrado: ${v.metadata.phone_number_id}`);
          continue;
        }
        const nomes = new Map((v.contacts ?? []).map((ct) => [ct.wa_id, ct.profile?.name ?? null]));
        for (const m of v.messages ?? []) {
          const e = this.entrada(m, canal, nomes.get(m.from) ?? null);
          if (!e) continue;
          await this.boss.send('mensagem-entrada', e, { singletonKey: `${canal.canalId}:${m.from}` });
        }
        for (const st of v.statuses ?? []) await this.status(canal.orgId, st);
      }
    }
    await this.pool.query('UPDATE sistema.webhook_bruto SET processado_em = now() WHERE id = $1', [id]);
  }

  private entrada(
    m: MensagemMeta,
    canal: { orgId: string; unidadeId: string; canalId: string },
    nome: string | null,
  ): EntradaMensagem | null {
    const base = {
      orgId: canal.orgId,
      unidadeId: canal.unidadeId,
      canalId: canal.canalId,
      waMessageId: m.id,
      de: m.from,
      nomePerfil: nome,
      recebidaEm: new Date(Number(m.timestamp) * 1000).toISOString(),
    };
    switch (m.type) {
      case 'text':
        return { ...base, tipo: 'texto', texto: m.text?.body ?? '', midiaId: null, midiaMime: null };
      case 'button':
        return { ...base, tipo: 'texto', texto: m.button?.text ?? '', midiaId: null, midiaMime: null };
      case 'image':
        return { ...base, tipo: 'imagem', texto: m.image?.caption ?? null, midiaId: m.image?.id ?? null, midiaMime: m.image?.mime_type ?? null };
      case 'audio':
        return { ...base, tipo: 'audio', texto: null, midiaId: m.audio?.id ?? null, midiaMime: m.audio?.mime_type ?? null };
      case 'document':
        return {
          ...base,
          tipo: 'documento',
          texto: m.document?.caption ?? m.document?.filename ?? null,
          midiaId: m.document?.id ?? null,
          midiaMime: m.document?.mime_type ?? null,
        };
      default:
        // Figurinha, localização, reação: registra como texto descritivo para não sumir.
        return { ...base, tipo: 'texto', texto: `[${m.type}]`, midiaId: null, midiaMime: null };
    }
  }

  private async status(orgId: string, st: StatusMeta): Promise<void> {
    const novo = STATUS_META[st.status];
    await comTenant(this.pool, orgId, async ({ client }) => {
      const r = await client.query<{ status_envio: string }>(
        'SELECT status_envio FROM mensagem WHERE wa_message_id = $1 FOR UPDATE',
        [st.id],
      );
      const atual = r.rows[0]?.status_envio;
      if (!atual || atual === 'falhou') return;
      // Status chegam fora de ordem: só avança.
      if (novo !== 'falhou' && (ORDEM_STATUS[novo] ?? 0) <= (ORDEM_STATUS[atual] ?? 0)) return;
      await client.query('UPDATE mensagem SET status_envio = $2, erro_envio = $3 WHERE wa_message_id = $1', [
        st.id,
        novo,
        st.errors?.map((e) => `${e.code} ${e.title ?? ''}`).join('; ') ?? null,
      ]);
    });
  }
}
