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
import { CobrancasController } from './modules/cobrancas/cobrancas.controller.js';
import { Cobrancas } from './modules/cobrancas/cobrancas.service.js';
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
import { NotificacoesController } from './modules/equipes/notificacoes.controller.js';
import { CatalogoController } from './modules/admin/catalogo.controller.js';
import { PedidosController } from './modules/pedidos/pedidos.controller.js';
import { Pedidos } from './modules/pedidos/pedidos.service.js';
import { ConversaPedidos } from './modules/pedidos/conversa-pedidos.service.js';
import { ReservasController } from './modules/reservas/reservas.controller.js';
import { Reservas } from './modules/reservas/reservas.service.js';
import { Presencas } from './modules/equipes/presenca.service.js';
import { MotorFluxo } from './modules/jornada/motor-fluxo.js';
import { Orquestrador } from './modules/jornada/orquestrador.js';
import { Acoes } from './modules/solicitacoes/acoes.js';
import { Comandos } from './modules/solicitacoes/comandos.js';
import { Consultas } from './modules/solicitacoes/consultas.js';
import { SaudeController } from './modules/saude/saude.controller.js';
import { SolicitacoesController } from './modules/solicitacoes/solicitacoes.controller.js';
import { Processadores } from './worker/processadores.js';

/** Serviços de domínio, compartilhados pelos dois processos. */
const SERVICOS = [Acoes, Comandos, Consultas, Cobrancas, Pedidos, ConversaPedidos, Reservas, Distribuicao, Escalonamento, Presencas, MotorFluxo, Orquestrador, ProcessarWebhook, Saida, DerivarMidia];

@Module({
  imports: [InfraModule.paraProcesso('api')],
  controllers: [
    WebhookController,
    ChatQuartoController,
    EquipesController,
    NotificacoesController,
    CatalogoController,
    PedidosController,
    ReservasController,
    CobrancasController,
    SolicitacoesController,
    DiretasController,
    DashboardController,
    AdminController,
    EquipeController,
    ConhecimentoController,
    LocaisController,
    RelatorioController,
    DevController,
    SaudeController,
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
