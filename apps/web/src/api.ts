import type {
  ArquivoMidia,
  ConfigUnidade,
  DashboardView,
  PedidoApoioReq,
  Sessao,
  SolicitacaoDetalhe,
  SolicitacaoResumo,
  TransferirReq,
} from '@ramais/contracts';

// A API sempre vem pela mesma origem, em /api: no desenvolvimento pelo proxy do Vite, em produção
// pelo nginx do contêiner web. Um build serve qualquer ambiente (localhost, túnel, domínio) e
// o navegador não precisa de CORS.
export const API = `${window.location.origin}/api`;

const CHAVE = 'ramais.sessao';

export function sessaoSalva(): Sessao | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? (JSON.parse(s) as Sessao) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: a sessão vale só nesta aba
  }
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let aoExpirar: () => void = () => undefined;
export function quandoExpirar(fn: () => void) {
  aoExpirar = fn;
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const token = sessaoSalva()?.token;
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (r.status === 401 && token) aoExpirar();
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    const msg = json?.message?.mensagem ?? json?.message ?? json?.mensagem ?? `erro ${r.status}`;
    throw new ErroApi(r.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json as T;
}

export type Filtro = 'minhas' | 'setores' | 'unidade' | 'fechadas';

export interface Oferta {
  ofertaId: string;
  solicitacaoId: string;
  expiraEm: string;
  resumo: string | null;
  urgencia: string;
  setor: string | null;
}

export interface Setor {
  id: string;
  chave: string;
  nome: string;
  emTurno: number;
}

export interface PessoaBusca {
  id: string;
  nome: string;
  /** App ou web aberta agora. */
  online: boolean;
  emTurno: boolean;
  /** Conversas abertas em nome da pessoa. */
  atendendo: number;
  setores: string | null;
}

export interface LocalBusca {
  id: string;
  identificador: string;
  tipo: string;
  hospede: string | null;
}

export interface Eu extends Omit<Sessao, 'token'> {
  turno: { id: string; unidade_id: string; inicio: string } | null;
}

export interface ConversaDireta {
  id: string;
  solicitacao_id: string | null;
  outros: { id: string; nome: string }[];
  ultima: { texto: string | null; tipo: TipoMidiaDireta; criado_em: string; autor_id: string; urgente: boolean; ciente_em: string | null } | null;
  urgentes_pendentes: number;
}

export type TipoMidiaDireta = 'texto' | 'imagem' | 'audio';

export interface MensagemDireta {
  id: string;
  /** Texto, ou a legenda da foto. */
  texto: string | null;
  tipo: TipoMidiaDireta;
  transcricao: string | null;
  midia_url: string | null;
  urgente: boolean;
  ciente_em: string | null;
  criado_em: string;
  autor_id: string;
  autor_nome: string;
}

export type Papel = 'membro' | 'supervisor';
export type Recebe = 'sempre' | 'ultimo_recurso' | 'nunca';
export interface Lotacao {
  setorId: string;
  papel: Papel;
  recebe: Recebe;
  limiteCarga: number;
}

export interface PessoaEquipe {
  id: string;
  nome: string;
  email: string;
  idiomas: string[];
  admin: boolean;
  gerente: boolean;
  ativo: boolean;
  trocarSenha: boolean;
  temPin: boolean;
  pinBloqueado: boolean;
  emTurno: boolean;
  lotacoes: Lotacao[];
}

export interface PessoaForm {
  unidadeId: string;
  nome: string;
  idiomas: string[];
  admin: boolean;
  gerente: boolean;
  lotacoes: Lotacao[];
}

export interface Credenciais {
  senhaTemporaria?: string;
  pin?: string;
}

export interface ItemConhecimento {
  id: string;
  chave: string;
  pergunta: string;
  resposta: string;
  tags: string[];
  ativo: boolean;
  usos: number;
}

export interface TesteConhecimento {
  responderia: boolean;
  resposta: string | null;
  confianca: number;
  limite: number;
  fontes: string[];
  motor: string | null;
  motivo?: string;
}

export interface Quarto {
  id: string;
  identificador: string;
  tipo: string;
  ativo: boolean;
  hospede: string | null;
  link: string | null;
}

/** whatsapp: o QR abre o WhatsApp do hotel. web: abre o chat do quarto no navegador. */
export type DestinoQr = 'whatsapp' | 'web';
export interface DadosQuartos {
  numeroWhatsapp: string | null;
  destino: DestinoQr;
  quartos: Quarto[];
}

/** Números de um período: os do período atual e, em `anterior`, os do período anterior do mesmo tamanho. */
export interface NumerosPeriodo {
  pedidos: number;
  apoios: number;
  pelaIa: number;
  escalados: number;
  abertos: number;
  resolvidos: number;
  primeiraRespostaP50: number | null;
  primeiraRespostaP90: number | null;
  resolucaoP50: number | null;
  custoIaUsd: number;
}

/** Uso do mês corrente (no fuso da unidade), por canal: base da tela de Simulação. */
export interface UsoMes {
  inicio: string;
  diasDecorridos: number;
  diasNoMes: number;
  quartos: number;
  pedidos: { whatsapp: number; web: number };
  mensagensHospede: { whatsapp: number; web: number };
  mensagensHotel: { whatsapp: number; web: number };
  iaUsd: number;
  iaChamadas: number;
}

export interface Relatorio {
  dias: number;
  geral: NumerosPeriodo & { aceiteP50: number | null; ofertasExpiradas: number; ofertasRecusadas: number; ofertas: number };
  anterior: NumerosPeriodo;
  setores: {
    nome: string;
    pedidos: number;
    escalados: number;
    resolvidos: number;
    primeiraRespostaP50: number | null;
    primeiraRespostaP90: number | null;
    resolucaoP50: number | null;
    nota: number | null;
  }[];
  pessoas: {
    id: string;
    nome: string;
    atendimentos: number;
    resolvidos: number;
    respostas: number;
    assumidos: number;
    primeiraRespostaP50: number | null;
    nota: number | null;
  }[];
  pesquisa: { respostas: number; media: number | null; distribuicao: { nota: number; n: number }[] };
  idiomas: { idioma: string | null; n: number }[];
  canais: { whatsapp: number; web: number };
  mensagens: { doHospede: number; texto: number; audio: number; foto: number; daEquipe: number; automaticas: number; notas: number; falharam: number };
  porDia: { dia: string; n: number; whatsapp: number; web: number; custo: number }[];
  porHora: { hora: number; n: number }[];
  escada: { avisos: number; lembretes: number; repassadas: number; assumidas: number; transferidas: number; emergencias: number; enviosFalharam: number };
  ia: { decisoes: number; comCerteza: number; triagemConfirmadas: number; triagemCorrigidas: number; confiancaMedia: number | null };
  custo: {
    totalUsd: number;
    porPedidoUsd: number | null;
    chamadas: number;
    porTarefa: { tarefa: string; chamadas: number; falhas: number; usd: number; tokens: number; latenciaMs: number | null }[];
    porModelo: { modelo: string; chamadas: number; usd: number }[];
  };
}

export const api = {
  login: (email: string, senha: string) => chamar<Sessao>('POST', '/auth/login', { email, senha }),
  eu: () => chamar<Eu>('GET', '/auth/eu'),
  trocarSenha: (atual: string, nova: string) => chamar('POST', '/auth/senha', { atual, nova }),
  entrarTurno: (unidadeId: string) => chamar<{ presencaId: string }>('POST', '/turno/entrar-web', { unidadeId }),
  sairTurno: () => chamar('POST', '/turno/sair', { conversas: 'devolver_fila' }),

  listar: (filtro: Filtro, unidadeId: string) =>
    chamar<SolicitacaoResumo[]>('GET', `/solicitacoes?filtro=${filtro}&unidadeId=${unidadeId}`),
  detalhe: (id: string) => chamar<SolicitacaoDetalhe>('GET', `/solicitacoes/${id}`),
  responder: (id: string, texto: string, visibilidade: 'externa' | 'interna') =>
    chamar('POST', `/solicitacoes/${id}/mensagens`, { texto, visibilidade }),
  enviarMidia: (id: string, a: ArquivoMidia, legenda: string | null, visibilidade: 'externa' | 'interna') =>
    chamar<{ mensagemId: string }>('POST', `/solicitacoes/${id}/midia`, { ...a, legenda: legenda ?? undefined, visibilidade }),
  previa: (id: string, texto: string) =>
    chamar<{ texto: string; idioma: string; alerta: string | null; necessaria: boolean }>('POST', `/solicitacoes/${id}/previa-traducao`, { texto }),
  pegar: (id: string) => chamar('POST', `/solicitacoes/${id}/pegar`),
  /** Supervisão do setor, gerente ou admin tira a conversa de quem está atendendo. */
  assumir: (id: string) => chamar('POST', `/solicitacoes/${id}/assumir`),
  triar: (id: string, setorId: string) => chamar('POST', `/solicitacoes/${id}/triagem`, { setorId }),
  transferir: (id: string, b: TransferirReq) => chamar('POST', `/solicitacoes/${id}/transferir`, b),
  apoio: (id: string, b: PedidoApoioReq) => chamar<{ solicitacaoId: string }>('POST', `/solicitacoes/${id}/apoio`, b),
  resolver: (id: string) => chamar('POST', `/solicitacoes/${id}/resolver`),
  encerrar: (id: string) => chamar('POST', `/solicitacoes/${id}/encerrar`),
  confirmarLocal: (id: string, localId: string) => chamar('POST', `/solicitacoes/${id}/confirmar-local`, { localId }),

  ofertas: () => chamar<Oferta[]>('GET', '/ofertas'),
  aceitar: (id: string) => chamar<{ solicitacaoId: string }>('POST', `/ofertas/${id}/aceitar`),
  recusar: (id: string) => chamar('POST', `/ofertas/${id}/recusar`),

  setores: (unidadeId: string) => chamar<Setor[]>('GET', `/setores?unidadeId=${unidadeId}`),
  pessoas: (unidadeId: string, busca: string) =>
    chamar<PessoaBusca[]>('GET', `/pessoas?unidadeId=${unidadeId}&busca=${encodeURIComponent(busca)}`),
  locais: (unidadeId: string, busca: string) =>
    chamar<LocalBusca[]>('GET', `/locais?unidadeId=${unidadeId}&busca=${encodeURIComponent(busca)}`),
  dashboard: (unidadeId: string) => chamar<DashboardView>('GET', `/dashboard?unidadeId=${unidadeId}`),

  diretas: () => chamar<ConversaDireta[]>('GET', '/diretas'),
  direta: (id: string) => chamar<MensagemDireta[]>('GET', `/diretas/${id}`),
  enviarDireta: (paraPessoaId: string, texto: string, urgente: boolean) =>
    chamar<{ conversaId: string; foraDoTurno: boolean; destinatario: string }>('POST', '/diretas', { paraPessoaId, texto, urgente }),
  enviarDiretaMidia: (paraPessoaId: string, a: ArquivoMidia, legenda: string | null, urgente: boolean) =>
    chamar<{ conversaId: string; foraDoTurno: boolean; destinatario: string }>('POST', '/diretas/midia', {
      paraPessoaId,
      ...a,
      legenda: legenda ?? undefined,
      urgente,
    }),
  ciente: (mensagemId: string) => chamar('POST', `/diretas/mensagens/${mensagemId}/ciente`),

  admin: {
    pessoas: (unidadeId: string) => chamar<PessoaEquipe[]>('GET', `/admin/pessoas?unidadeId=${unidadeId}`),
    criarPessoa: (b: PessoaForm & { email: string }) => chamar<Credenciais & { id: string }>('POST', '/admin/pessoas', b),
    salvarPessoa: (id: string, b: PessoaForm & { ativo: boolean }) => chamar('PUT', `/admin/pessoas/${id}`, b),
    redefinir: (id: string, b: { senha: boolean; pin: boolean }) => chamar<Credenciais>('POST', `/admin/pessoas/${id}/redefinir`, b),

    conhecimento: (unidadeId: string) => chamar<ItemConhecimento[]>('GET', `/admin/conhecimento?unidadeId=${unidadeId}`),
    criarConhecimento: (unidadeId: string, b: { pergunta: string; resposta: string; tags: string[]; ativo: boolean }) =>
      chamar<{ id: string }>('POST', '/admin/conhecimento', { unidadeId, ...b }),
    salvarConhecimento: (id: string, b: { pergunta: string; resposta: string; tags: string[]; ativo: boolean }) =>
      chamar('PUT', `/admin/conhecimento/${id}`, b),
    testarConhecimento: (unidadeId: string, pergunta: string) =>
      chamar<TesteConhecimento>('POST', '/admin/conhecimento/testar', { unidadeId, pergunta }),

    quartos: (unidadeId: string) => chamar<DadosQuartos>('GET', `/admin/quartos?unidadeId=${unidadeId}`),
    destinoQr: (unidadeId: string, destino: DestinoQr) => chamar('PUT', '/admin/quartos/destino', { unidadeId, destino }),
    criarQuartos: (unidadeId: string, identificadores: string, tipo: string) =>
      chamar<{ criados: number; existentes: number }>('POST', '/admin/quartos', { unidadeId, identificadores, tipo }),
    salvarQuarto: (id: string, identificador: string, ativo: boolean) => chamar('PUT', `/admin/quartos/${id}`, { identificador, ativo }),
    novoCodigo: (id: string) => chamar('POST', `/admin/quartos/${id}/novo-codigo`),

    relatorio: (unidadeId: string, dias: number) => chamar<Relatorio>('GET', `/admin/relatorio?unidadeId=${unidadeId}&dias=${dias}`),
    usoMes: (unidadeId: string) => chamar<UsoMes>('GET', `/admin/relatorio/mes?unidadeId=${unidadeId}`),

    automacao: (unidadeId: string) =>
      chamar<
        {
          setorId: string;
          chave: string;
          nome: string;
          modo: 'sombra' | 'automatico';
          avaliadas: number;
          acerto: number | null;
          pendentes: number;
          faltam: number;
          recomendacao: 'pode_liberar' | 'voltar_sombra' | null;
        }[]
      >('GET', `/admin/automacao?unidadeId=${unidadeId}`),
    modoIa: (setorId: string, modo: 'sombra' | 'automatico') => chamar('POST', '/admin/setores/modo-ia', { setorId, modo }),
    jornadas: (unidadeId: string) =>
      chamar<{ id: string; numero: number; config: ConfigUnidade; publicada_em: string; vigente: boolean }[]>(
        'GET',
        `/admin/jornada?unidadeId=${unidadeId}`,
      ),
    validar: (unidadeId: string, config: unknown) =>
      chamar<{ valido: boolean; erros: { campo: string; erro: string }[]; avisos: string[] }>('POST', '/admin/jornada/validar', { unidadeId, config }),
    simular: (unidadeId: string, config: unknown, texto: string, quarto: string | null) =>
      chamar<{ ok: boolean }>('POST', '/admin/simulador/mensagem', { unidadeId, config, texto, quarto }),
    simuladorReiniciar: (unidadeId: string) => chamar('POST', '/admin/simulador/reiniciar', { unidadeId }),
    simulador: (unidadeId: string) =>
      chamar<{
        conversa: { id: string; estado: string; setor: string | null; triagem: string | null; versao: string; dados: Record<string, unknown> } | null;
        mensagens?: { id: string; autor: string; interna: boolean; texto: string; criadoEm: string }[];
        eventos?: { tipo: string; dados: Record<string, any>; criado_em: string }[];
      }>('GET', `/admin/simulador?unidadeId=${unidadeId}`),
    publicar: (unidadeId: string, config: unknown, nota: string) =>
      chamar<{ id: string; numero: number; avisos: string[] }>('POST', '/admin/jornada', { unidadeId, config, nota }),
    dispositivo: (unidadeId: string, nome: string) =>
      chamar<{ dispositivoId: string; codigo: string; expiraEm: string }>('POST', '/admin/dispositivos', { unidadeId, nome }),
    hospedes: (unidadeId: string, hospedes: { quarto: string; sobrenome: string; checkin: string; checkout: string }[]) =>
      chamar<{ importados: number; ignorados: string[] }>('POST', '/admin/hospedes', { unidadeId, substituir: true, hospedes }),
    calibracao: (unidadeId: string) =>
      chamar<{
        total: number;
        acuracia: number;
        auroc: number | null;
        faixas: { de: number; ate: number; n: number; acuracia: number | null }[];
        matriz: Record<string, Record<string, number>>;
        limiteSugeridoEncaminhar: number | null;
        limiteSugeridoBaixaCerteza: number | null;
        erros: { previsto: string; correto: string; confianca: number; texto: string | null }[];
      }>('GET', `/admin/calibracao?unidadeId=${unidadeId}`),
  },

  /** Mídia passa pela API (confere acesso); vira blob URL para <img>/<audio>. */
  async midia(caminho: string): Promise<string> {
    const token = sessaoSalva()?.token;
    const r = await fetch(API + caminho, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new ErroApi(r.status, 'mídia indisponível');
    return URL.createObjectURL(await r.blob());
  },
};
