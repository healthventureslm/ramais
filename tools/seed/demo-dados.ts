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

/**
 * Catálogo do hotel: o que o hóspede pede (compra) ou agenda (agendamento) pelo chat do quarto.
 *
 * ATENÇÃO: preços, horários, durações e vagas são EXEMPLOS plausíveis para um 4 estrelas na Barra
 * da Tijuca (out/2026), não a tabela do Wyndham. Conferir com o hotel antes de usar com hóspede
 * real; tudo se edita depois em Administração → Catálogo.
 *
 * Grade: um horário começa em `inicio` e precisa TERMINAR até `fim` (início + duração ≤ fim).
 * Passeio de saída única usa uma janela do tamanho exato da duração.
 */
export interface DemoItemCatalogo {
  /** Chave do setor que entrega ou atende (configHotel.setores). */
  setor: 'recepcao' | 'governanca' | 'manutencao' | 'alimentos_bebidas' | 'concierge';
  tipo: 'compra' | 'agendamento';
  categoria: string;
  nome: string;
  descricao: string;
  nomes: { es: string; en: string };
  descricoes?: { es?: string; en?: string };
  /** Nulo: sem preço (cortesia ou sob consulta, como diz a descrição). */
  precoCentavos: number | null;
  porPessoa?: boolean;
  maxQuantidade?: number;
  duracaoMin?: number;
  capacidade?: number | null;
  vagasPor?: 'pessoa' | 'pedido';
  horarios?: { dias: number[]; inicio: string; fim: string; intervaloMin: number }[];
  antecedenciaMin?: number;
  diasAFrente?: number;
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

export const DEMO_CATALOGO: DemoItemCatalogo[] = [
  // ---------- Room service (cozinha 24 h) ----------
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Club sandwich',
    descricao: 'Pão de forma tostado, peito de frango, bacon, alface, tomate e maionese, com batata frita.',
    nomes: { es: 'Club sándwich', en: 'Club sandwich' },
    precoCentavos: 6800,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Hambúrguer da casa',
    descricao: 'Blend bovino de 180 g, queijo prato, cebola caramelizada e molho da casa no pão brioche, com batata frita.',
    nomes: { es: 'Hamburguesa de la casa', en: 'House burger' },
    precoCentavos: 7400,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Salada caesar com frango',
    descricao: 'Alface romana, frango grelhado, croutons, parmesão e molho caesar.',
    nomes: { es: 'Ensalada César con pollo', en: 'Chicken Caesar salad' },
    precoCentavos: 5800,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Prato executivo do dia',
    descricao: 'Arroz, feijão, salada e a proteína do dia (peixe, frango ou carne). Pergunte qual é a de hoje.',
    nomes: { es: 'Plato ejecutivo del día', en: 'Daily set meal' },
    precoCentavos: 6900,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Porção de batata frita',
    descricao: 'Batata frita crocante (400 g), com ketchup e maionese.',
    nomes: { es: 'Porción de papas fritas', en: 'French fries' },
    precoCentavos: 3200,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Água mineral ou refrigerante',
    descricao: 'Água mineral 500 ml (com ou sem gás) ou refrigerante em lata. Diga qual na observação.',
    nomes: { es: 'Agua mineral o refresco', en: 'Mineral water or soda' },
    precoCentavos: 1000,
    maxQuantidade: 12,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Cerveja long neck',
    descricao: 'Cerveja long neck 355 ml, gelada. Venda para maiores de 18 anos.',
    nomes: { es: 'Cerveza (botella)', en: 'Beer (bottle)' },
    precoCentavos: 1600,
    maxQuantidade: 12,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Vinho tinto chileno (garrafa)',
    descricao: 'Garrafa de 750 ml de Cabernet Sauvignon chileno, com taças. Venda para maiores de 18 anos.',
    nomes: { es: 'Vino tinto chileno (botella)', en: 'Chilean red wine (bottle)' },
    precoCentavos: 16000,
    maxQuantidade: 3,
  },
  {
    setor: 'alimentos_bebidas',
    tipo: 'compra',
    categoria: 'Room service',
    nome: 'Café da manhã no quarto',
    descricao:
      'O café incluído na diária, servido no quarto: pães, frios, frutas, iogurte, café e suco. Taxa de serviço por pessoa. Diga o horário (6h30 às 10h30) na observação.',
    nomes: { es: 'Desayuno en la habitación', en: 'Breakfast in the room' },
    descricoes: {
      es: 'El desayuno incluido, servido en la habitación. Tarifa de servicio por persona. Indique la hora (6:30 a 10:30) en la observación.',
      en: 'The included breakfast, served in your room. Service fee per person. Tell us the time (6:30 to 10:30 am) in the note.',
    },
    precoCentavos: 4500,
    maxQuantidade: 6,
  },

