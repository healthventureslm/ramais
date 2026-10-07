/**
 * Eventos enviados pelo Socket.IO. As salas são:
 *   unidade:<id>   tudo da unidade (dashboard, recepção)
 *   setor:<id>     fila do setor
 *   pessoa:<id>    ofertas e mensagens diretas
 *   solicitacao:<id> conversa aberta na tela
 */
export interface EventosServidor {
  'solicitacao:atualizada': (p: { solicitacaoId: string; unidadeId: string; setorId: string | null; estado: string }) => void;
  'solicitacao:mensagem': (p: { solicitacaoId: string; mensagemId: string }) => void;
  'oferta:nova': (p: { ofertaId: string; solicitacaoId: string; expiraEm: string; resumo: string | null }) => void;
  'oferta:encerrada': (p: { ofertaId: string; solicitacaoId: string; motivo: 'aceita' | 'expirada' | 'cancelada' | 'pega' }) => void;
  /** Degrau da escada: vai só para quem foi chamado. `motivo` diz se ninguém aceitou ou se ninguém respondeu. */
  'escalonamento:supervisor': (p: {
    solicitacaoId: string;
    setorId: string;
    esperandoSeg: number;
    motivo: 'sem_aceite' | 'sem_resposta';
    titulo: string;
  }) => void;
  'direta:nova': (p: { conversaId: string; mensagemId: string; de: string; urgente: boolean }) => void;
  /** A transcrição de um áudio ficou pronta. */
  'direta:atualizada': (p: { conversaId: string; mensagemId: string }) => void;
  'aviso': (p: { texto: string }) => void;
}

export interface EventosCliente {
  'assinar:solicitacao': (solicitacaoId: string) => void;
  'desassinar:solicitacao': (solicitacaoId: string) => void;
}

export const sala = {
  unidade: (id: string) => `unidade:${id}`,
  setor: (id: string) => `setor:${id}`,
  pessoa: (id: string) => `pessoa:${id}`,
  solicitacao: (id: string) => `solicitacao:${id}`,
};
