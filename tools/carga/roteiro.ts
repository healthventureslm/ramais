/**
 * Roteiro do teste de carga: o que os hóspedes pedem (com o setor certo, para medir o acerto
 * do roteamento), em vários idiomas, e o que a equipe responde (sempre em português).
 */

export type Idioma = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'zh' | 'ar' | 'ru';
export type Destino = 'recepcao' | 'governanca' | 'manutencao' | 'alimentos_bebidas' | 'concierge' | 'base' | 'emergencia';

/** Peso de cada idioma entre os hóspedes (soma 100). */
export const IDIOMAS: [Idioma, number][] = [
  ['pt', 46],
  ['en', 18],
  ['es', 12],
  ['fr', 5],
  ['de', 5],
  ['it', 4],
  ['ja', 3],
  ['zh', 3],
  ['ar', 2],
  ['ru', 2],
];

/** Peso de cada destino entre os pedidos (soma 100). */
export const DESTINOS: [Destino, number][] = [
  ['manutencao', 24],
  ['governanca', 22],
  ['recepcao', 16],
  ['alimentos_bebidas', 14],
  ['concierge', 10],
  ['base', 13],
  ['emergencia', 1],
];

export const PEDIDOS: Record<Destino, Partial<Record<Idioma, string[]>>> = {
  manutencao: {
    pt: [
      'O ar-condicionado está pingando água no chão',
      'Não tem água quente no chuveiro',
      'A TV não liga, já troquei a pilha do controle',
      'O vaso sanitário entupiu',
      'A lâmpada do banheiro queimou',
      'O ar está fazendo um barulho muito alto, não consigo dormir',
      'A fechadura da porta da varanda está quebrada',
      'A tomada perto da cama não funciona',
      'O cofre não abre, acho que a bateria acabou',
      'Tem um cheiro ruim saindo do ralo do banheiro',
    ],
    en: [
      'The air conditioning is dripping water',
      'There is no hot water in the shower',
      'The TV does not turn on',
      'The toilet is clogged',
      'The AC is way too loud, we cannot sleep',
      'The safe will not open',
      'The bathroom light is not working',
    ],
    es: ['El aire acondicionado gotea', 'No hay agua caliente en la ducha', 'La televisión no enciende', 'El inodoro está tapado', 'La caja fuerte no abre'],
    fr: ["La climatisation fuit, il y a de l'eau par terre", "Il n'y a pas d'eau chaude dans la douche"],
    de: ['Die Klimaanlage tropft', 'Es gibt kein warmes Wasser in der Dusche', 'Der Fernseher geht nicht an'],
    it: ["L'aria condizionata perde acqua", "Non c'è acqua calda nella doccia"],
    ja: ['エアコンから水が漏れています', 'シャワーのお湯が出ません'],
    zh: ['空调在漏水', '淋浴没有热水'],
    ar: ['المكيف يسرّب الماء', 'لا يوجد ماء ساخن في الدش'],
    ru: ['Кондиционер протекает', 'В душе нет горячей воды'],
  },
  governanca: {
    pt: [
      'Pode mandar mais duas toalhas, por favor?',
      'Precisamos de um travesseiro e um cobertor extra',
      'Ninguém limpou nosso quarto hoje',
      'Acabou o papel higiênico',
      'Pode passar para recolher roupa para lavar?',
      'Precisamos de um berço para o bebê',
      'Podem trocar os lençóis hoje?',
      'Faltou shampoo e sabonete no banheiro',
    ],
    en: ['Could you send two more towels?', 'We need an extra pillow and a blanket', 'Nobody cleaned our room today', 'Can I get more toilet paper?', 'Can someone pick up laundry?'],
    es: ['¿Pueden traer dos toallas más?', 'Necesitamos una almohada extra', 'No limpiaron la habitación hoy', 'Se acabó el papel higiénico'],
    fr: ['Pourriez-vous nous apporter deux serviettes de plus ?', "Notre chambre n'a pas été nettoyée aujourd'hui"],
    de: ['Könnten Sie bitte zwei zusätzliche Handtücher bringen?', 'Wir brauchen ein zusätzliches Kissen'],
    it: ['Potete portare altri due asciugamani?', 'La camera non è stata pulita oggi'],
    ja: ['タオルをあと2枚お願いします', '枕をもう一つください'],
    zh: ['请再送两条毛巾', '我们的房间今天没有打扫'],
    ar: ['هل يمكن إرسال منشفتين إضافيتين؟'],
    ru: ['Можно ещё два полотенца, пожалуйста?'],
  },
  recepcao: {
    pt: [
      'Posso fazer o check-out mais tarde amanhã?',
      'Meu cartão do quarto parou de funcionar',
      'Tem uma cobrança na conta que eu não reconheço',
      'Podem chamar um táxi para o aeroporto às 6h?',
      'Preciso da nota fiscal da estadia',
      'Os vizinhos estão fazendo muito barulho',
      'Posso deixar as malas depois do check-out?',
    ],
    en: ['Can I check out later tomorrow?', 'My key card is not opening the door', 'There is a charge on my bill I do not recognize', 'Can you call me a taxi to the airport at 6am?', 'Could I get a wake-up call at 7?'],
    es: ['¿Puedo hacer el check-out más tarde?', 'Mi llave no abre la puerta', 'Necesito la factura de la estadía'],
    fr: ['Puis-je faire le check-out plus tard demain ?', 'Ma carte de chambre ne fonctionne plus'],
    de: ['Kann ich morgen später auschecken?', 'Meine Schlüsselkarte funktioniert nicht'],
    it: ['Posso fare il check-out più tardi domani?'],
    ja: ['明日、チェックアウトを遅くできますか？', 'カードキーが使えません'],
    zh: ['明天可以晚点退房吗？'],
    ar: ['هل يمكنني تأخير موعد المغادرة غدًا؟'],
    ru: ['Можно выехать позже завтра?'],
  },
  alimentos_bebidas: {
    pt: [
      'Quero pedir o jantar no quarto',
      'Podem repor o frigobar?',
      'Dá para reservar uma mesa para 4 às 20h no restaurante?',
      'Meu pedido de serviço de quarto está demorando muito',
      'Sou alérgico a amendoim, o restaurante tem opções?',
      'Queria encomendar um bolo de aniversário para amanhã',
    ],
    en: ['I would like to order dinner to the room', 'Can you refill the minibar?', 'Is it possible to book a table for 4 at 8pm?', 'My room service order is taking too long'],
    es: ['Quisiera pedir la cena a la habitación', '¿Pueden reponer el minibar?', '¿Se puede reservar una mesa para 4 a las 20h?'],
    fr: ['Je voudrais commander le dîner en chambre'],
    de: ['Ich möchte das Abendessen aufs Zimmer bestellen'],
    it: ['Vorrei ordinare la cena in camera'],
    ja: ['ルームサービスで夕食を注文したいです'],
    zh: ['我想在房间点晚餐'],
    ru: ['Хочу заказать ужин в номер'],
  },
  concierge: {
    pt: [
      'O que dá para fazer no Rio num dia de chuva?',
      'Vocês conseguem reservar um passeio para o Cristo Redentor?',
      'Onde tem um bom restaurante de frutos do mar aqui perto?',
      'Precisamos de cadeiras de praia e guarda-sol',
      'Queria comprar ingressos para o show de sábado',
    ],
    en: ['Can you book a tour to Christ the Redeemer?', 'Where is a good place to eat seafood nearby?', 'We need beach chairs and an umbrella', 'What can we do in Rio on a rainy day?'],
    es: ['¿Pueden reservar un tour al Cristo Redentor?', '¿Dónde hay un buen restaurante de mariscos cerca?', 'Necesitamos sillas de playa y sombrilla'],
    fr: ['Pouvez-vous réserver une visite du Christ Rédempteur ?'],
    de: ['Können Sie eine Tour zum Zuckerhut buchen?'],
    it: ['Potete prenotare un tour al Cristo Redentore?'],
    ja: ['コルコバードのツアーを予約できますか？'],
    zh: ['可以帮忙预订基督像的旅游吗？'],
  },
  base: {
    pt: ['Qual a senha do Wi-Fi?', 'Que horas é o café da manhã?', 'Qual o horário do check-out?', 'Até que horas funciona a piscina?', 'Tem academia no hotel?', 'Vocês têm estacionamento?'],
    en: ['What is the Wi-Fi password?', 'What time is breakfast?', 'What time is check-out?', 'Is there a gym?'],
    es: ['¿Cuál es la contraseña del Wi-Fi?', '¿A qué hora es el desayuno?', '¿Tienen estacionamiento?'],
    fr: ['Quel est le mot de passe du Wi-Fi ?'],
    de: ['Wie lautet das WLAN-Passwort?'],
    it: ['A che ora è la colazione?'],
    ja: ['Wi-Fiのパスワードは何ですか？'],
    zh: ['早餐几点？'],
    ar: ['ما هي كلمة مرور الواي فاي؟'],
    ru: ['Какой пароль от Wi-Fi?'],
  },
  emergencia: {
    pt: ['Socorro! Meu marido desmaiou no quarto', 'Emergência, tem fumaça saindo do corredor'],
    en: ['Help! There is smoke in the corridor, fire!'],
    es: ['¡Ayuda urgente! Mi hijo se lastimó'],
  },
};

