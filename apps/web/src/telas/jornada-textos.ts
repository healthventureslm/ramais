import type { ConfigUnidade } from '@ramais/contracts';

/** Textos fixos da configuração, com o nome e quando cada um é usado. */
export const TEXTOS: { chave: keyof ConfigUnidade['textos']; nome: string; quando: string }[] = [
  { chave: 'boas_vindas', nome: 'Boas-vindas', quando: 'Início da conversa (quando o fluxo usar).' },
  { chave: 'pedir_detalhe', nome: 'Pedir detalhe', quando: 'A mensagem não tem pedido ("oi", "preciso de ajuda").' },
  { chave: 'pedir_identificacao', nome: 'Pedir quarto e sobrenome', quando: 'O setor exige identificação.' },
  { chave: 'identificacao_ok', nome: 'Identificação confirmada', quando: 'Quarto e sobrenome conferiram.' },
  { chave: 'identificacao_pendente', nome: 'Identificação não conferiu', quando: 'A recepção vai confirmar.' },
  { chave: 'encaminhado', nome: 'Encaminhado', quando: 'Pedido foi para um setor com certeza. Use {setor}.' },
  { chave: 'encaminhado_baixa_certeza', nome: 'Encaminhando (sem nomear o setor)', quando: 'IA sem certeza ou modo sombra.' },
  { chave: 'posicao_fila', nome: 'Posição na fila', quando: 'O hóspede reclama da demora. Use {posicao}.' },
  { chave: 'espera_longa', nome: 'Espera longa', quando: 'Ninguém aceitou e o supervisor foi chamado.' },
  { chave: 'emergencia', nome: 'Emergência', quando: 'Interrompe tudo. Inclua os telefones de emergência.' },
  { chave: 'humano', nome: 'Passar para uma pessoa', quando: 'O hóspede pede atendente.' },
  { chave: 'aviso_inatividade', nome: 'Aviso de inatividade', quando: 'O hóspede parou de responder. Use {minutos}.' },
  { chave: 'encerramento', nome: 'Encerramento por inatividade', quando: 'Depois do aviso, sem resposta.' },
  { chave: 'encerrado_pelo_solicitante', nome: 'Hóspede encerrou', quando: 'O hóspede escreveu "sair".' },
  { chave: 'resolvido', nome: 'Pedido concluído', quando: 'A equipe marcou como resolvido.' },
  { chave: 'nao_entendi_midia', nome: 'Arquivo sem texto', quando: 'Foto ou áudio que não deu para entender.' },
];
