import { Inject, Injectable } from '@nestjs/common';
import { comTenant, travar, type DadosTemporizador, type NomeFila, type Tx } from '@ramais/db';
import type pg from 'pg';
import type { PgBoss, SendOptions } from 'pg-boss';
import { Efeitos, TempoReal } from './tempo-real.js';
import { BOSS, POOL } from './tokens.js';

export interface Ctx {
  tx: Tx;
  ef: Efeitos;
}

/**
 * Ponto único para transações de negócio: abre a transação com o tenant,
 * enfileira jobs dentro dela (saem só se confirmar) e dispara o tempo real depois do COMMIT.
 */
@Injectable()
export class Nucleo {
  constructor(
    @Inject(POOL) readonly pool: pg.Pool,
    @Inject(BOSS) readonly boss: PgBoss,
    readonly tempoReal: TempoReal,
  ) {}

  async executar<T>(orgId: string, fn: (c: Ctx) => Promise<T>, opcoes: { trava?: string } = {}): Promise<T> {
    const ef = new Efeitos();
    const r = await comTenant(this.pool, orgId, async (tx) => {
      if (opcoes.trava) await travar(tx, opcoes.trava);
      return fn({ tx, ef });
    });
    ef.disparar();
    return r;
  }

  /** Enfileira um job na mesma transação. */
  async enfileirar(c: Ctx, fila: NomeFila, dados: object, opcoes: SendOptions = {}): Promise<void> {
    await this.boss.send(fila, dados, { ...opcoes, db: c.tx.boss });
  }

  async temporizador(c: Ctx, dados: DadosTemporizador, quando: Date): Promise<void> {
    await this.enfileirar(c, 'temporizador', dados, { startAfter: quando });
  }

  async distribuir(c: Ctx, setorId: string): Promise<void> {
    // Idempotente e barato: cada job distribui a fila inteira do setor sob um lock.
    await this.enfileirar(c, 'distribuir', { orgId: c.tx.orgId, setorId });
  }

  async evento(
    c: Ctx,
    e: {
      solicitacaoId?: string | null;
      tipo: string;
      atorTipo: 'solicitante' | 'pessoa' | 'ia' | 'sistema';
      atorId?: string | null;
      dados?: Record<string, unknown>;
    },
  ): Promise<void> {
    await c.tx.client.query(
      'INSERT INTO evento (org_id, solicitacao_id, tipo, ator_tipo, ator_id, dados) VALUES ($1, $2, $3, $4, $5, $6)',
      [c.tx.orgId, e.solicitacaoId ?? null, e.tipo, e.atorTipo, e.atorId ?? null, JSON.stringify(e.dados ?? {})],
    );
  }
}