/** Primeira mensagem vaga (o fluxo pede detalhes antes de encaminhar). */
export const VAGOS: Partial<Record<Idioma, string[]>> = {
  pt: ['Oi', 'Boa noite', 'Olá, preciso de ajuda'],
  en: ['Hi', 'Hello, I need some help'],
  es: ['Hola', 'Buenas noches'],
  fr: ['Bonjour'],
  de: ['Hallo'],
  it: ['Ciao'],
};

/** Depois que a equipe respondeu. */
export const OBRIGADO: Record<Idioma, string[]> = {
  pt: ['Obrigado!', 'Perfeito, muito obrigada', 'Valeu, resolvido'],
  en: ['Thank you!', 'Great, thanks a lot'],
  es: ['¡Gracias!', 'Perfecto, muchas gracias'],
  fr: ['Merci beaucoup !'],
  de: ['Vielen Dank!'],
  it: ['Grazie mille!'],
  ja: ['ありがとうございます！'],
  zh: ['谢谢！'],
  ar: ['شكرًا جزيلًا!'],
  ru: ['Большое спасибо!'],
};

/** O hóspede ainda espera (aparece quando a equipe demora). */
export const COBRANCA: Partial<Record<Idioma, string[]>> = {
  pt: ['Alguém vem mesmo? Ainda estou esperando', 'Oi? Ninguém respondeu ainda'],
  en: ['Is anyone coming? Still waiting'],
  es: ['¿Alguien viene? Sigo esperando'],
};

