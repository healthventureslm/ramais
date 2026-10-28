import { z } from 'zod';
import { EstadoSolicitacao, TipoMidia, Urgencia, Visibilidade } from './comum.js';

// ---------- Autenticação ----------

export const LoginWebReq = z.object({ email: z.email(), senha: z.string().min(6) });
export type LoginWebReq = z.infer<typeof LoginWebReq>;

export const CadastrarDispositivoReq = z.object({
  codigo: z.string().min(6),
  nome: z.string().min(1).max(60),
  plataforma: z.enum(['android', 'ios']),
});
export type CadastrarDispositivoReq = z.infer<typeof CadastrarDispositivoReq>;

export const EntrarTurnoReq = z.object({
  email: z.email(),
  pin: z.string().regex(/^\d{6}$/),
  pushToken: z.string().optional(),
});
export type EntrarTurnoReq = z.infer<typeof EntrarTurnoReq>;

export const SairTurnoReq = z.object({
  /** O que fazer com as conversas abertas. */
  conversas: z.enum(['devolver_fila', 'transferir']).default('devolver_fila'),
  transferirPara: z.uuid().optional(),
});
export type SairTurnoReq = z.infer<typeof SairTurnoReq>;

export interface Sessao {
  token: string;
  /**
   * admin: configura tudo (jornada, equipe, quartos). gerente: vê e atende tudo e vê o relatório,
   * sem mexer na configuração. Os dois valem para a organização inteira.
   * trocarSenha: senha temporária criada pelo admin; a pessoa define a dela no primeiro acesso.
   */
  pessoa: { id: string; nome: string; email: string; admin: boolean; gerente: boolean; trocarSenha: boolean };
  orgId: string;
  unidades: { id: string; nome: string }[];
  setores: { id: string; nome: string; chave: string; unidadeId: string; papel: 'membro' | 'supervisor' }[];
}

// ---------- Solicitações ----------

export const ResponderReq = z.object({
  texto: z.string().min(1).max(4096),
  visibilidade: Visibilidade,
});
export type ResponderReq = z.infer<typeof ResponderReq>;

export const PreviaTraducaoReq = z.object({ texto: z.string().min(1).max(4096) });

export const TransferirReq = z.object({
  setorId: z.uuid(),
  motivo: z.string().max(500).optional(),
  /** Marca como correção do roteamento da IA (vira dado de calibração). */
  correcao: z.boolean().default(false),
});
export type TransferirReq = z.infer<typeof TransferirReq>;

export const PedidoApoioReq = z.object({
  setorId: z.uuid(),
  /** Só o necessário. Sem nome do hóspede nem a conversa. */
  texto: z.string().min(3).max(500),
  urgencia: Urgencia.default('rotina'),
});
export type PedidoApoioReq = z.infer<typeof PedidoApoioReq>;

export const ConfirmarLocalReq = z.object({ localId: z.uuid() });

export interface MensagemView {
  id: string;
  autorTipo: 'solicitante' | 'pessoa' | 'ia' | 'sistema';
  autorNome: string | null;
  visibilidade: Visibilidade;
  tipo: TipoMidia;
  /** Original, imutável. */
  texto: string | null;
  idioma: string | null;
  /** Versão em português para a equipe (ou a tradução enviada, na saída). */
  traducao: string | null;
  transcricao: string | null;
  descricao: string | null;
  midiaUrl: string | null;
  statusEnvio: string;
  criadoEm: string;
}

