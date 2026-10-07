import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigUnidade } from '@ramais/contracts';
import type { Tx } from '@ramais/db';

export interface SetorInfo {
  id: string;
  chave: string;
  nome: string;
  unidadeId: string;
  politicaDistribuicao: string;
  modoIa: 'sombra' | 'automatico';
}

/**
 * Configuração das unidades. `jornada_versao` é imutável, então a config de uma
 * versão pode ficar em cache para sempre.
 */
@Injectable()
export class Unidades {
  private readonly cache = new Map<string, ConfigUnidade>();

  async configDaVersao(tx: Tx, versaoId: string): Promise<ConfigUnidade> {
    const emCache = this.cache.get(versaoId);
    if (emCache) return emCache;
    const r = await tx.client.query('SELECT config FROM jornada_versao WHERE id = $1', [versaoId]);
    if (!r.rows[0]) throw new NotFoundException('versão de jornada não encontrada');
    const cfg = ConfigUnidade.parse(r.rows[0].config);
    this.cache.set(versaoId, cfg);
    return cfg;
  }

  async versaoAtual(tx: Tx, unidadeId: string): Promise<{ id: string; cfg: ConfigUnidade; fuso: string }> {
    const r = await tx.client.query('SELECT jornada_versao_id, fuso FROM unidade WHERE id = $1', [unidadeId]);
    const id = r.rows[0]?.jornada_versao_id as string | undefined;
    if (!id) throw new NotFoundException('unidade sem jornada publicada');
    return { id, cfg: await this.configDaVersao(tx, id), fuso: r.rows[0].fuso };
  }

  /** Setores ativos: o catálogo e a distribuição usam sempre a versão vigente. */
  async setores(tx: Tx, unidadeId: string): Promise<SetorInfo[]> {
    const r = await tx.client.query(
      `SELECT id, chave, nome, unidade_id, politica_distribuicao, modo_ia FROM setor
        WHERE unidade_id = $1 AND ativo ORDER BY nome`,
      [unidadeId],
    );
    return r.rows.map((l) => ({
      id: l.id,
      chave: l.chave,
      nome: l.nome,
      unidadeId: l.unidade_id,
      politicaDistribuicao: l.politica_distribuicao,
      modoIa: l.modo_ia,
    }));
  }

  async setorPorChave(tx: Tx, unidadeId: string, chave: string): Promise<SetorInfo | null> {
    return (await this.setores(tx, unidadeId)).find((s) => s.chave === chave) ?? null;
  }

  async setorPorId(tx: Tx, setorId: string): Promise<SetorInfo | null> {
    const r = await tx.client.query(
      'SELECT id, chave, nome, unidade_id, politica_distribuicao, modo_ia FROM setor WHERE id = $1',
      [setorId],
    );
    const l = r.rows[0];
    return l
      ? { id: l.id, chave: l.chave, nome: l.nome, unidadeId: l.unidade_id, politicaDistribuicao: l.politica_distribuicao, modoIa: l.modo_ia }
      : null;
  }
}
