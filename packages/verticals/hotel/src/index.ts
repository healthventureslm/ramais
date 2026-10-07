import { ConfigUnidade, type ItemConhecimento, type TemplateMeta } from '@ramais/contracts';
import { setoresHotel } from './catalogo.js';
import { textosHotel } from './textos.js';

export { setoresHotel, textosHotel };

/** Só precisa de template o que sai fora da janela de 24 h. 2 templates × 3 idiomas = 6 aprovações. */
export const templatesHotel: TemplateMeta[] = [
  {
    nome: 'atualizacao_solicitacao',
    categoria: 'UTILITY',
    variaveis: 1,
    corpo: {
      pt: 'Atualização do seu pedido no hotel: {{1}}',
      es: 'Actualización de su pedido en el hotel: {{1}}',
      en: 'Update on your hotel request: {{1}}',
    },
  },
  {
    nome: 'pedido_concluido',
    categoria: 'UTILITY',
    variaveis: 1,
    corpo: {
      pt: 'Seu pedido "{{1}}" foi concluído. Se precisar de algo, responda esta mensagem.',
      es: 'Su pedido "{{1}}" fue completado. Si necesita algo, responda este mensaje.',
      en: 'Your request "{{1}}" has been completed. If you need anything, reply to this message.',
    },
  },
];

/** Modelo da vertical. A unidade copia e ajusta. */
export const configHotel: ConfigUnidade = ConfigUnidade.parse({
  vertical: 'hotel',
  setores: setoresHotel,
  setorFallback: 'recepcao',
  textos: textosHotel,
  tempos: {},
  limites: {},
  palavrasChave: {
    encerrar: ['sair', 'encerrar', 'tchau', 'salir', 'terminar', 'exit', 'stop', 'bye'],
    humano: ['atendente', 'humano', 'pessoa', 'agente', 'human', 'person', 'persona', 'operador'],
    emergencia: ['emergencia', 'socorro', 'help me', 'ayuda urgente', 'incendio', 'fire'],
  },
  glossario: ['Wi-Fi', 'room service', 'minibar', 'check-in', 'check-out', 'concierge'],
  templates: templatesHotel,
});

/** Base de conhecimento de exemplo. Cada hotel substitui pelos próprios dados no onboarding. */
export const conhecimentoHotelExemplo: ItemConhecimento[] = [
  { id: 'wifi', pergunta: 'Qual a senha do Wi-Fi?', resposta: 'Rede "Hotel-Hospedes", senha impressa no cartão do quarto. Se não encontrar, a recepção informa.', tags: ['wifi', 'internet'] },
  { id: 'cafe', pergunta: 'Qual o horário do café da manhã?', resposta: 'Café da manhã das 6h30 às 10h30, no restaurante do térreo. Fins de semana até 11h.', tags: ['cafe', 'breakfast'] },
  { id: 'checkout', pergunta: 'Qual o horário do check-out?', resposta: 'O check-out é até as 12h. Late check-out depende de disponibilidade: peça à recepção.', tags: ['checkout'] },
  { id: 'piscina', pergunta: 'Qual o horário da piscina?', resposta: 'A piscina funciona das 8h às 20h, no 2º andar. Toalhas de piscina ficam no local.', tags: ['piscina', 'pool'] },
  { id: 'academia', pergunta: 'Tem academia?', resposta: 'Sim, a academia funciona 24 h no 2º andar, com acesso pelo cartão do quarto.', tags: ['academia', 'gym'] },
  { id: 'estacionamento', pergunta: 'Tem estacionamento?', resposta: 'Sim, com manobrista, R$ 60 por diária. Peça o carro à recepção com 15 minutos de antecedência.', tags: ['estacionamento', 'parking'] },
];
