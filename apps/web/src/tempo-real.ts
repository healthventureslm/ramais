import type { EventosCliente, EventosServidor } from '@ramais/contracts';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API } from './api';

let socket: Socket<EventosServidor, EventosCliente> | null = null;
type Ouvinte = (...args: unknown[]) => void;
const ouvintes = new Map<string, Set<Ouvinte>>();
/** Salas de solicitação assinadas: reassinadas a cada reconexão. */
const assinadas = new Set<string>();

/**
 * Um único socket por sessão; os componentes assinam eventos num barramento local,
 * então trocar ou reconectar o socket não perde ninguém.
 */
export function conectar(token: string) {
  socket?.disconnect();
  // Só WebSocket: atrás do balanceador não há sticky session para o long-polling.
  const s: Socket<EventosServidor, EventosCliente> = io(new URL(API).origin, { path: '/tempo-real', transports: ['websocket'], auth: { token } });
  s.onAny((evento: string, ...args: unknown[]) => {
    for (const fn of ouvintes.get(evento) ?? []) fn(...args);
  });
  s.on('connect', () => {
    for (const id of assinadas) s.emit('assinar:solicitacao', id);
  });
  socket = s;
  return s;
}

export function desconectar() {
  socket?.disconnect();
  socket = null;
  assinadas.clear();
}

export function assinarSolicitacao(id: string) {
  assinadas.add(id);
  socket?.emit('assinar:solicitacao', id);
  return () => {
    assinadas.delete(id);
    socket?.emit('desassinar:solicitacao', id);
  };
}

/** Assina um evento enquanto o componente está montado. */
export function useEvento<E extends keyof EventosServidor>(evento: E, fn: EventosServidor[E]) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h: Ouvinte = (...a) => (ref.current as Ouvinte)(...a);
    let set = ouvintes.get(evento);
    if (!set) ouvintes.set(evento, (set = new Set()));
    set.add(h);
    return () => {
      set.delete(h);
    };
  }, [evento]);
}
