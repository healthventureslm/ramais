/**
 * Hotel de demonstração para apresentação comercial (VOA Hotéis): Wyndham Rio Barra.
 *
 * Fatos públicos do hotel (wyndhamhotels.com, out/2026): 181 quartos (apartamentos de luxo de
 * 42 m² e Suíte Master de 48 m², com varanda vista mar ou cidade), de frente para o mar na Barra
 * da Tijuca, piscinas, academia, Wi-Fi gratuito, café da manhã incluído, quartos para não
 * fumantes, 5 espaços de eventos, 37 km do Galeão, perto do BarraShopping e do Village Mall.
 *
 * O que NÃO é público e foi suposto (conferir com o hotel antes de usar com hóspede real): a
 * numeração dos quartos e as respostas da base marcadas com `suposto: true`. Tudo isso se edita
 * depois em Administração → Base de conhecimento e → Quartos.
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

/**
 * Base de conhecimento: só PERGUNTAS informativas. Pedido ("me manda toalha", "o ar não gela") não
 * entra aqui: vai para o setor pelo roteamento, e uma entrada parecida faria a IA explicar em vez
 * de encaminhar. Também fica de fora a política que não conhecemos (pets, visitas, voltagem):
 * uma resposta "consulte a recepção" encerraria a pergunta sem ninguém da equipe ver.
 *
 * `suposto: true` = não é dado público do hotel; conferir com o Wyndham antes de usar com hóspede
 * real (Administração → Base de conhecimento).
 */
