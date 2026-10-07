import type { Sessao, SolicitacaoDetalhe, SolicitacaoResumo } from '@ramais/contracts';
import * as SecureStore from 'expo-secure-store';

/**
 * Armazenamento seguro: o token do dispositivo (o celular do setor, cadastrado pelo admin)
 * e o token do turno (a pessoa que entrou com PIN). Sair do turno apaga o do turno.
 */
const K = { servidor: 'ramais.servidor', dispositivo: 'ramais.dispositivo', turno: 'ramais.turno' };

export const armazenamento = {
  servidor: () => SecureStore.getItemAsync(K.servidor),
  salvarServidor: (v: string) => SecureStore.setItemAsync(K.servidor, v),
  dispositivo: () => SecureStore.getItemAsync(K.dispositivo),
  salvarDispositivo: (v: string) => SecureStore.setItemAsync(K.dispositivo, v),
  async turno(): Promise<Sessao | null> {
    const s = await SecureStore.getItemAsync(K.turno);
    return s ? (JSON.parse(s) as Sessao) : null;
  },
  salvarTurno: (s: Sessao) => SecureStore.setItemAsync(K.turno, JSON.stringify(s)),
  limparTurno: () => SecureStore.deleteItemAsync(K.turno),
  async esquecerDispositivo() {
    await SecureStore.deleteItemAsync(K.turno);
    await SecureStore.deleteItemAsync(K.dispositivo);
  },
};

/** Foto ou áudio já em base64, como a API recebe. */
export interface ArquivoMidia {
  tipo: 'imagem' | 'audio';
  mime: string;
  base64: string;
}

export interface ConversaDireta {
  id: string;
  outros: { id: string; nome: string }[] | null;
  ultima: { texto: string | null; tipo: 'texto' | 'imagem' | 'audio'; criado_em: string; autor_id: string; urgente: boolean; ciente_em: string | null } | null;
  urgentes_pendentes: number;
}

export interface MensagemDireta {
  id: string;
  /** Texto, ou a legenda da foto. */
  texto: string | null;
  tipo: 'texto' | 'imagem' | 'audio';
  transcricao: string | null;
  midia_url: string | null;
  urgente: boolean;
  ciente_em: string | null;
  criado_em: string;
  autor_id: string;
  autor_nome: string;
}

export interface PessoaBusca {
  id: string;
  nome: string;
  emTurno: boolean;
  setores: string | null;
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Api {
  constructor(
    readonly base: string,
    private token: string | null,
  ) {}

  comToken(token: string | null) {
    return new Api(this.base, token);
  }

  /** Para <Image> e o player buscarem a mídia com a credencial do turno. */
  get cabecalhos(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {};
  }

  private async chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const r = await fetch(this.base + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    const json = texto ? JSON.parse(texto) : null;
    if (!r.ok) {
      const msg = json?.message?.mensagem ?? json?.message ?? `erro ${r.status}`;
      throw new ErroApi(r.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return json as T;
  }

  cadastrar(codigo: string, nome: string, plataforma: 'android' | 'ios') {
    return this.chamar<{ token: string; unidadeId: string }>('POST', '/auth/dispositivo', { codigo, nome, plataforma });
  }
  entrar(email: string, pin: string, pushToken?: string | null) {
    return this.chamar<Sessao>('POST', '/turno/entrar', { email, pin, pushToken: pushToken ?? undefined });
  }
  sair() {
    return this.chamar('POST', '/turno/sair', { conversas: 'devolver_fila' });
  }
  pushToken(token: string) {
    return this.chamar('POST', '/turno/push-token', { token });
  }
  ofertas() {
    return this.chamar<{ ofertaId: string; solicitacaoId: string; expiraEm: string; resumo: string | null; urgencia: string; setor: string | null }[]>(
      'GET',
      '/ofertas',
    );
  }
  aceitar(id: string) {
    return this.chamar<{ solicitacaoId: string }>('POST', `/ofertas/${id}/aceitar`);
  }
  recusar(id: string) {
    return this.chamar('POST', `/ofertas/${id}/recusar`);
  }
  minhas() {
    return this.chamar<SolicitacaoResumo[]>('GET', '/solicitacoes?filtro=minhas');
  }
  detalhe(id: string) {
    return this.chamar<SolicitacaoDetalhe>('GET', `/solicitacoes/${id}`);
  }
  responder(id: string, texto: string, visibilidade: 'externa' | 'interna') {
    return this.chamar('POST', `/solicitacoes/${id}/mensagens`, { texto, visibilidade });
  }
  enviarMidia(id: string, a: ArquivoMidia, legenda: string | null, visibilidade: 'externa' | 'interna') {
    return this.chamar<{ mensagemId: string }>('POST', `/solicitacoes/${id}/midia`, { ...a, legenda: legenda ?? undefined, visibilidade });
  }
  resolver(id: string) {
    return this.chamar('POST', `/solicitacoes/${id}/resolver`);
  }

  // ---------- Mensagens diretas (ramal entre pessoas) ----------
  diretas() {
    return this.chamar<ConversaDireta[]>('GET', '/diretas');
  }
  direta(id: string) {
    return this.chamar<MensagemDireta[]>('GET', `/diretas/${id}`);
  }
  enviarDireta(paraPessoaId: string, texto: string, urgente: boolean) {
    return this.chamar<{ conversaId: string; foraDoTurno: boolean; destinatario: string }>('POST', '/diretas', { paraPessoaId, texto, urgente });
  }
  enviarDiretaMidia(paraPessoaId: string, a: ArquivoMidia, legenda: string | null, urgente: boolean) {
    return this.chamar<{ conversaId: string; foraDoTurno: boolean; destinatario: string }>('POST', '/diretas/midia', {
      paraPessoaId,
      ...a,
      legenda: legenda ?? undefined,
      urgente,
    });
  }
  ciente(mensagemId: string) {
    return this.chamar('POST', `/diretas/mensagens/${mensagemId}/ciente`);
  }
  pessoas(unidadeId: string, busca: string) {
    return this.chamar<PessoaBusca[]>('GET', `/pessoas?unidadeId=${unidadeId}&busca=${encodeURIComponent(busca)}`);
  }
}
