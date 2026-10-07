import { AsyncLocalStorage } from 'node:async_hooks';
import type { UsoIA } from '@ramais/ai';
import { comTenant } from '@ramais/db';
import type pg from 'pg';

/**
 * De quem é a chamada de IA em curso: organização, unidade e, quando já se sabe, a solicitação.
 * Quem chama a IA abre o contexto (`comContextoIA`); o registro de gasto lê dele.
 */
export interface ContextoIA {
  orgId: string;
  unidadeId?: string | null;
  solicitacaoId?: string | null;
}

const contexto = new AsyncLocalStorage<ContextoIA>();

export function comContextoIA<T>(c: ContextoIA, fn: () => Promise<T>): Promise<T> {
  // Cópia: cada fluxo completa o seu (a solicitação só é conhecida depois de registrar a mensagem).
  return contexto.run({ ...c }, fn);
}

/** A solicitação ficou conhecida no meio do caminho: as próximas chamadas vão para ela. */
export function marcarSolicitacaoIA(solicitacaoId: string | null, unidadeId?: string | null) {
  const c = contexto.getStore();
  if (!c) return;
  c.solicitacaoId = solicitacaoId;
  if (unidadeId) c.unidadeId = unidadeId;
}

/** Grava cada chamada em `uso_ia`, sem segurar quem chamou. Chamada fora de contexto não é gravada. */
export function registradorUsoIA(pool: pg.Pool) {
  return (u: UsoIA) => {
    const c = contexto.getStore();
    if (!c?.orgId) return;
    const { orgId, unidadeId = null, solicitacaoId = null } = c;
    void comTenant(pool, orgId, (tx) =>
      tx.client.query(
        `INSERT INTO uso_ia (org_id, unidade_id, solicitacao_id, tarefa, modelo, tokens_entrada, tokens_saida, custo_usd, latencia_ms, ok)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orgId, unidadeId, solicitacaoId, u.tarefa, u.modelo, u.tokensEntrada, u.tokensSaida, u.custoUsd, u.latenciaMs, u.ok],
      ),
    ).catch((e) => console.warn(`[ia] não deu para registrar o gasto: ${(e as Error).message}`));
  };
}
