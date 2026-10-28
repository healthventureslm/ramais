/**
 * Agenda do catálogo: quais horários um item agendável (spa, passeio, transfer, mesa) ainda tem
 * livres num dia, no fuso do hotel. Regras puras, sem banco: quem chama passa as reservas ativas.
 */

/** Uma janela da grade semanal: nos dias da semana (0 = domingo), de `inicio` a `fim`, a cada `intervaloMin`. */
export interface JanelaHorario {
  dias: number[];
  inicio: string;
  fim: string;
  intervaloMin: number;
}

export interface ItemAgendavel {
  horarios: JanelaHorario[];
  duracaoMin: number;
  /** Vagas por horário; nulo = sem limite. */
  capacidade: number | null;
  vagasPor: 'pessoa' | 'pedido';
  antecedenciaMin: number;
  diasAFrente: number;
}

/** Reserva que já ocupa vagas (pendente ou confirmada). */
export interface Ocupacao {
  inicio: Date;
  duracaoMin: number;
  vagas: number;
}

export interface HorarioLivre {
  hora: string;
  instante: Date;
  livres: number | null;
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Diferença (ms) entre o relógio do fuso e o UTC naquele instante. */
function deslocamento(instante: Date, fuso: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - instante.getTime();
}

/** O instante de "data às hora" no relógio do hotel (data YYYY-MM-DD, hora HH:MM). */
export function instanteLocal(data: string, hora: string, fuso: string): Date {
  const [a, m, d] = data.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const ingenuo = Date.UTC(a!, m! - 1, d!, h!, mi!);
  // Duas passadas acertam a virada de horário de verão.
  let t = ingenuo - deslocamento(new Date(ingenuo), fuso);
  t = ingenuo - deslocamento(new Date(t), fuso);
  return new Date(t);
}

/** "Hoje" no relógio do hotel, como YYYY-MM-DD. */
export function dataLocal(instante: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD; não depende de fuso. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!)).getUTCDay();
}

/** Vagas que um pedido ocupa: as pessoas, ou 1 quando a vaga é o pedido inteiro (a sala, o carro). */
export const vagasDoPedido = (item: Pick<ItemAgendavel, 'vagasPor'>, pessoas: number) => (item.vagasPor === 'pedido' ? 1 : pessoas);

/**
 * Horários de um dia que ainda cabem `pessoas`. Cada horário começa numa janela da grade e
 * termina dentro dela; respeita a antecedência mínima e o limite de dias à frente, e soma as
 * vagas das reservas que se sobrepõem a ele.
 */
export function horariosLivres(
  item: ItemAgendavel,
  data: string,
  fuso: string,
  agora: Date,
  ocupacoes: Ocupacao[],
  pessoas = 1,
): HorarioLivre[] {
  const hoje = dataLocal(agora, fuso);
  const limite = new Date(instanteLocal(hoje, '00:00', fuso).getTime() + (item.diasAFrente + 1) * 86_400_000);
  const dia = diaDaSemana(data);
  const pedir = vagasDoPedido(item, pessoas);
  const vistos = new Set<string>();
  const r: HorarioLivre[] = [];
  for (const j of item.horarios) {
    if (!j.dias.includes(dia) || j.intervaloMin <= 0) continue;
    for (let m = minutos(j.inicio); m + item.duracaoMin <= minutos(j.fim); m += j.intervaloMin) {
      const hora = hhmm(m);
      if (vistos.has(hora)) continue;
      vistos.add(hora);
      const inicio = instanteLocal(data, hora, fuso);
      if (inicio.getTime() < agora.getTime() + item.antecedenciaMin * 60_000 || inicio >= limite) continue;
      const fim = inicio.getTime() + item.duracaoMin * 60_000;
      const usadas = ocupacoes
        .filter((o) => o.inicio.getTime() < fim && o.inicio.getTime() + o.duracaoMin * 60_000 > inicio.getTime())
        .reduce((n, o) => n + o.vagas, 0);
      const livres = item.capacidade === null ? null : item.capacidade - usadas;
      if (livres !== null && livres < pedir) continue;
      r.push({ hora, instante: inicio, livres });
    }
  }
  return r.sort((a, b) => a.instante.getTime() - b.instante.getTime());
}

/** Total do pedido em centavos: compra e agendamento por pessoa multiplicam; o resto é o preço. */
export function totalDoPedido(
  item: { tipo: 'compra' | 'agendamento'; precoCentavos: number | null; porPessoa: boolean },
  quantidade: number,
): number | null {
  if (item.precoCentavos === null) return null;
  return item.tipo === 'compra' || item.porPessoa ? item.precoCentavos * quantidade : item.precoCentavos;
}
