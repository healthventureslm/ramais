import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/postgres-adapter';
import { sala, type EventosCliente, type EventosServidor } from '@ramais/contracts';
import { comTenant } from '@ramais/db';
import type pg from 'pg';
import { Server } from 'socket.io';
import type { Tokens } from '../../infra/auth.js';
import { conectados } from '../../infra/conectados.js';
import { TABELA_ANEXOS } from '../../infra/tempo-real.js';

/**
 * Socket.IO direto no servidor HTTP, com adaptador Postgres (sem Redis): eventos do
 * worker chegam via NOTIFY. Só WebSocket, sem long-polling, para funcionar atrás do
 * balanceador sem sticky session.
 */
export function iniciarTempoReal(http: HttpServer, pool: pg.Pool, tokens: Tokens, origem: string, aoAtividade: (s: Awaited<ReturnType<Tokens['verificar']>>) => void) {
  const io = new Server<EventosCliente, EventosServidor>(http, {
    path: '/tempo-real',
    transports: ['websocket'],
    cors: { origin: origem.split(',').map((o) => o.trim()), credentials: true },
  });
  io.adapter(createAdapter(pool, { tableName: TABELA_ANEXOS, errorHandler: (e) => console.error('[socket.io]', e) }));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('sem token'));
      const s = await tokens.verificar(token);
      if (!s.pessoaId || (s.tipo !== 'web' && s.tipo !== 'turno')) return next(new Error('sessão inválida'));
      socket.data.sessao = s;
      next();
    } catch {
      next(new Error('token inválido'));
    }
  });

  io.on('connection', async (socket) => {
    const s = socket.data.sessao as Awaited<ReturnType<Tokens['verificar']>>;
    // Antes de qualquer await, para não perder um disconnect no meio.
    conectados.entrou(s.pessoaId!);
    socket.on('disconnect', () => conectados.saiu(s.pessoaId!));
    try {
      const salas = await comTenant(pool, s.orgId, async ({ client }) => {
        const p = (await client.query('SELECT admin FROM pessoa WHERE id = $1', [s.pessoaId])).rows[0];
        const setores = await client.query<{ setor_id: string; unidade_id: string }>(
          'SELECT l.setor_id, st.unidade_id FROM lotacao l JOIN setor st ON st.id = l.setor_id WHERE l.pessoa_id = $1',
          [s.pessoaId],
        );
        const unidades = p?.admin
          ? (await client.query<{ id: string }>('SELECT id FROM unidade')).rows.map((u) => u.id)
          : [...new Set(setores.rows.map((x) => x.unidade_id))];
        return [sala.pessoa(s.pessoaId!), ...setores.rows.map((x) => sala.setor(x.setor_id)), ...unidades.map(sala.unidade)];
      });
      await socket.join(salas);
    } catch (e) {
      console.error('[socket.io] falha ao entrar nas salas', e);
      socket.disconnect(true);
      return;
    }
    aoAtividade(s);

    socket.on('assinar:solicitacao', async (id) => {
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
      // Só entra na sala se a solicitação existe no tenant da sessão (RLS garante o resto).
      const ok = await comTenant(pool, s.orgId, async ({ client }) => (await client.query('SELECT 1 FROM solicitacao WHERE id = $1', [id])).rowCount);
      if (ok) await socket.join(sala.solicitacao(id));
      aoAtividade(s);
    });
    socket.on('desassinar:solicitacao', async (id) => {
      if (typeof id === 'string') await socket.leave(sala.solicitacao(id));
    });
  });
  return io;
}