export const DEMO_CONHECIMENTO: { chave: string; pergunta: string; resposta: string; tags: string[]; suposto?: boolean }[] = [
  // ---------- Chegada, saída e conta ----------
  {
    chave: 'checkin-checkout',
    pergunta: 'Qual o horário do check-in e do check-out?',
    resposta: 'O check-in é a partir das 14h e o check-out até as 12h. Late check-out depende de disponibilidade: peça à recepção.',
    tags: ['checkin', 'checkout', 'horario'],
    suposto: true,
  },
  {
    chave: 'checkin-antecipado',
    pergunta: 'Posso fazer o check-in mais cedo ou entrar no quarto antes das 14h?',
    resposta:
      'O check-in antecipado depende da disponibilidade do quarto. Avise por aqui o horário de chegada; se o quarto ainda não estiver pronto, a recepção guarda a sua bagagem.',
    tags: ['checkin', 'early', 'antecipado'],
  },
  {
    chave: 'documentos',
    pergunta: 'Quais documentos preciso apresentar no check-in?',
    resposta:
      'Um documento oficial com foto de cada hóspede (RG ou CNH; estrangeiros, passaporte). Menores de idade precisam de documento e, sem os pais, de autorização conforme a lei.',
    tags: ['documento', 'checkin', 'passaporte', 'id'],
  },
  {
    chave: 'bagagem',
    pergunta: 'Posso deixar a bagagem no hotel depois do check-out?',
    resposta: 'Sim. A recepção guarda a bagagem no dia do check-out, sem custo, até a sua saída.',
    tags: ['bagagem', 'mala', 'luggage', 'checkout'],
    suposto: true,
  },
  {
    chave: 'pagamento',
    pergunta: 'Quais formas de pagamento o hotel aceita?',
    resposta: 'Cartões de crédito e débito das principais bandeiras e Pix. Para outras formas de pagamento, fale com a recepção.',
    tags: ['pagamento', 'cartao', 'pix', 'payment'],
    suposto: true,
  },
  {
    chave: 'nota-fiscal',
    pergunta: 'Como recebo a nota fiscal da hospedagem?',
    resposta: 'A nota fiscal é emitida pela recepção no check-out. Se precisar dela em nome de uma empresa, informe o CNPJ antes do fechamento da conta.',
    tags: ['nota', 'fiscal', 'invoice', 'cnpj', 'conta'],
  },

  // ---------- Quarto ----------
  {
    chave: 'quartos',
    pergunta: 'Como são os quartos?',
    resposta: 'Os apartamentos de luxo têm 42 m² e a Suíte Master tem 48 m², todos com varanda privativa e vista para o mar ou para a cidade.',
    tags: ['quarto', 'suite', 'varanda'],
  },
  {
    chave: 'nao-fumantes',
    pergunta: 'Posso fumar no quarto ou na varanda?',
    resposta: 'Os quartos são para não fumantes, inclusive a varanda. Fumar só é permitido nas áreas externas indicadas.',
    tags: ['fumar', 'cigarro', 'smoking'],
  },
  {
    chave: 'cofre',
    pergunta: 'Tem cofre no quarto?',
    resposta: 'Sim, há um cofre eletrônico no armário do quarto; as instruções de uso ficam junto dele.',
    tags: ['cofre', 'safe'],
    suposto: true,
  },
  {
    chave: 'frigobar',
    pergunta: 'Os itens do frigobar são cobrados?',
    resposta: 'Sim. O consumo do frigobar é lançado na conta do quarto, conforme a tabela de preços que fica junto dele.',
    tags: ['frigobar', 'minibar', 'cobranca'],
  },
  {
    chave: 'ar-condicionado',
    pergunta: 'Como ligo o ar-condicionado?',
    resposta:
      'O controle remoto do ar-condicionado fica no quarto. Para ele funcionar, o cartão do quarto precisa estar no economizador de energia, ao lado da porta.',
    tags: ['ar', 'condicionado', 'air', 'conditioning', 'controle'],
    suposto: true,
  },
  {
    chave: 'arrumacao',
    pergunta: 'Que horas o quarto é arrumado?',
    resposta:
      'A governança arruma os quartos durante o dia, em geral entre 9h e 16h. Se não quiser arrumação, use a placa "Não perturbe"; se preferir outro horário, avise por aqui.',
    tags: ['arrumacao', 'limpeza', 'housekeeping', 'governanca'],
    suposto: true,
  },
  {
    chave: 'troca-toalhas',
    pergunta: 'Com que frequência trocam as toalhas?',
    resposta:
      'Deixe no chão do banheiro as toalhas que quiser trocar; as penduradas indicam que você vai reutilizá-las. Para trocar a roupa de cama, é só pedir por aqui.',
    tags: ['toalha', 'troca', 'sustentabilidade', 'towels'],
  },

  // ---------- Alimentação ----------
  {
    chave: 'cafe',
    pergunta: 'Qual o horário do café da manhã?',
    resposta: 'O café da manhã está incluído na diária: buffet no restaurante do hotel, todos os dias das 6h30 às 10h30.',
    tags: ['cafe', 'breakfast', 'restaurante'],
    suposto: true,
  },
  {
    chave: 'restaurante',
    pergunta: 'O restaurante serve almoço e jantar? Qual o horário?',
    resposta: 'Sim. O restaurante do hotel serve almoço das 12h às 15h e jantar das 19h às 23h.',
    tags: ['restaurante', 'almoco', 'jantar', 'lunch', 'dinner'],
    suposto: true,
  },
  {
    chave: 'room-service',
    pergunta: 'Tem serviço de quarto?',
    resposta: 'Sim, o serviço de quarto funciona 24 horas, com o cardápio que fica no quarto. Você pode fazer o pedido por aqui mesmo.',
    tags: ['room', 'service', 'servico', 'quarto', 'cardapio'],
    suposto: true,
  },
  {
    chave: 'bar',
    pergunta: 'Tem bar no hotel? Até que horas funciona?',
    resposta: 'Sim, o bar do hotel funciona das 17h à meia-noite, com drinks e petiscos.',
    tags: ['bar', 'drinks', 'bebida'],
    suposto: true,
  },
  {
    chave: 'restricoes-alimentares',
    pergunta: 'Vocês têm opções vegetarianas ou sem glúten?',
    resposta: 'Sim, o café da manhã e o restaurante têm opções vegetarianas e sem glúten. Em caso de alergia, avise a equipe antes de pedir.',
    tags: ['vegetariano', 'vegano', 'gluten', 'alergia', 'dieta'],
    suposto: true,
  },

  // ---------- Lazer ----------
  {
    chave: 'piscina',
    pergunta: 'Qual o horário da piscina?',
    resposta: 'As piscinas funcionam das 8h às 20h, com vista para o mar. As toalhas ficam no local.',
    tags: ['piscina', 'pool'],
    suposto: true,
  },
  {
    chave: 'toalha-praia',
    pergunta: 'O hotel tem toalha para levar à praia?',
    resposta: 'Sim, as toalhas de piscina também podem ir para a praia: retire na piscina e devolva no mesmo dia.',
    tags: ['toalha', 'praia', 'beach'],
    suposto: true,
  },
  {
    chave: 'academia',
    pergunta: 'Tem academia?',
    resposta: 'Sim. A academia fica aberta 24 horas, com acesso pelo cartão do quarto.',
    tags: ['academia', 'gym'],
    suposto: true,
  },

  // ---------- Localização e transporte ----------
  {
    chave: 'endereco-praia',
    pergunta: 'Qual o endereço do hotel? A praia é perto?',
    resposta: 'O hotel fica na Av. Lúcio Costa, 3150, na Barra da Tijuca, de frente para o mar: a praia é do outro lado da avenida.',
    tags: ['endereco', 'praia', 'beach', 'localizacao'],
  },
  {
    chave: 'aeroporto',
    pergunta: 'Qual a distância até o aeroporto?',
    resposta: 'O Aeroporto Internacional do Galeão fica a cerca de 37 km e o Santos Dumont, a cerca de 30 km. A recepção chama táxi ou transfer para você.',
    tags: ['aeroporto', 'airport', 'transfer', 'galeao', 'santos dumont'],
  },
  {
    chave: 'taxi',
    pergunta: 'Como pego um táxi ou chamo um Uber ou 99?',
    resposta: 'A recepção chama um táxi para você. Uber e 99 também funcionam bem na Barra; o embarque é na entrada principal do hotel.',
    tags: ['taxi', 'uber', '99', 'transporte'],
  },
  {
    chave: 'metro',
    pergunta: 'Tem metrô perto do hotel?',
    resposta:
      'A estação mais próxima é a Jardim Oceânico, da Linha 4, que liga a Barra a São Conrado, Ipanema, Copacabana e ao Centro. Até lá, o melhor é ir de táxi ou aplicativo.',
    tags: ['metro', 'subway', 'transporte'],
  },
  {
    chave: 'passeios',
    pergunta: 'O que tem para fazer perto do hotel? Que passeios vocês recomendam?',
    resposta:
      'A praia da Barra fica em frente ao hotel, e o BarraShopping e o Village Mall estão perto. Para Cristo Redentor, Pão de Açúcar e outros passeios, a concierge sugere roteiros e chama o transporte.',
    tags: ['passeio', 'turismo', 'tour', 'cristo', 'pao de acucar'],
  },
  {
    chave: 'compras',
    pergunta: 'Tem shopping perto?',
    resposta: 'Sim, o BarraShopping e o Village Mall ficam perto do hotel. A recepção indica o caminho e chama táxi.',
    tags: ['shopping', 'compras'],
  },
  {
    chave: 'cambio',
    pergunta: 'Onde troco ou saco dinheiro?',
    resposta: 'Há casas de câmbio e caixas eletrônicos no BarraShopping e no Village Mall. Cartões e Pix são aceitos em quase todo lugar.',
    tags: ['cambio', 'dinheiro', 'caixa', 'atm', 'exchange'],
  },
  {
    chave: 'farmacia',
    pergunta: 'Tem farmácia perto?',
    resposta: 'Sim, há farmácias na Av. Lúcio Costa e nos shoppings próximos, e muitas entregam no hotel. A recepção indica a mais próxima.',
    tags: ['farmacia', 'remedio', 'pharmacy'],
  },
  {
    chave: 'hospital-emergencia',
    pergunta: 'Qual o número de emergência? Tem hospital perto?',
    resposta:
      'Em emergência, escreva aqui ou ligue para a recepção. No Brasil: 192 (SAMU), 193 (Bombeiros) e 190 (Polícia). Há hospitais particulares na Barra da Tijuca; a recepção indica o mais próximo e chama transporte.',
    tags: ['emergencia', 'hospital', 'medico', 'samu', 'policia'],
  },

  // ---------- Serviços ----------
  {
    chave: 'wifi',
    pergunta: 'Qual a senha do Wi-Fi?',
    resposta: 'O Wi-Fi é gratuito em todo o hotel. A rede e a senha estão no cartão entregue no check-in; se precisar, a recepção informa.',
    tags: ['wifi', 'internet'],
  },
  {
    chave: 'estacionamento',
    pergunta: 'Tem estacionamento?',
    resposta: 'Sim, com manobrista. Os valores e a retirada do carro são com a recepção; peça com 15 minutos de antecedência.',
    tags: ['estacionamento', 'parking', 'valet'],
    suposto: true,
  },
  {
    chave: 'lavanderia',
    pergunta: 'O hotel tem lavanderia?',
    resposta: 'Sim, com cobrança por peça. O saco e a lista de preços ficam no armário do quarto; peça a retirada por aqui.',
    tags: ['lavanderia', 'roupa', 'laundry'],
    suposto: true,
  },
  {
    chave: 'eventos',
    pergunta: 'O hotel tem espaço para eventos?',
    resposta: 'Sim, são 5 espaços para conferências, casamentos e celebrações, com equipe de planejamento. Fale com a recepção para agendar uma visita.',
    tags: ['eventos', 'reuniao', 'casamento'],
  },
  {
    chave: 'silencio',
    pergunta: 'O hotel tem horário de silêncio?',
    resposta: 'Sim. Pedimos silêncio das 22h às 8h, para o descanso de todos os hóspedes.',
    tags: ['silencio', 'barulho', 'noise'],
    suposto: true,
  },
  {
    chave: 'telefone',
    pergunta: 'Qual o telefone do hotel?',
    resposta: 'O telefone do hotel é +55 21 3139-8000. Por aqui mesmo você também fala com a equipe.',
    tags: ['telefone', 'contato'],
  },

  // ---------- Este chat ----------
  {
    chave: 'como-funciona-chat',
    pergunta: 'Como funciona este chat?',
    resposta:
      'Escreva aqui o que precisar, a qualquer hora e no seu idioma: o pedido vai direto para o setor certo, e a equipe responde por aqui mesmo. Também dá para mandar foto e áudio.',
    tags: ['chat', 'ajuda', 'como', 'funciona'],
  },
  {
    chave: 'idiomas',
    pergunta: 'A equipe fala inglês ou espanhol?',
    resposta:
      'Pode escrever em qualquer idioma: a equipe recebe a mensagem traduzida e a resposta chega no seu idioma. A recepção e a concierge também atendem em inglês e espanhol.',
    tags: ['idioma', 'ingles', 'espanhol', 'english', 'language'],
  },
];