  // ---------- Amenidades (governança, cortesia) ----------
  {
    setor: 'governanca',
    tipo: 'compra',
    categoria: 'Amenidades',
    nome: 'Kit de higiene extra',
    descricao: 'Sabonete, xampu, condicionador, escova e pasta de dente. Cortesia.',
    nomes: { es: 'Kit de higiene adicional', en: 'Extra toiletries kit' },
    precoCentavos: null,
    maxQuantidade: 4,
  },
  {
    setor: 'governanca',
    tipo: 'compra',
    categoria: 'Amenidades',
    nome: 'Travesseiro extra',
    descricao: 'Travesseiro adicional, firme ou macio (diga na observação). Cortesia.',
    nomes: { es: 'Almohada adicional', en: 'Extra pillow' },
    precoCentavos: null,
    maxQuantidade: 4,
  },
  {
    setor: 'governanca',
    tipo: 'compra',
    categoria: 'Amenidades',
    nome: 'Ferro e tábua de passar',
    descricao: 'Emprestados durante a estadia. Cortesia.',
    nomes: { es: 'Plancha y tabla de planchar', en: 'Iron and ironing board' },
    precoCentavos: null,
    maxQuantidade: 1,
  },
  {
    setor: 'governanca',
    tipo: 'compra',
    categoria: 'Amenidades',
    nome: 'Berço',
    descricao: 'Berço montado no quarto, com roupa de cama. Cortesia, sujeito à disponibilidade.',
    nomes: { es: 'Cuna', en: 'Baby crib' },
    precoCentavos: null,
    maxQuantidade: 2,
  },

  // ---------- Hospedagem (recepção) ----------
  {
    setor: 'recepcao',
    tipo: 'compra',
    categoria: 'Hospedagem',
    nome: 'Late checkout até 14h',
    descricao: 'Fique no quarto até as 14h no dia da saída (o check-out normal é ao meio-dia). Sujeito à disponibilidade; a recepção confirma.',
    nomes: { es: 'Late checkout hasta las 14:00', en: 'Late checkout until 2 pm' },
    precoCentavos: 12000,
    maxQuantidade: 1,
  },
  {
    setor: 'recepcao',
    tipo: 'compra',
    categoria: 'Hospedagem',
    nome: 'Late checkout até 18h',
    descricao: 'Fique no quarto até as 18h no dia da saída. Sujeito à disponibilidade; a recepção confirma.',
    nomes: { es: 'Late checkout hasta las 18:00', en: 'Late checkout until 6 pm' },
    precoCentavos: 25000,
    maxQuantidade: 1,
  },