/** Respostas da equipe, por setor (sempre em português: o sistema traduz). */
export const RESPOSTAS: Record<Exclude<Destino, 'base' | 'emergencia'>, string[]> = {
  manutencao: [
    'Boa noite! O técnico já está subindo para verificar, chega em 10 minutos.',
    'Olá! Vou mandar alguém da manutenção agora mesmo.',
    'Entendido, o técnico está a caminho. Pode deixar a porta destrancada?',
  ],
  governanca: [
    'Claro! A camareira leva em até 15 minutos.',
    'Pode deixar, já estamos separando e levamos já já.',
    'Peço desculpas pela falha, a equipe de limpeza passa no quarto agora.',
  ],
  recepcao: [
    'Olá! Já ajustei aqui no sistema, está tudo certo.',
    'Claro, consigo sim. Pode passar na recepção quando quiser.',
    'Verifiquei aqui e já resolvemos, obrigado pelo aviso.',
  ],
  alimentos_bebidas: [
    'Perfeito! Seu pedido já foi para a cozinha, chega em 30 minutos.',
    'Reserva feita para hoje às 20h. Bom jantar!',
    'Vou repor o frigobar ainda nesta hora.',
  ],
  concierge: [
    'Com prazer! Mandei as opções de passeio por aqui, posso reservar o das 9h?',
    'Recomendo o restaurante Marítimo, a duas quadras. Quer que eu faça a reserva?',
    'Já separamos as cadeiras e o guarda-sol na portaria da praia.',
  ],
};

/** Falas gravadas (voz do Windows) para os áudios dos hóspedes e da equipe. */
export const AUDIOS_HOSPEDE: { idioma: 'pt' | 'en'; destino: Destino; texto: string }[] = [
  { idioma: 'pt', destino: 'manutencao', texto: 'Oi, o chuveiro do meu quarto está sem água quente, podem mandar alguém?' },
  { idioma: 'pt', destino: 'governanca', texto: 'Boa tarde, preciso de mais toalhas e papel higiênico, por favor.' },
  { idioma: 'pt', destino: 'alimentos_bebidas', texto: 'Queria pedir um jantar no quarto, um risoto e uma água sem gás.' },
  { idioma: 'pt', destino: 'recepcao', texto: 'Olá, meu cartão do quarto parou de funcionar, não consigo entrar.' },
  { idioma: 'pt', destino: 'concierge', texto: 'Vocês conseguem reservar um passeio para o Pão de Açúcar amanhã de manhã?' },
  { idioma: 'en', destino: 'manutencao', texto: 'Hi, the air conditioning in our room is leaking water on the floor.' },
  { idioma: 'en', destino: 'governanca', texto: 'Hello, could you send two extra pillows and a blanket to our room?' },
  { idioma: 'en', destino: 'alimentos_bebidas', texto: 'Hi, I would like to book a table for two at the restaurant tonight at eight.' },
];

export const AUDIOS_EQUIPE: string[] = [
  'Boa noite, já estou subindo com o que o senhor pediu.',
  'Olá, a equipe já está a caminho do seu quarto.',
  'Tudo certo, já resolvemos aqui. Qualquer coisa é só chamar.',
];

export const LEGENDAS_FOTO: Partial<Record<Idioma, string[]>> = {
  pt: ['Olha como está o vazamento', 'Esta mancha no teto apareceu hoje'],
  en: ['This is the leak I mentioned'],
  es: ['Así está la fuga'],
};
