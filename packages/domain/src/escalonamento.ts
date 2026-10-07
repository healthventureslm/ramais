import type { ConfigUnidade, DegrauAviso, Escada, EstadoSolicitacao } from '@ramais/contracts';

/**
 * Escada de escalonamento configurável (por unidade, com escada própria por setor).
 *
 * Dois tempos:
 *   - espera: desde quando o solicitante espera a equipe. Os avisos contam daqui.
 *   - atendente: desde quando o responsável atual tem a conversa. Lembrar e passar adiante contam daqui.
 *
 * Tudo aqui é puro: o servidor guarda o que já foi feito e pergunta o que está vencido.
 */

export type PassoEscada =
  | { id: string; tipo: 'avisar'; em: Date; degrau: number; aviso: DegrauAviso }
  | { id: string; tipo: 'avisar_solicitante'; em: Date }
  | { id: string; tipo: 'lembrar'; em: Date }
  | { id: string; tipo: 'repassar'; em: Date };

export interface Espera {
  esperaDesde: Date;
  atendenteDesde: Date | null;
  estado: EstadoSolicitacao;
  externa: boolean;
}

const ORDEM: Record<PassoEscada['tipo'], number> = { avisar: 0, avisar_solicitante: 1, lembrar: 2, repassar: 3 };
const mais = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** A escada do setor, ou a da unidade se o setor não tem uma própria. */
export function escadaDoSetor(cfg: Pick<ConfigUnidade, 'escalonamento' | 'setores'>, chave: string | null | undefined): Escada {
  return cfg.setores.find((s) => s.chave === chave)?.escalonamento ?? cfg.escalonamento;
}

/** Todos os passos desta espera, com o momento de cada um. */
export function passosDaEscada(escada: Escada, e: Espera): PassoEscada[] {
  const passos: PassoEscada[] = escada.avisos.map((aviso, i) => ({
    id: `aviso:${i}`,
    tipo: 'avisar' as const,
    em: mais(e.esperaDesde, aviso.aposMin),
    degrau: i + 1,
    aviso,
  }));
  if (e.externa && escada.avisoSolicitanteMin > 0) {
    passos.push({ id: 'solicitante', tipo: 'avisar_solicitante', em: mais(e.esperaDesde, escada.avisoSolicitanteMin) });
  }
  // Lembrar e passar adiante: só com responsável devendo resposta ao hóspede. O id leva o início
  // do atendimento: a próxima pessoa que pegar tem os próprios lembretes.
  if (e.externa && e.estado === 'em_atendimento' && e.atendenteDesde) {
    const t = e.atendenteDesde.getTime();
    if (escada.lembrarMin > 0) passos.push({ id: `lembrar:${t}`, tipo: 'lembrar', em: mais(e.atendenteDesde, escada.lembrarMin) });
    if (escada.repassarMin > 0) passos.push({ id: `repassar:${t}`, tipo: 'repassar', em: mais(e.atendenteDesde, escada.repassarMin) });
  }
  return passos.sort((a, b) => a.em.getTime() - b.em.getTime() || ORDEM[a.tipo] - ORDEM[b.tipo]);
}

/** O que venceu e ainda não foi feito, e quando olhar de novo. */
export function planoEscada(
  escada: Escada,
  e: Espera,
  feitos: readonly string[],
  agora: Date,
): { devidos: PassoEscada[]; proximoEm: Date | null } {
  const pendentes = passosDaEscada(escada, e).filter((p) => !feitos.includes(p.id));
  const devidos = pendentes.filter((p) => p.em.getTime() <= agora.getTime());
  const futuro = pendentes.find((p) => p.em.getTime() > agora.getTime());
  return { devidos, proximoEm: futuro?.em ?? null };
}

const NA_FILA = new Set<EstadoSolicitacao>(['na_fila', 'oferecida']);

/**
 * Como a espera fica depois de uma mudança na solicitação.
 * - Na fila: a espera continua se o setor é o mesmo (passar adiante não zera); setor novo, espera nova.
 * - Em atendimento: no pedido do hóspede, a espera continua até a equipe responder; no interno, o aceite encerra.
 * - Qualquer outro estado (respondido, resolvido, automação): ninguém está esperando a equipe.
 */
export function proximaEspera(
  antes: { estado: EstadoSolicitacao; setorId: string | null; esperaDesde: Date | null; atendenteDesde: Date | null },
  depois: { estado: EstadoSolicitacao; setorId: string | null },
  externa: boolean,
  agora: Date,
): { esperaDesde: Date | null; atendenteDesde: Date | null } {
  if (NA_FILA.has(depois.estado)) {
    const continua = antes.esperaDesde && antes.setorId === depois.setorId;
    return { esperaDesde: continua ? antes.esperaDesde : agora, atendenteDesde: null };
  }
  if (depois.estado === 'em_atendimento') {
    if (!externa) return { esperaDesde: null, atendenteDesde: null };
    if (antes.estado === 'em_atendimento') {
      return { esperaDesde: antes.esperaDesde ?? agora, atendenteDesde: antes.atendenteDesde ?? agora };
    }
    return { esperaDesde: antes.esperaDesde ?? agora, atendenteDesde: agora };
  }
  return { esperaDesde: null, atendenteDesde: null };
}

/** Degrau visível no painel: 0 ninguém chamado, 1 passou de mão ou lembrou, 2 chamou alguém da escada. */
export function degrauAtual(expiracoes: number, feitos: readonly string[]): 0 | 1 | 2 {
  if (feitos.some((f) => f.startsWith('aviso:'))) return 2;
  return expiracoes > 0 || feitos.some((f) => f.startsWith('lembrar:') || f.startsWith('repassar:')) ? 1 : 0;
}