  // ---------- Spa (concierge agenda; uma sala por horário) ----------
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Spa',
    nome: 'Massagem relaxante (60 min)',
    descricao: 'Massagem corporal com óleos aromáticos, para uma pessoa.',
    nomes: { es: 'Masaje relajante (60 min)', en: 'Relaxing massage (60 min)' },
    precoCentavos: 28000,
    porPessoa: false,
    maxQuantidade: 1,
    duracaoMin: 60,
    capacidade: 2,
    vagasPor: 'pedido',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '10:00', fim: '20:00', intervaloMin: 60 }],
    antecedenciaMin: 120,
    diasAFrente: 14,
  },
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Spa',
    nome: 'Massagem a dois (60 min)',
    descricao: 'Massagem relaxante para duas pessoas, lado a lado, na sala de casal. Preço pelo casal.',
    nomes: { es: 'Masaje en pareja (60 min)', en: 'Couples massage (60 min)' },
    precoCentavos: 52000,
    porPessoa: false,
    maxQuantidade: 2,
    duracaoMin: 60,
    capacidade: 1,
    vagasPor: 'pedido',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '10:00', fim: '20:00', intervaloMin: 60 }],
    antecedenciaMin: 120,
    diasAFrente: 14,
  },

  // ---------- Passeios (concierge; preço por pessoa, van de 12 lugares) ----------
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Passeios',
    nome: 'Cristo Redentor e Pão de Açúcar (meio dia)',
    descricao: 'Van com guia bilíngue, saída e volta no hotel. Ingressos do trem do Corcovado e do bondinho incluídos.',
    nomes: { es: 'Cristo Redentor y Pan de Azúcar (medio día)', en: 'Christ the Redeemer and Sugarloaf (half day)' },
    descricoes: {
      es: 'Van con guía bilingüe, salida y regreso en el hotel. Entradas del tren del Corcovado y del teleférico incluidas.',
      en: 'Van with a bilingual guide, pickup and drop-off at the hotel. Corcovado train and cable car tickets included.',
    },
    precoCentavos: 39000,
    porPessoa: true,
    maxQuantidade: 8,
    duracaoMin: 300,
    capacidade: 12,
    vagasPor: 'pessoa',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '08:00', fim: '13:00', intervaloMin: 300 }],
    antecedenciaMin: 720,
    diasAFrente: 30,
  },
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Passeios',
    nome: 'Trilha da Pedra Bonita',
    descricao: 'Trilha leve de cerca de 1 h até a rampa de voo livre, com vista para a Barra e São Conrado. Guia e transporte incluídos.',
    nomes: { es: 'Sendero de la Pedra Bonita', en: 'Pedra Bonita hike' },
    precoCentavos: 22000,
    porPessoa: true,
    maxQuantidade: 8,
    duracaoMin: 240,
    capacidade: 12,
    vagasPor: 'pessoa',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '07:00', fim: '11:00', intervaloMin: 240 }],
    antecedenciaMin: 720,
    diasAFrente: 30,
  },
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Passeios',
    nome: 'Angra dos Reis e Ilha Grande de escuna (dia inteiro)',
    descricao: 'Transporte até Angra e passeio de escuna com paradas para mergulho. Almoço não incluído.',
    nomes: { es: 'Angra dos Reis e Ilha Grande en goleta (día completo)', en: 'Angra dos Reis and Ilha Grande schooner trip (full day)' },
    precoCentavos: 42000,
    porPessoa: true,
    maxQuantidade: 8,
    duracaoMin: 720,
    capacidade: 12,
    vagasPor: 'pessoa',
    horarios: [{ dias: [0, 2, 4, 6], inicio: '07:00', fim: '19:00', intervaloMin: 720 }],
    antecedenciaMin: 1440,
    diasAFrente: 30,
  },
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Passeios',
    nome: 'City tour pelo Centro Histórico',
    descricao: 'Escadaria Selarón, Arcos da Lapa, Theatro Municipal, Confeitaria Colombo e Boulevard Olímpico, com guia.',
    nomes: { es: 'City tour por el Centro Histórico', en: 'Historic downtown city tour' },
    precoCentavos: 26000,
    porPessoa: true,
    maxQuantidade: 8,
    duracaoMin: 300,
    capacidade: 12,
    vagasPor: 'pessoa',
    horarios: [{ dias: [1, 2, 3, 4, 5, 6], inicio: '09:00', fim: '14:00', intervaloMin: 300 }],
    antecedenciaMin: 720,
    diasAFrente: 30,
  },

  // ---------- Transfer (concierge; preço por carro, até 4 pessoas) ----------
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Transfer',
    nome: 'Transfer para o Aeroporto do Galeão',
    descricao: 'Carro executivo do hotel ao Galeão (GIG), até 4 pessoas com bagagem. Preço por carro.',
    nomes: { es: 'Traslado al Aeropuerto de Galeão', en: 'Transfer to Galeão Airport' },
    precoCentavos: 25000,
    porPessoa: false,
    maxQuantidade: 4,
    duracaoMin: 90,
    capacidade: 2,
    vagasPor: 'pedido',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '05:00', fim: '23:30', intervaloMin: 30 }],
    antecedenciaMin: 240,
    diasAFrente: 30,
  },
  {
    setor: 'concierge',
    tipo: 'agendamento',
    categoria: 'Transfer',
    nome: 'Transfer para o Aeroporto Santos Dumont',
    descricao: 'Carro executivo do hotel ao Santos Dumont (SDU), até 4 pessoas com bagagem. Preço por carro.',
    nomes: { es: 'Traslado al Aeropuerto Santos Dumont', en: 'Transfer to Santos Dumont Airport' },
    precoCentavos: 21000,
    porPessoa: false,
    maxQuantidade: 4,
    duracaoMin: 75,
    capacidade: 2,
    vagasPor: 'pedido',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '05:00', fim: '23:30', intervaloMin: 30 }],
    antecedenciaMin: 240,
    diasAFrente: 30,
  },

  // ---------- Restaurante ----------
  {
    setor: 'alimentos_bebidas',
    tipo: 'agendamento',
    categoria: 'Restaurante',
    nome: 'Mesa para o jantar',
    descricao: 'Reserva de mesa no restaurante do hotel. O consumo é cobrado à parte, na conta do quarto.',
    nomes: { es: 'Mesa para la cena', en: 'Dinner table reservation' },
    precoCentavos: null,
    maxQuantidade: 10,
    // Chegadas das 19h às 22h30, a cada 30 min; cada mesa conta 60 min na lotação de 40 lugares.
    duracaoMin: 60,
    capacidade: 40,
    vagasPor: 'pessoa',
    horarios: [{ dias: TODOS_OS_DIAS, inicio: '19:00', fim: '23:30', intervaloMin: 30 }],
    antecedenciaMin: 60,
    diasAFrente: 14,
  },
];
