import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { FILAS } from './filas.js';

/**
 * Instala (ou migra) o schema do pg-boss e cria as filas, como dono do banco, e dá ao
 * papel da aplicação acesso a ele. A aplicação roda com `migrate: false`.
 * O schema é parametrizável para os testes terem filas próprias, isoladas do worker de dev.
 */
export async function instalarFilas(connectionStringDono: string, schema = 'pgboss'): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`schema inválido: ${schema}`);
  const boss = new PgBoss({ connectionString: connectionStringDono, schema, supervise: false, schedule: false });
  boss.on('error', (e) => console.error(e));
  await boss.start();
  for (const [nome, opcoes] of Object.entries(FILAS)) {
    if (!(await boss.getQueue(nome))) {
      await boss.createQueue(nome, opcoes);
    } else {
      // A política não muda depois de criada; o resto (retry, notify...) acompanha o código.
      const { policy: _policy, ...resto } = opcoes as typeof opcoes & { policy?: string };
      await boss.updateQueue(nome, resto);
    }
  }
  await boss.stop({ graceful: false });

  const g = new pg.Client({ connectionString: connectionStringDono });
  await g.connect();
  try {
    await g.query(`GRANT USAGE ON SCHEMA ${schema} TO ramais_app`);
    await g.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ramais_app`);
    await g.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ramais_app`);
    await g.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ramais_app`);
    // Filas novas criam tabelas novas (partições): o app precisa de acesso a elas também.
    await g.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ramais_app`);
  } finally {
    await g.end();
  }
}
