import { URGENCIA_PESO, type Candidato, type EstrategiaDistribuicao, type ItemFila } from '@ramais/contracts';

/**
 * Distribuição em quatro passos, sempre na mesma ordem:
 *   1. filtrar quem pode  2. ordenar o que espera  3. escolher  4. transbordar
 * Nada aqui passa por IA: a distribuição precisa ser explicável para a equipe.
 */

/** Passo 1: no turno (já garantido pelo provedor), abaixo do limite, não excluído, recebe != nunca. */
export function filtrarCandidatos(cands: Candidato[], item: ItemFila): Candidato[] {
  const aptos = cands.filter(
    (c) => c.recebe !== 'nunca' && c.carga < c.limiteCarga && !item.excluir.includes(c.pessoaId),
  );
  // "Último recurso" só recebe quando não sobrou ninguém que recebe "sempre".
  const sempre = aptos.filter((c) => c.recebe === 'sempre');
  return sempre.length > 0 ? sempre : aptos.filter((c) => c.recebe === 'ultimo_recurso');
}

/** Passo 2: urgência, depois tempo de espera. */
export function ordenarFila<T extends Pick<ItemFila, 'urgencia' | 'entrouFilaEm' | 'solicitacaoId'>>(itens: T[]): T[] {
  return [...itens].sort(
    (a, b) =>
      URGENCIA_PESO[b.urgencia] - URGENCIA_PESO[a.urgencia] ||
      a.entrouFilaEm.getTime() - b.entrouFilaEm.getTime() ||
      a.solicitacaoId.localeCompare(b.solicitacaoId),
  );
}

function tempo(d: Date | null): number {
  return d ? d.getTime() : 0;
}

function falaIdioma(c: Candidato, idioma: string): number {
  return c.idiomas.includes(idioma) ? 0 : 1;
}

/** Passo 3, padrão: menor carga. Desempates: continuidade, idioma, quem recebeu há mais tempo, id. */
export const menorCarga: EstrategiaDistribuicao = {
  nome: 'menor_carga',
  escolher(cands, item) {
    const aptos = filtrarCandidatos(cands, item);
    if (aptos.length === 0) return null;
    if (item.preferir) {
      const anterior = aptos.find((c) => c.pessoaId === item.preferir);
      if (anterior) return anterior.pessoaId;
    }
    const ordenados = [...aptos].sort(
      (a, b) =>
        a.carga - b.carga ||
        falaIdioma(a, item.idioma) - falaIdioma(b, item.idioma) ||
        tempo(a.ultimaOfertaEm) - tempo(b.ultimaOfertaEm) ||
        a.pessoaId.localeCompare(b.pessoaId),
    );
    return ordenados[0]!.pessoaId;
  },
};

/** Rodízio: quem recebeu há mais tempo, independentemente da carga. */
export const rodizio: EstrategiaDistribuicao = {
  nome: 'rodizio',
  escolher(cands, item) {
    const aptos = filtrarCandidatos(cands, item);
    if (aptos.length === 0) return null;
    const ordenados = [...aptos].sort(
      (a, b) => tempo(a.ultimaOfertaEm) - tempo(b.ultimaOfertaEm) || a.pessoaId.localeCompare(b.pessoaId),
    );
    return ordenados[0]!.pessoaId;
  },
};

/** Fila aberta: ninguém recebe oferta; quem estiver livre pega. */
export const filaAberta: EstrategiaDistribuicao = {
  nome: 'fila_aberta',
  escolher() {
    return null;
  },
};

export const ESTRATEGIAS: Record<string, EstrategiaDistribuicao> = {
  menor_carga: menorCarga,
  rodizio,
  fila_aberta: filaAberta,
};

export interface PlanoDistribuicao {
  ofertas: { solicitacaoId: string; pessoaId: string }[];
  semCandidato: string[];
}

/**
 * Distribui uma fila inteira de uma vez, somando a carga a cada oferta para não
 * entregar tudo à mesma pessoa.
 */
export function planejarDistribuicao(
  fila: ItemFila[],
  candidatos: Candidato[],
  estrategia: EstrategiaDistribuicao,
): PlanoDistribuicao {
  const cands = candidatos.map((c) => ({ ...c }));
  const plano: PlanoDistribuicao = { ofertas: [], semCandidato: [] };
  for (const item of ordenarFila(fila)) {
    const pessoaId = estrategia.escolher(cands, item);
    if (!pessoaId) {
      plano.semCandidato.push(item.solicitacaoId);
      continue;
    }
    plano.ofertas.push({ solicitacaoId: item.solicitacaoId, pessoaId });
    const c = cands.find((x) => x.pessoaId === pessoaId)!;
    c.carga += 1;
    c.ultimaOfertaEm = new Date(8.64e15); // vai para o fim do desempate
  }
  return plano;
}
