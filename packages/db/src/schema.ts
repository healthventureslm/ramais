/**
 * Espelho tipado das tabelas para o Drizzle. A fonte da verdade é o SQL em
 * `migrations/` (RLS, chaves compostas, triggers); aqui ficam só as colunas.
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, date, integer, jsonb, numeric, pgSchema, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const orgId = () => uuid('org_id').notNull();
const ts = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

export const organizacao = pgTable('organizacao', {
  id: id(),
  nome: text('nome').notNull(),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const unidade = pgTable('unidade', {
  id: id(),
  orgId: orgId(),
  nome: text('nome').notNull(),
  fuso: text('fuso').notNull().default('America/Sao_Paulo'),
  jornadaVersaoId: uuid('jornada_versao_id'),
  qrDestino: text('qr_destino').$type<'whatsapp' | 'web'>().notNull().default('whatsapp'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const jornadaVersao = pgTable('jornada_versao', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  numero: integer('numero').notNull(),
  config: jsonb('config').notNull(),
  publicadaEm: ts('publicada_em').notNull().defaultNow(),
  publicadaPor: uuid('publicada_por'),
  rascunho: boolean('rascunho').notNull().default(false),
});

export const canalWhatsapp = pgTable('canal_whatsapp', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  phoneNumberId: text('phone_number_id').notNull(),
  wabaId: text('waba_id').notNull(),
  numeroExibicao: text('numero_exibicao').notNull(),
  modoCredencial: text('modo_credencial').$type<'propria' | 'gerenciada'>().notNull(),
  credencialRef: text('credencial_ref').notNull(),
  tipo: text('tipo').$type<'whatsapp' | 'web'>().notNull().default('whatsapp'),
  ativo: boolean('ativo').notNull().default(true),
});

export const setor = pgTable('setor', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  chave: text('chave').notNull(),
  nome: text('nome').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  politicaDistribuicao: text('politica_distribuicao').notNull().default('menor_carga'),
  modoIa: text('modo_ia').$type<'sombra' | 'automatico'>().notNull().default('sombra'),
});

export const local = pgTable('local', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  tipo: text('tipo').$type<'quarto' | 'leito' | 'sala'>().notNull().default('quarto'),
  identificador: text('identificador').notNull(),
  codigoQr: text('codigo_qr').notNull(),
  ativo: boolean('ativo').notNull().default(true),
});

export const pessoa = pgTable('pessoa', {
  id: id(),
  orgId: orgId(),
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  senhaHash: text('senha_hash'),
  pinHash: text('pin_hash'),
  pinFalhas: integer('pin_falhas').notNull().default(0),
  pinBloqueadoAte: ts('pin_bloqueado_ate'),
  idiomas: text('idiomas').array().notNull().default(sql`'{pt}'`),
  admin: boolean('admin').notNull().default(false),
  gerente: boolean('gerente').notNull().default(false),
  ativo: boolean('ativo').notNull().default(true),
});

export const lotacao = pgTable('lotacao', {
  orgId: orgId(),
  pessoaId: uuid('pessoa_id').notNull(),
  setorId: uuid('setor_id').notNull(),
  papel: text('papel').$type<'membro' | 'supervisor'>().notNull().default('membro'),
  recebe: text('recebe').$type<'sempre' | 'ultimo_recurso' | 'nunca'>().notNull().default('sempre'),
  limiteCarga: integer('limite_carga').notNull().default(5),
});

export const dispositivo = pgTable('dispositivo', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  nome: text('nome').notNull(),
  plataforma: text('plataforma').$type<'android' | 'ios'>(),
  codigoCadastroHash: text('codigo_cadastro_hash'),
  codigoExpiraEm: ts('codigo_expira_em'),
  cadastradoEm: ts('cadastrado_em'),
  pushToken: text('push_token'),
  pessoaId: uuid('pessoa_id'),
  ativo: boolean('ativo').notNull().default(true),
});

export const presenca = pgTable('presenca', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  pessoaId: uuid('pessoa_id').notNull(),
  dispositivoId: uuid('dispositivo_id'),
  inicio: ts('inicio').notNull().defaultNow(),
  fim: ts('fim'),
  ultimaAtividade: ts('ultima_atividade').notNull().defaultNow(),
  motivoFim: text('motivo_fim'),
});

export const solicitante = pgTable('solicitante', {
  id: id(),
  orgId: orgId(),
  telefone: text('telefone').notNull(),
  nome: text('nome'),
  idioma: text('idioma'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const hospedeAtivo = pgTable('hospede_ativo', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  localId: uuid('local_id').notNull(),
  sobrenome: text('sobrenome').notNull(),
  checkin: date('checkin', { mode: 'string' }).notNull(),
  checkout: date('checkout', { mode: 'string' }).notNull(),
});

export const vinculo = pgTable('vinculo', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  solicitanteId: uuid('solicitante_id').notNull(),
  localId: uuid('local_id').notNull(),
  origem: text('origem').$type<'qr' | 'sobrenome' | 'recepcao'>().notNull(),
  confirmado: boolean('confirmado').notNull().default(false),
  inicio: ts('inicio').notNull().defaultNow(),
  fim: ts('fim').notNull(),
});

export type EstadoDb =
  | 'automacao'
  | 'na_fila'
  | 'oferecida'
  | 'em_atendimento'
  | 'aguardando_solicitante'
  | 'resolvida'
  | 'encerrada'
  | 'cancelada';

export const solicitacao = pgTable('solicitacao', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  solicitanteId: uuid('solicitante_id'),
  canalId: uuid('canal_id'),
  origem: text('origem').$type<'externa' | 'interna'>().notNull(),
  paiId: uuid('pai_id'),
  criadoPor: uuid('criado_por'),
  setorId: uuid('setor_id'),
  responsavelId: uuid('responsavel_id'),
  responsavelAnteriorId: uuid('responsavel_anterior_id'),
  localId: uuid('local_id'),
  identificado: boolean('identificado').notNull().default(false),
  estado: text('estado').$type<EstadoDb>().notNull(),
  etapa: text('etapa').notNull().default('entrada'),
  idioma: text('idioma').notNull().default('pt'),
  urgencia: text('urgencia').$type<'rotina' | 'hoje' | 'agora'>().notNull().default('rotina'),
  baixaCerteza: boolean('baixa_certeza').notNull().default(false),
  jornadaVersaoId: uuid('jornada_versao_id').notNull(),
  contexto: jsonb('contexto').$type<Record<string, unknown>>().notNull().default({}),
  versao: integer('versao').notNull().default(0),
  expiracoes: integer('expiracoes').notNull().default(0),
  supervisorNotificadoEm: ts('supervisor_notificado_em'),
  resumo: text('resumo'),
  entrouFilaEm: ts('entrou_fila_em'),
  primeiraRespostaEm: ts('primeira_resposta_em'),
  ultimaMsgSolicitanteEm: ts('ultima_msg_solicitante_em'),
  ultimaMsgEquipeEm: ts('ultima_msg_equipe_em'),
  resolvidaEm: ts('resolvida_em'),
  encerradaEm: ts('encerrada_em'),
  triagem: boolean('triagem').notNull().default(false),
  teste: boolean('teste').notNull().default(false),
  setorSugeridoId: uuid('setor_sugerido_id'),
  decisaoSugeridaId: uuid('decisao_sugerida_id'),
  esperaDesde: ts('espera_desde'),
  atendenteDesde: ts('atendente_desde'),
  escadaFeitos: text('escada_feitos').array().notNull().default(sql`'{}'`),
  escadaProximaEm: ts('escada_proxima_em'),
  excluirDistribuicao: uuid('excluir_distribuicao').array().notNull().default(sql`'{}'`),
  criadoEm: ts('criado_em').notNull().defaultNow(),
  atualizadoEm: ts('atualizado_em').notNull().defaultNow(),
});

export const mensagem = pgTable('mensagem', {
  id: id(),
  orgId: orgId(),
  solicitacaoId: uuid('solicitacao_id').notNull(),
  autorTipo: text('autor_tipo').$type<'solicitante' | 'pessoa' | 'ia' | 'sistema'>().notNull(),
  autorPessoaId: uuid('autor_pessoa_id'),
  visibilidade: text('visibilidade').$type<'externa' | 'interna'>().notNull(),
  tipo: text('tipo').$type<'texto' | 'imagem' | 'audio' | 'documento'>().notNull().default('texto'),
  texto: text('texto'),
  midiaChave: text('midia_chave'),
  midiaMime: text('midia_mime'),
  idioma: text('idioma'),
  waMessageId: text('wa_message_id'),
  statusEnvio: text('status_envio')
    .$type<'recebida' | 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falhou' | 'nao_enviar'>()
    .notNull()
    .default('recebida'),
  tentativasEnvio: integer('tentativas_envio').notNull().default(0),
  erroEnvio: text('erro_envio'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const mensagemDerivado = pgTable('mensagem_derivado', {
  id: id(),
  orgId: orgId(),
  mensagemId: uuid('mensagem_id').notNull(),
  tipo: text('tipo').$type<'transcricao' | 'traducao' | 'descricao'>().notNull(),
  idioma: text('idioma').notNull(),
  texto: text('texto').notNull(),
  modelo: text('modelo').notNull(),
  origemId: uuid('origem_id'),
  alerta: text('alerta'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const oferta = pgTable('oferta', {
  id: id(),
  orgId: orgId(),
  solicitacaoId: uuid('solicitacao_id').notNull(),
  pessoaId: uuid('pessoa_id').notNull(),
  ofertadaEm: ts('ofertada_em').notNull().defaultNow(),
  expiraEm: ts('expira_em').notNull(),
  resultado: text('resultado').$type<'pendente' | 'aceita' | 'expirada' | 'recusada' | 'cancelada'>().notNull().default('pendente'),
  respondidaEm: ts('respondida_em'),
});

export const decisaoIa = pgTable('decisao_ia', {
  id: id(),
  orgId: orgId(),
  solicitacaoId: uuid('solicitacao_id').notNull(),
  mensagemId: uuid('mensagem_id'),
  motor: text('motor').notNull(),
  metodoConfianca: text('metodo_confianca').notNull(),
  entrada: jsonb('entrada').notNull(),
  opcoes: jsonb('opcoes').notNull(),
  saida: jsonb('saida').notNull(),
  setorEscolhido: text('setor_escolhido'),
  confianca: real('confianca'),
  latenciaMs: integer('latencia_ms').notNull(),
  acao: text('acao').notNull(),
  sombra: boolean('sombra').notNull().default(false),
  revisao: text('revisao').$type<'confirmada' | 'corrigida'>(),
  revisadaPor: uuid('revisada_por'),
  revisadaEm: ts('revisada_em'),
  setorFinalId: uuid('setor_final_id'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const correcao = pgTable('correcao', {
  id: id(),
  orgId: orgId(),
  decisaoId: uuid('decisao_id').notNull(),
  setorPrevistoId: uuid('setor_previsto_id'),
  setorCorretoId: uuid('setor_correto_id').notNull(),
  pessoaId: uuid('pessoa_id').notNull(),
  texto: text('texto').notNull(),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const evento = pgTable('evento', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: orgId(),
  solicitacaoId: uuid('solicitacao_id'),
  tipo: text('tipo').notNull(),
  atorTipo: text('ator_tipo').$type<'solicitante' | 'pessoa' | 'ia' | 'sistema'>().notNull(),
  atorId: uuid('ator_id'),
  dados: jsonb('dados').$type<Record<string, unknown>>().notNull().default({}),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const conversaInterna = pgTable('conversa_interna', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  participantes: uuid('participantes').array().notNull(),
  solicitacaoId: uuid('solicitacao_id'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const mensagemInterna = pgTable('mensagem_interna', {
  id: id(),
  orgId: orgId(),
  conversaId: uuid('conversa_id').notNull(),
  autorId: uuid('autor_id').notNull(),
  texto: text('texto'),
  tipo: text('tipo').$type<'texto' | 'imagem' | 'audio'>().notNull().default('texto'),
  midiaChave: text('midia_chave'),
  midiaMime: text('midia_mime'),
  transcricao: text('transcricao'),
  urgente: boolean('urgente').notNull().default(false),
  cienteEm: ts('ciente_em'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const chatSessao = pgTable('chat_sessao', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  localId: uuid('local_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  estadiaDesde: ts('estadia_desde').notNull(),
  expiraEm: ts('expira_em').notNull(),
  idioma: text('idioma'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
  ultimoUsoEm: ts('ultimo_uso_em').notNull().defaultNow(),
});

export const usoIa = pgTable('uso_ia', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id'),
  solicitacaoId: uuid('solicitacao_id'),
  tarefa: text('tarefa').notNull(),
  modelo: text('modelo').notNull(),
  tokensEntrada: integer('tokens_entrada').notNull().default(0),
  tokensSaida: integer('tokens_saida').notNull().default(0),
  custoUsd: numeric('custo_usd', { precision: 14, scale: 8 }),
  latenciaMs: integer('latencia_ms').notNull(),
  ok: boolean('ok').notNull(),
  criadoEm: ts('criado_em').notNull().defaultNow(),
});

export const baseConhecimento = pgTable('base_conhecimento', {
  id: id(),
  orgId: orgId(),
  unidadeId: uuid('unidade_id').notNull(),
  chave: text('chave').notNull(),
  pergunta: text('pergunta').notNull(),
  resposta: text('resposta').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'`),
  ativo: boolean('ativo').notNull().default(true),
});

const sistema = pgSchema('sistema');

export const webhookBruto = sistema.table('webhook_bruto', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  recebidoEm: ts('recebido_em').notNull().defaultNow(),
  payload: jsonb('payload').notNull(),
  processadoEm: ts('processado_em'),
  erro: text('erro'),
});
