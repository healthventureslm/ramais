import type { Queue } from 'pg-boss';

/** Filas de trabalho. Criadas pela migração; a aplicação não cria nada em runtime. */
export const FILAS = {
  /** Payload bruto do webhook → mensagens e status. */
  webhook: { notify: true, retryLimit: 5, retryDelay: 2, retryBackoff: true, expireInSeconds: 120 },
  /**
   * Uma mensagem recebida → jornada. FIFO por conversa (singletonKey = canal:telefone):
   * duas mensagens da mesma pessoa nunca são processadas fora de ordem. O handler degrada
   * em vez de falhar, porque um job falho segura os seguintes da mesma conversa.
   */
  'mensagem-entrada': { notify: true, policy: 'key_strict_fifo', retryLimit: 5, retryDelay: 2, retryBackoff: true, expireInSeconds: 180 },
  /** Envio pela Meta, com retentativa crescente. */
  'mensagem-saida': { notify: true, retryLimit: 8, retryDelay: 5, retryBackoff: true, retryDelayMax: 600, expireInSeconds: 60 },
  /** Temporizadores invalidáveis: carregam a versão que esperam e não fazem nada se ela mudou. */
  temporizador: { notify: true, retryLimit: 3, retryDelay: 5, expireInSeconds: 60 },
  /** Redistribuição de um setor (fila andou, alguém entrou no turno, oferta expirou). */
  distribuir: { notify: true, retryLimit: 3, retryDelay: 2, expireInSeconds: 60 },
  /** Rede de segurança a cada minuto. */
  varredura: { retryLimit: 0, expireInSeconds: 50, policy: 'singleton' },
  /** Áudio enviado pela equipe → transcrição; depois libera o envio ao hóspede. */
  'midia-derivar': { notify: true, retryLimit: 2, retryDelay: 5, expireInSeconds: 120 },
  /** Push para o app. */
  notificacao: { notify: true, retryLimit: 4, retryDelay: 3, retryBackoff: true, expireInSeconds: 30 },
} satisfies Record<string, Omit<Queue, 'name'>>;

export type NomeFila = keyof typeof FILAS;

export type DadosTemporizador =
  | { tipo: 'oferta_expira'; orgId: string; ofertaId: string }
  | { tipo: 'inatividade_aviso'; orgId: string; solicitacaoId: string; versao: number }
  | { tipo: 'inatividade_encerra'; orgId: string; solicitacaoId: string; versao: number }
  | { tipo: 'espera_longa'; orgId: string; solicitacaoId: string; versao: number }
  /** Olhar a escada de escalonamento da solicitação (idempotente: o que já foi feito não repete). */
  | { tipo: 'escada'; orgId: string; solicitacaoId: string };
