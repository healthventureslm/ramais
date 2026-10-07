import { StatusDot } from '@healthventureslm/design-system';
import type { ReactNode } from 'react';
import { ESTADO } from '../util';

/**
 * O que o Ramais tem e o design system não: o chaveiro do quarto e o recado da nota interna.
 * Todo o resto vem de @healthventureslm/design-system.
 */

/** Número do quarto como o chaveiro pendurado atrás da recepção. Contornado quando veio pelo QR e falta confirmar. */
export function Chaveiro({ numero, pendente, grande }: { numero: string; pendente?: boolean; grande?: boolean }) {
  return (
    <span
      className={`chaveiro ${pendente ? 'chaveiro--pendente' : ''} ${grande ? 'chaveiro--grande' : ''}`}
      title={pendente ? `Quarto ${numero} pelo QR, ainda não confirmado` : `Quarto ${numero}`}
    >
      {numero}
    </span>
  );
}

export type Situacao = 'live' | 'danger' | 'positive' | 'info' | 'neutral';

/** O estado do pedido no vocabulário do DS: live só quando há relógio correndo (fila, oferta). */
export function situacao(estado: string, escalada = false): Situacao {
  if (escalada) return 'danger';
  if (estado === 'na_fila' || estado === 'oferecida') return 'live';
  if (estado === 'em_atendimento') return 'positive';
  if (estado === 'aguardando_solicitante' || estado === 'automacao') return 'info';
  return 'neutral';
}

export function Estado({ estado, escalada }: { estado: string; escalada?: boolean }) {
  return <StatusDot status={situacao(estado, escalada)}>{escalada ? 'Escalado' : ESTADO[estado] ?? estado}</StatusDot>;
}

/** Nota interna: o papel amarelo do balcão. Nunca vai para o hóspede. */
export function Recado({ autor, hora, children }: { autor: string; hora: string; children: ReactNode }) {
  return (
    <div className="recado" role="note">
      <div className="recado__texto">{children}</div>
      <div className="recado__meta">
        Nota interna · {autor} · <span className="dado">{hora}</span>
      </div>
    </div>
  );
}
