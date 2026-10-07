import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { EventosServidor } from '@ramais/contracts';

export const TABELA_ANEXOS = 'sistema.socket_io_attachments';
const CANAL = 'socket.io#/';
/** Limite do payload do NOTIFY no Postgres. */
const LIMITE_NOTIFY = 7900;

/**
 * Emissor de eventos de tempo real, igual na api e no worker: publica no formato de
 * BROADCAST do ClusterAdapter (socket.io-adapter) via pg_notify, e o adaptador Postgres
 * do Socket.IO entrega nas salas.
 *
 * Não usamos @socket.io/postgres-emitter porque a versão publicada fala o formato antigo
 * e o adaptador atual (baseado em ClusterAdapter) descarta as mensagens em silêncio.
 * Os eventos levam só ids; o cliente busca os dados pela API (que confere acesso).
 */
export class TempoReal {
  private readonly uid = `emissor-${randomBytes(6).toString('hex')}`;

  constructor(private readonly pool: pg.Pool) {}

  emitir<E extends keyof EventosServidor>(salas: string | string[], evento: E, ...args: Parameters<EventosServidor[E]>): void {
    const rooms = Array.isArray(salas) ? salas : [salas];
    if (rooms.length === 0) return;
    const mensagem = {
      uid: this.uid,
      nsp: '/',
      type: 3, // MessageType.BROADCAST
      data: {
        packet: { type: 2, data: [evento, ...args], nsp: '/' }, // PacketType.EVENT
        opts: { rooms, except: [], flags: {} },
      },
    };
    const payload = JSON.stringify(mensagem);
    if (Buffer.byteLength(payload) > LIMITE_NOTIFY) {
      console.error(`[tempo-real] evento ${evento} grande demais para NOTIFY; mande só ids`);
      return;
    }
    this.pool.query('SELECT pg_notify($1, $2)', [CANAL, payload]).catch((e) => console.error('[tempo-real] falha ao emitir', e));
  }
}

/** Fila de efeitos (tempo real) a disparar depois que a transação confirmar. */
export class Efeitos {
  private readonly pendentes: (() => void)[] = [];
  depois(fn: () => void): void {
    this.pendentes.push(fn);
  }
  disparar(): void {
    for (const f of this.pendentes.splice(0)) {
      try {
        f();
      } catch (e) {
        console.error('[efeitos]', e);
      }
    }
  }
}