export interface SolicitacaoResumo {
  id: string;
  unidadeId: string;
  estado: EstadoSolicitacao;
  origem: 'externa' | 'interna';
  paiId: string | null;
  setor: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
  solicitante: { id: string; telefone: string; nome: string | null } | null;
  local: { id: string; identificador: string; confirmado: boolean } | null;
  idioma: string;
  urgencia: Urgencia;
  baixaCerteza: boolean;
  escalada: boolean;
  /** Modo sombra: a IA sugeriu este setor e espera confirmação da triagem. */
  triagem: { setorSugerido: { id: string; nome: string }; confianca: number | null } | null;
  resumo: string | null;
  ultimaMensagem: string | null;
  entrouFilaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SolicitacaoDetalhe extends SolicitacaoResumo {
  mensagens: MensagemView[];
  /** Dados que o fluxo coletou do hóspede (CPF mascarado). */
  dadosColetados: { campo: string; rotulo: string; valor: string }[];
  filhos: SolicitacaoResumo[];
  ultimaDecisao: {
    id: string;
    setorPrevisto: string | null;
    confianca: number | null;
    motor: string;
    acao: string;
  } | null;
}

// ---------- Mensagem direta ----------

export const MensagemDiretaReq = z.object({
  paraPessoaId: z.uuid(),
  texto: z.string().min(1).max(2000),
  urgente: z.boolean().default(false),
  solicitacaoId: z.uuid().optional(),
});
export type MensagemDiretaReq = z.infer<typeof MensagemDiretaReq>;

// ---------- Mídia (foto e áudio) em qualquer conversa ----------

/** Até 10 MB de arquivo (o base64 é ~4/3 disso). */
export const MIDIA_MAX_BYTES = 10 * 1024 * 1024;

export const ArquivoMidia = z.object({
  tipo: z.enum(['imagem', 'audio']),
  mime: z
    .string()
    .max(100)
    .regex(/^(image\/(jpeg|png|webp)|audio\/[a-z0-9.+-]+)(;.*)?$/i, 'formato não aceito'),
  base64: z.string().min(1).max(Math.ceil((MIDIA_MAX_BYTES * 4) / 3) + 8),
});
export type ArquivoMidia = z.infer<typeof ArquivoMidia>;

export const MidiaReq = ArquivoMidia.extend({
  /** Legenda da foto (o áudio ganha a transcrição). */
  legenda: z.string().max(1000).optional(),
  visibilidade: z.enum(['externa', 'interna']).default('externa'),
});
export type MidiaReq = z.infer<typeof MidiaReq>;

export const MidiaDiretaReq = ArquivoMidia.extend({
  paraPessoaId: z.uuid(),
  legenda: z.string().max(1000).optional(),
  urgente: z.boolean().default(false),
  solicitacaoId: z.uuid().optional(),
});
export type MidiaDiretaReq = z.infer<typeof MidiaDiretaReq>;

// ---------- Notificação no navegador (Web Push) ----------

/** Inscrição do navegador (PushSubscription.toJSON()), igual para a equipe e para o chat do quarto. */
export const InscricaoPushReq = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type InscricaoPushReq = z.infer<typeof InscricaoPushReq>;

// ---------- Catálogo e pedidos (room service, spa, passeios, transfer…) ----------

const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM');
const Dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD');
const NomesI18n = z.object({ es: z.string().trim().max(160).optional(), en: z.string().trim().max(160).optional() }).default({});

/** Janela da grade semanal: nos dias (0 = domingo), de `inicio` a `fim`, um horário a cada `intervaloMin`. */
export const JanelaHorario = z
  .object({ dias: z.array(z.number().int().min(0).max(6)).min(1), inicio: Hora, fim: Hora, intervaloMin: z.number().int().min(5).max(1440) })
  .refine((j) => j.inicio < j.fim, { message: 'o fim precisa vir depois do início' });
export type JanelaHorario = z.infer<typeof JanelaHorario>;

export const CatalogoItemReq = z
  .object({
    setorId: z.uuid(),
    tipo: z.enum(['compra', 'agendamento']),
    categoria: z.string().trim().min(1).max(60),
    nome: z.string().trim().min(1).max(120),
    descricao: z.string().trim().max(1000).default(''),
    nomes: NomesI18n,
    descricoes: z.object({ es: z.string().trim().max(1000).optional(), en: z.string().trim().max(1000).optional() }).default({}),
    precoCentavos: z.number().int().min(0).max(100_000_000).nullable().default(null),
    porPessoa: z.boolean().default(false),
    maxQuantidade: z.number().int().min(1).max(100).default(10),
    duracaoMin: z.number().int().min(5).max(1440).nullable().default(null),
    capacidade: z.number().int().min(1).max(10_000).nullable().default(null),
    vagasPor: z.enum(['pessoa', 'pedido']).default('pessoa'),
    horarios: z.array(JanelaHorario).max(30).default([]),
    antecedenciaMin: z.number().int().min(0).max(10_080).default(60),
    diasAFrente: z.number().int().min(0).max(120).default(14),
    ativo: z.boolean().default(true),
    ordem: z.number().int().default(0),
  })
  .superRefine((v, ctx) => {
    if (v.tipo !== 'agendamento') return;
    if (!v.duracaoMin) ctx.addIssue({ code: 'custom', message: 'agendamento precisa de duração', path: ['duracaoMin'] });
    if (!v.horarios.length) ctx.addIssue({ code: 'custom', message: 'agendamento precisa de pelo menos uma janela de horários', path: ['horarios'] });
  });
export type CatalogoItemReq = z.infer<typeof CatalogoItemReq>;

export interface CatalogoItemView {
  id: string;
  setorId: string;
  setorNome: string;
  tipo: 'compra' | 'agendamento';
  categoria: string;
  nome: string;
  descricao: string;
  nomes: { es?: string; en?: string };
  descricoes: { es?: string; en?: string };
  precoCentavos: number | null;
  porPessoa: boolean;
  maxQuantidade: number;
  duracaoMin: number | null;
  capacidade: number | null;
  vagasPor: 'pessoa' | 'pedido';
  horarios: JanelaHorario[];
  antecedenciaMin: number;
  diasAFrente: number;
  ativo: boolean;
  ordem: number;
}

/** O que o hóspede pede pelo chat. Agendamento leva data e hora (no relógio do hotel). */
export const PedidoReq = z.object({
  itemId: z.uuid(),
  quantidade: z.number().int().min(1).max(100),
  data: Dia.optional(),
  hora: Hora.optional(),
  observacao: z.string().trim().max(500).optional(),
});
export type PedidoReq = z.infer<typeof PedidoReq>;

export const RecusarPedidoReq = z.object({ motivo: z.string().trim().min(2).max(300) });

export type EstadoPedido = 'pendente' | 'confirmado' | 'recusado' | 'cancelado' | 'concluido';

export interface PedidoView {
  id: string;
  solicitacaoId: string;
  itemId: string;
  itemNome: string;
  categoria: string | null;
  setorNome: string | null;
  tipo: 'compra' | 'agendamento';
  quantidade: number;
  agendadoPara: string | null;
  duracaoMin: number | null;
  observacao: string | null;
  precoUnitCentavos: number | null;
  totalCentavos: number | null;
  estado: EstadoPedido;
  motivo: string | null;
  lancadoEm: string | null;
  quarto: string | null;
  criadoEm: string;
}

// ---------- Chat do quarto (QR → chat no navegador do hóspede) ----------

export const ChatSessaoReq = z.object({
  /** Código do QR do quarto. */
  codigo: z.string().min(4).max(40),
  /** Idioma do navegador, só para a tela (o da conversa a IA detecta pelo que o hóspede escreve). */
  idioma: z.string().min(2).max(10).optional(),
});
export type ChatSessaoReq = z.infer<typeof ChatSessaoReq>;

export const ChatMensagemReq = z.object({
  /** Gerado no navegador: reenviar a mesma mensagem não duplica. */
  id: z.uuid(),
  texto: z.string().trim().min(1).max(2000),
});
export type ChatMensagemReq = z.infer<typeof ChatMensagemReq>;

/** Textos da tela do chat do quarto, para traduzir para o idioma do celular do hóspede. */
export const ChatTextosReq = z.object({
  idioma: z.string().regex(/^[a-zA-Z]{2,3}([_-][a-zA-Z0-9]{2,8})?$/),
  textos: z.array(z.string().min(1).max(300)).min(1).max(80),
});
export type ChatTextosReq = z.infer<typeof ChatTextosReq>;

export interface ChatMensagemView {
  id: string;
  autor: 'hospede' | 'equipe' | 'automatica';
  /** Primeiro nome de quem da equipe escreveu. */
  autorNome: string | null;
  tipo: TipoMidia;
  /** No idioma do hóspede (a equipe escreve em português e a tradução vai pronta). */
  texto: string | null;
  transcricao: string | null;
  midiaUrl: string | null;
  criadoEm: string;
  /** Id gerado por este navegador, para trocar a bolha "enviando" pela gravada. */
  clienteId: string | null;
}

export interface ChatView {
  hotel: string;
  quarto: string;
  tipoLocal: string;
  /** Idioma em que o hóspede está escrevendo (o da conversa), quando já se sabe. A tela o segue. */
  idioma: string | null;
  mensagens: ChatMensagemView[];
  /** Menu principal: setores que o hóspede pode escolher (nome em PT; `nomes` em ES/EN). */
  setores: { chave: string; nome: string; nomes: { es?: string; en?: string } }[];
  /** Setor com que o hóspede está falando agora, se algum. */
  setorAtual: string | null;
  /** O hotel tem catálogo ativo (room service, spa, passeios…): o menu mostra "Pedir ou reservar". */
  temCatalogo: boolean;
}

// ---------- Dashboard ----------

export interface DashboardView {
  precisaDeAlguem: {
    solicitacaoId: string;
    setor: string | null;
    estado: EstadoSolicitacao;
    urgencia: Urgencia;
    /** Desde quando o solicitante espera a equipe (sem aceite ou sem resposta). */
    esperandoSeg: number;
    /** 0 aguardando, 1 passou de mão ou o responsável foi lembrado, 2 a escada chamou alguém. */
    degrau: 0 | 1 | 2;
    resumo: string | null;
    /** Em atendimento sem resposta: quem está com a conversa. */
    responsavel: string | null;
  }[];
  setores: {
    id: string;
    nome: string;
    naFila: number;
    semAceite: number;
    escaladas: number;
    emTurno: number;
    primeiraRespostaMedianaSeg: number | null;
  }[];
  pessoasEmTurno: { id: string; nome: string; carga: number }[];
  /** Conversas com alguém agora: quem está atendendo e se o hóspede espera resposta. */
  emAtendimento: {
    solicitacaoId: string;
    setor: string | null;
    setorId: string | null;
    quarto: string | null;
    resumo: string | null;
    responsavel: { id: string; nome: string };
    /** Desde quando está com o responsável atual. */
    comResponsavelSeg: number;
    /** Hóspede esperando resposta há quanto tempo (null: a equipe respondeu por último). */
    esperandoRespostaSeg: number | null;
    estado: EstadoSolicitacao;
  }[];
}
