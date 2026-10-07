/**
 * Hotel de demonstração para apresentação comercial (VOA Hotéis): Wyndham Rio Barra.
 *
 * Fatos públicos do hotel (wyndhamhotels.com, out/2026): 181 quartos (apartamentos de luxo de
 * 42 m² e Suíte Master de 48 m², com varanda vista mar ou cidade), de frente para o mar na Barra
 * da Tijuca, piscinas, academia, Wi-Fi gratuito, café da manhã incluído, 5 espaços de eventos,
 * 37 km do Galeão, perto do BarraShopping e do Village Mall.
 *
 * O que NÃO é público e foi suposto (conferir com o hotel antes de usar com hóspede real):
 * horários de café, check-in/out, piscina e academia, numeração dos quartos e o estacionamento.
 * Tudo isso se edita depois em Administração → Base de conhecimento e → Quartos.
 */
export const DEMO = {
  organizacao: 'VOA Hotéis',
  unidade: 'Wyndham Rio Barra',
  /** Domínio dos e-mails de login. Não recebe e-mail: só identifica a conta. */
  dominioEmail: 'wyndham.demo',
};

export const DEMO_PESSOAS: {
  nome: string;
  usuario: string;
  admin?: boolean;
  gerente?: boolean;
  idiomas?: string[];
  setor?: string;
}[] = [
  { nome: 'Administração', usuario: 'admin', admin: true, idiomas: ['pt', 'en', 'es'] },
  { nome: 'Gerência', usuario: 'gerente', gerente: true, idiomas: ['pt', 'en', 'es'] },
  { nome: 'Recepção', usuario: 'recepcao', idiomas: ['pt', 'en', 'es'], setor: 'recepcao' },
  { nome: 'Governança', usuario: 'governanca', setor: 'governanca' },
  { nome: 'Manutenção', usuario: 'manutencao', setor: 'manutencao' },
  { nome: 'Restaurante', usuario: 'restaurante', idiomas: ['pt', 'en', 'es'], setor: 'alimentos_bebidas' },
  { nome: 'Concierge', usuario: 'concierge', idiomas: ['pt', 'en', 'es'], setor: 'concierge' },
];

/** 181 quartos: 13 andares (2º ao 14º) com 14 quartos cada, menos o último (1414). */
export const DEMO_QUARTOS = Array.from({ length: 13 }, (_, a) => a + 2)
  .flatMap((andar) => Array.from({ length: 14 }, (_, i) => `${andar}${String(i + 1).padStart(2, '0')}`))
  .slice(0, 181);

/** Hóspedes em casa durante a apresentação, de vários países (o chat traduz nos dois sentidos). */
export const DEMO_HOSPEDES = [
  { quarto: '201', sobrenome: 'Silva' },
  { quarto: '305', sobrenome: 'Smith' },
  { quarto: '412', sobrenome: 'Fernández' },
  { quarto: '508', sobrenome: 'Tanaka' },
  { quarto: '603', sobrenome: 'Müller' },
  { quarto: '714', sobrenome: 'Dubois' },
  { quarto: '809', sobrenome: 'Rossi' },
  { quarto: '902', sobrenome: 'Oliveira' },
  { quarto: '1006', sobrenome: 'Johnson' },
  { quarto: '1111', sobrenome: 'García' },
  { quarto: '1204', sobrenome: 'Kim' },
  { quarto: '1310', sobrenome: 'Costa' },
];

export const DEMO_CONHECIMENTO: { chave: string; pergunta: string; resposta: string; tags: string[] }[] = [
  {
    chave: 'wifi',
    pergunta: 'Qual a senha do Wi-Fi?',
    resposta: 'O Wi-Fi é gratuito em todo o hotel. A rede e a senha estão no cartão entregue no check-in; se precisar, a recepção informa.',
    tags: ['wifi', 'internet'],
  },
  {
    chave: 'cafe',
    pergunta: 'Qual o horário do café da manhã?',
    resposta: 'O café da manhã está incluído na diária: buffet no restaurante do hotel, todos os dias das 6h30 às 10h30.',
    tags: ['cafe', 'breakfast', 'restaurante'],
  },
  {
    chave: 'checkin-checkout',
    pergunta: 'Qual o horário do check-in e do check-out?',
    resposta: 'O check-in é a partir das 14h e o check-out até as 12h. Late check-out depende de disponibilidade: peça à recepção.',
    tags: ['checkin', 'checkout'],
  },
  {
    chave: 'piscina',
    pergunta: 'Qual o horário da piscina?',
    resposta: 'As piscinas funcionam das 8h às 20h, com vista para o mar. As toalhas ficam no local.',
    tags: ['piscina', 'pool'],
  },
  {
    chave: 'academia',
    pergunta: 'Tem academia?',
    resposta: 'Sim. A academia fica aberta 24 horas, com acesso pelo cartão do quarto.',
    tags: ['academia', 'gym'],
  },
  {
    chave: 'estacionamento',
    pergunta: 'Tem estacionamento?',
    resposta: 'Sim, com manobrista. Os valores e a retirada do carro são com a recepção; peça com 15 minutos de antecedência.',
    tags: ['estacionamento', 'parking', 'valet'],
  },
  {
    chave: 'endereco-praia',
    pergunta: 'Qual o endereço do hotel? A praia é perto?',
    resposta: 'O hotel fica na Av. Lúcio Costa, 3150, na Barra da Tijuca, de frente para o mar: a praia é do outro lado da avenida.',
    tags: ['endereco', 'praia', 'beach', 'localizacao'],
  },
  {
    chave: 'aeroporto',
    pergunta: 'Qual a distância até o aeroporto?',
    resposta: 'O Aeroporto Internacional do Galeão fica a cerca de 37 km. A recepção chama táxi ou transfer para você.',
    tags: ['aeroporto', 'airport', 'transfer', 'taxi'],
  },
  {
    chave: 'compras',
    pergunta: 'Tem shopping perto?',
    resposta: 'Sim, o BarraShopping e o Village Mall ficam perto do hotel. A recepção indica o caminho e chama táxi.',
    tags: ['shopping', 'compras'],
  },
  {
    chave: 'eventos',
    pergunta: 'O hotel tem espaço para eventos?',
    resposta: 'Sim, são 5 espaços para conferências, casamentos e celebrações, com equipe de planejamento. Fale com a recepção para agendar uma visita.',
    tags: ['eventos', 'reuniao', 'casamento'],
  },
  {
    chave: 'quartos',
    pergunta: 'Como são os quartos?',
    resposta: 'Os apartamentos de luxo têm 42 m² e a Suíte Master tem 48 m², todos com varanda privativa e vista para o mar ou para a cidade.',
    tags: ['quarto', 'suite', 'varanda'],
  },
  {
    chave: 'telefone',
    pergunta: 'Qual o telefone do hotel?',
    resposta: 'O telefone do hotel é +55 21 3139-8000. Por aqui mesmo você também fala com a equipe.',
    tags: ['telefone', 'contato'],
  },
];
