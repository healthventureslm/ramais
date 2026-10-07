import type { Sessao } from '@ramais/contracts';

export function desde(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return duracao(s);
}

export function duracao(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}`;
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const ESTADO: Record<string, string> = {
  automacao: 'Automação',
  na_fila: 'Na fila',
  oferecida: 'Oferecida',
  em_atendimento: 'Em atendimento',
  aguardando_solicitante: 'Aguardando hóspede',
  resolvida: 'Resolvida',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

/** Nome do idioma em português, para qualquer código ("ja" → "japonês"). Sem código: "idioma não identificado". */
export function nomeIdioma(codigo: string | null | undefined): string {
  if (!codigo) return 'idioma não identificado';
  try {
    return (new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(codigo) ?? codigo).toLowerCase();
  } catch {
    return codigo;
  }
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Japonês", para títulos e listas. */
export const NomeIdioma = (codigo: string | null | undefined) => maiuscula(nomeIdioma(codigo));

export function telefone(t: string): string {
  // Chat do quarto: não há telefone, a conversa é do quarto.
  if (t.startsWith('quarto:')) return 'Chat do quarto';
  const d = t.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, -4)}-${d.slice(-4)}`;
  return `+${d}`;
}

/** Supervisiona o setor: supervisor lotado nele, gerente ou admin. Pode assumir conversas de outra pessoa. */
export function supervisiona(sessao: Sessao, setorId: string | null | undefined): boolean {
  if (sessao.pessoa.admin || sessao.pessoa.gerente) return true;
  return sessao.setores.some((s) => s.id === setorId && s.papel === 'supervisor');
}
