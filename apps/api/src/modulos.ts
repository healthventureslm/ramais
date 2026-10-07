import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BatimentoInterceptor } from './modules/equipes/batimento.interceptor.js';
import { GuardaAuth } from './infra/auth.js';
import { InfraModule } from './infra/infra.module.js';
import { AdminController } from './modules/admin/admin.controller.js';
import { ConhecimentoController } from './modules/admin/conhecimento.controller.js';
import { EquipeController } from './modules/admin/equipe.controller.js';
import { LocaisController } from './modules/admin/locais.controller.js';
import { RelatorioController } from './modules/admin/relatorio.controller.js';
import { ChatQuartoController } from './modules/canais/chat-quarto.controller.js';
import { DerivarMidia } from './modules/canais/derivar-midia.js';
import { ProcessarWebhook } from './modules/canais/processar-webhook.js';
import { Saida } from './modules/canais/saida.js';
import { WebhookController } from './modules/canais/webhook.controller.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js';
import { DevController } from './modules/dev/dev.controller.js';
import { DiretasController } from './modules/diretas/diretas.controller.js';
import { Distribuicao } from './modules/distribuicao/distribuicao.service.js';
import { Escalonamento } from './modules/distribuicao/escada.service.js';
import { EquipesController } from './modules/equipes/equipes.controller.js';
import { Presencas } from './modules/equipes/presenca.service.js';
import { MotorFluxo } from './modules/jornada/motor-fluxo.js';
import { Orquestrador } from './modules/jornada/orquestrador.js';
import { Acoes } from './modules/solicitacoes/acoes.js';
import { Comandos } from './modules/solicitacoes/comandos.js';
import { Consultas } from './modules/solicitacoes/consultas.js';
import { SolicitacoesController } from './modules/solicitacoes/solicitacoes.controller.js';
import { Processadores } from './worker/processadores.js';

/** Serviços de domínio, compartilhados pelos dois processos. */
const SERVICOS = [Acoes, Comandos, Consultas, Distribuicao, Escalonamento, Presencas, MotorFluxo, Orquestrador, ProcessarWebhook, Saida, DerivarMidia];

@Module({
  imports: [InfraModule.paraProcesso('api')],
  controllers: [
    WebhookController,
    ChatQuartoController,
    EquipesController,
    SolicitacoesController,
    DiretasController,
    DashboardController,
    AdminController,
    EquipeController,
    ConhecimentoController,
    LocaisController,
    RelatorioController,
    DevController,
  ],
  providers: [
    ...SERVICOS,
    { provide: APP_GUARD, useClass: GuardaAuth },
    { provide: APP_INTERCEPTOR, useClass: BatimentoInterceptor },
  ],
})
export class ApiModule {}

@Module({
  imports: [InfraModule.paraProcesso('worker')],
  providers: [...SERVICOS, Processadores],
})
export class WorkerModule {}
