import { ForbiddenException } from '@nestjs/common';
import { pessoaDa, type Sessao } from '../../infra/auth.js';
import type { Ctx } from '../../infra/nucleo.js';

/** Leitura de gestão (relatório): admin ou gerente. */
export async function exigirGestao(c: Ctx, s: Sessao): Promise<string> {
  const id = pessoaDa(s);
  const r = await c.tx.client.query('SELECT admin, gerente FROM pessoa WHERE id = $1 AND ativo', [id]);
  if (!r.rows[0]?.admin && !r.rows[0]?.gerente) throw new ForbiddenException('só administradores e gerentes');
  return id;
}

/** Rotas de administração: só quem tem `pessoa.admin`. */
export async function exigirAdmin(c: Ctx, s: Sessao): Promise<string> {
  const id = pessoaDa(s);
  const r = await c.tx.client.query('SELECT admin FROM pessoa WHERE id = $1 AND ativo', [id]);
  if (!r.rows[0]?.admin) throw new ForbiddenException('só administradores');
  return id;
}
