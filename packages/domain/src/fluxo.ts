import type { CampoColeta, Condicao, Urgencia } from '@ramais/contracts';
import { normalizar } from './gate.js';
import { extrairQuartoSobrenome } from './identificacao.js';

/** O que as condições do fluxo enxergam sobre a conversa. */
export interface ContextoCondicao {
  primeiraMensagem: boolean;
  /** Hora local da unidade, "HH:MM". */
  hora: string;
  /** 0 = domingo … 6 = sábado, no fuso da unidade. */
  diaSemana: number;
  setor: string | null;
  setorExigeIdentificacao: boolean;
  idioma: string;
  identificado: boolean;
  temQuarto: boolean;
  dados: Record<string, unknown>;
  urgencia: Urgencia;
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Entre `de` e `ate`, inclusive no começo e exclusivo no fim. Se `de` > `ate`, atravessa a meia-noite. */
export function dentroDoHorario(hora: string, de: string, ate: string): boolean {
  const h = minutos(hora);
  const a = minutos(de);
  const b = minutos(ate);
  if (a === b) return true;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

function vale(q: Condicao, c: ContextoCondicao): boolean {
  switch (q.tipo) {
    case 'primeira_mensagem':
      return c.primeiraMensagem;
    case 'horario':
      return dentroDoHorario(c.hora, q.de, q.ate);
    case 'dia_semana':
      return q.dias.includes(c.diaSemana);
    case 'setor':
      return c.setor !== null && q.setores.includes(c.setor);
    case 'setor_exige_identificacao':
      return c.setorExigeIdentificacao;
    case 'idioma':
      return q.idiomas.includes(c.idioma);
    case 'identificado':
      return c.identificado;
    case 'tem_quarto':
      return c.temQuarto;
    case 'dado':
      return c.dados[q.campo] !== undefined && c.dados[q.campo] !== null && c.dados[q.campo] !== '';
    case 'urgencia':
      return q.niveis.includes(c.urgencia);
  }
}

/** Todas as condições precisam valer (cada uma pode ser negada com `nao`). Sem condições, vale. */
export function avaliarCondicoes(quando: readonly Condicao[], c: ContextoCondicao): boolean {
  return quando.every((q) => (q.nao ? !vale(q, c) : vale(q, c)));
}

/** Hora e dia da semana no fuso da unidade. */
export function relogioLocal(agora: Date, fuso: string): { hora: string; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { hora: `${get('hour')}:${get('minute')}`, diaSemana: dias.indexOf(get('weekday')) };
}

// ---------- Validação dos dados coletados ----------

export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (const ch of base) soma += Number(ch) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export type ValorColetado = string | { quarto: string; sobrenome: string };

/** Lê o dado da resposta do hóspede. Devolve null se não deu para entender. */
export function lerCampo(campo: CampoColeta, texto: string): ValorColetado | null {
  const t = texto.trim();
  if (!t) return null;
  switch (campo) {
    case 'quarto_sobrenome':
      return extrairQuartoSobrenome(t);
    case 'nome': {
      const n = t.replace(/[^\p{L}\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim();
      return n.split(' ').length >= 2 && n.length >= 5 ? n : null;
    }
    case 'email': {
      const m = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/i.exec(t);
      return m ? m[0].toLowerCase() : null;
    }
    case 'cpf': {
      const m = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.exec(t);
      return m && cpfValido(m[0]) ? m[0].replace(/\D/g, '') : null;
    }
    case 'reserva': {
      const m = /\b[A-Za-z0-9-]{4,20}\b/.exec(t.replace(/^(reserva|booking|reservation|c[oó]digo)\s*:?\s*/i, ''));
      return m && /\d/.test(m[0]) ? m[0].toUpperCase() : null;
    }
    case 'data': {
      const m = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(t);
      if (!m) return null;
      const dia = Number(m[1]);
      const mes = Number(m[2]);
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
      const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}${ano ? `/${ano}` : ''}`;
    }
    case 'texto':
      return normalizar(t) ? t.slice(0, 500) : null;
  }
}

/** Para mostrar à equipe sem expor o dado inteiro (CPF). */
export function mascararCampo(campo: CampoColeta, v: ValorColetado): string {
  if (typeof v !== 'string') return `quarto ${v.quarto}, ${v.sobrenome}`;
  if (campo === 'cpf') return `***.${v.slice(3, 6)}.***-${v.slice(9)}`;
  return v;
}

export const NOMES_CAMPO: Record<CampoColeta, string> = {
  quarto_sobrenome: 'quarto e sobrenome',
  nome: 'nome',
  email: 'e-mail',
  cpf: 'CPF',
  reserva: 'código da reserva',
  data: 'data',
  texto: 'resposta',
};
