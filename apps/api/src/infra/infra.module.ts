import { Global, Module, type DynamicModule } from '@nestjs/common';
import { criarServicosIA, type ServicosIA } from '@ramais/ai';
import { criarPool } from '@ramais/db';
import type pg from 'pg';
import { PgBoss } from 'pg-boss';
import { config, type Config } from '../config.js';
import { ArmazenamentoLocal, ArmazenamentoS3, type Armazenamento } from './armazenamento.js';
import { Tokens } from './auth.js';
import { ClienteMeta } from './meta.js';
import { Nucleo } from './nucleo.js';
import { PushFcm, PushLog, type Push } from './push.js';
import { TempoReal } from './tempo-real.js';
import { BOSS, CONFIG, IA, POOL, PROCESSO, type Processo } from './tokens.js';
import { Unidades } from './unidades.js';
import { registradorUsoIA } from './uso-ia.js';

export const ARMAZENAMENTO = Symbol('ARMAZENAMENTO');
export const PUSH = Symbol('PUSH');

@Global()
@Module({})
export class InfraModule {
  static paraProcesso(processo: Processo): DynamicModule {
    return {
      module: InfraModule,
      providers: [
        { provide: PROCESSO, useValue: processo },
        { provide: CONFIG, useFactory: () => config() },
        {
          provide: POOL,
          inject: [CONFIG],
          useFactory: (c: Config) => criarPool(c.DATABASE_URL, c.POOL_MAX),
        },
        {
          provide: BOSS,
          inject: [CONFIG],
          useFactory: async (c: Config) => {
            // O schema é instalado pela migração (como dono); aqui só usamos.
            const boss = new PgBoss({
              connectionString: c.DATABASE_URL,
              schema: c.PGBOSS_SCHEMA,
              migrate: false,
              createSchema: false,
              supervise: processo === 'worker',
              schedule: processo === 'worker',
              // O worker acorda por NOTIFY quando um job é criado (polling vira só garantia).
              useListenNotify: processo === 'worker',
              max: 4,
              application_name: `ramais-${processo}-boss`,
            });
            boss.on('error', (e) => console.error('[pg-boss]', e));
            await boss.start();
            return boss;
          },
        },
        {
          provide: IA,
          inject: [CONFIG, POOL],
          useFactory: (c: Config, pool: pg.Pool): ServicosIA =>
            criarServicosIA({
              apiKey: c.OPENROUTER_API_KEY,
              semRetencao: c.IA_SEM_RETENCAO,
              modeloRoteamento: c.IA_MODELO_ROTEAMENTO,
              modeloRoteamentoAlternativo: c.IA_MODELO_ROTEAMENTO_ALTERNATIVO,
              modeloTraducao: c.IA_MODELO_TRADUCAO,
              modeloTraducaoAlternativo: c.IA_MODELO_TRADUCAO_ALTERNATIVO,
              modeloResposta: c.IA_MODELO_RESPOSTA,
              modeloMultimodal: c.IA_MODELO_MULTIMODAL,
              metodoConfianca: c.IA_CONFIANCA,
              amostras: c.IA_AMOSTRAS,
              aoFalhar: (motor, erro) => console.warn(`[ia] ${motor} falhou: ${(erro as Error).message}`),
              aoUsar: registradorUsoIA(pool),
            }),
        },
        {
          provide: TempoReal,
          inject: [POOL],
          useFactory: (pool: pg.Pool) => new TempoReal(pool),
        },
        {
          provide: ClienteMeta,
          inject: [CONFIG],
          useFactory: (c: Config) => new ClienteMeta(c),
        },
        {
          provide: ARMAZENAMENTO,
          inject: [CONFIG],
          useFactory: (c: Config): Armazenamento =>
            c.ARMAZENAMENTO === 's3' ? new ArmazenamentoS3(c.S3_BUCKET!, c.AWS_REGION) : new ArmazenamentoLocal(c.ARMAZENAMENTO_DIR),
        },
        {
          provide: PUSH,
          inject: [CONFIG],
          useFactory: (c: Config): Push => (c.FCM_CONTA_SERVICO_B64 ? new PushFcm(c.FCM_CONTA_SERVICO_B64) : new PushLog()),
        },
        Tokens,
        Nucleo,
        Unidades,
      ],
      exports: [PROCESSO, CONFIG, POOL, BOSS, IA, TempoReal, ClienteMeta, ARMAZENAMENTO, PUSH, Tokens, Nucleo, Unidades],
    };
  }
}
