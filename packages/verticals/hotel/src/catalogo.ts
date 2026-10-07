import type { SetorCatalogo } from '@ramais/contracts';

/**
 * Catálogo-modelo de hotel. As descrições estão em inglês porque o roteador lê a
 * mensagem pivotada para inglês; elas descrevem o pedido na linguagem de quem pede,
 * não o organograma. A unidade copia e ajusta no onboarding.
 */
export const setoresHotel: SetorCatalogo[] = [
  {
    chave: 'recepcao',
    nome: 'Recepção',
    nomes: { es: 'Recepción', en: 'Front desk' },
    descricao:
      'Front desk. Check-in and check-out, reservation changes, bills and charges, invoices, keys and key cards that stopped working, luggage storage, taxis and transfers, wake-up calls, lost and found, complaints about the stay in general, and anything that does not clearly belong elsewhere.',
    exemplos: [
      'Can I check out later tomorrow?',
      'My key card is not opening the door',
      'There is a charge on my bill I do not recognize',
      'Can you call me a taxi to the airport at 6am?',
    ],
    palavrasChave: [
      'checkout', 'check out', 'check-out', 'checkin', 'check in', 'conta', 'fatura', 'nota fiscal', 'cobranca',
      'cartao do quarto', 'chave', 'key', 'taxi', 'uber', 'transfer', 'aeroporto', 'reserva', 'bill', 'invoice',
      'llave', 'factura', 'despertar', 'wake up', 'bagagem', 'mala', 'luggage', 'equipaje', 'vizinho', 'vizinhos', 'vecinos', 'neighbors', 'neighbours', 'barulho no corredor',
    ],
    casosDeBorda: [
      'Noise from neighbors is a front desk matter, not maintenance.',
      'A key card that does not work is front desk; a broken door lock is maintenance.',
    ],
    exigeIdentificacao: true,
  },
  {
    chave: 'governanca',
    nome: 'Governança',
    nomes: { es: 'Ama de llaves', en: 'Housekeeping' },
    descricao:
      'Housekeeping. Room cleaning, making the bed, fresh towels, sheets, pillows and blankets, toiletries (soap, shampoo, toilet paper), extra hangers, crib or extra bed set-up, trash removal, laundry pickup, do-not-disturb and cleaning schedule.',
    exemplos: [
      'Could you send two more towels?',
      'We need an extra pillow and a blanket',
      'Nobody cleaned our room today',
      'Can someone pick up laundry?',
      'Can I get more toilet paper?',
    ],
    palavrasChave: [
      'toalha', 'toalhas', 'towel', 'towels', 'toalla', 'travesseiro', 'pillow', 'almohada', 'cobertor', 'manta',
      'blanket', 'lencol', 'sheets', 'sabonete', 'shampoo', 'papel higienico', 'toilet paper', 'limpeza',
      'arrumar', 'limpar', 'cleaning', 'clean', 'limpieza', 'lavanderia', 'laundry', 'berco', 'crib', 'cabide', 'arrumou', 'arrumaram', 'limparam', 'limpiar', 'limpien', 'arreglar la habitacion', 'tidy',
    ],
    casosDeBorda: ['A dirty room is housekeeping; a bad smell from the drain is maintenance.'],
    exigeIdentificacao: false,
  },
  {
    chave: 'manutencao',
    nome: 'Manutenção',
    nomes: { es: 'Mantenimiento', en: 'Maintenance' },
    descricao:
      'Maintenance. Anything in the room that is broken, leaking, noisy or not working: air conditioning (too hot, too cold, noisy, dripping), shower and hot water, toilet and drains, sinks, lights and power outlets, TV and remote, safe, fridge, windows, curtains, door locks, furniture, bad smells from pipes.',
    exemplos: [
      'The air conditioning is dripping water',
      'There is no hot water in the shower',
      'The TV does not turn on',
      'The toilet is clogged',
      'My mother cannot sleep because the AC is too loud',
    ],
    palavrasChave: [
      'ar condicionado', 'ar-condicionado', 'ar', 'air conditioning', 'ac', 'aire acondicionado', 'aire',
      'chuveiro', 'shower', 'ducha', 'agua quente', 'hot water', 'agua caliente', 'vazando', 'vazamento',
      'pingando', 'leak', 'leaking', 'gotea', 'privada', 'vaso', 'toilet', 'entupido', 'clogged', 'tv',
      'televisao', 'controle', 'remote', 'cofre', 'safe', 'lampada', 'luz', 'light', 'tomada', 'outlet',
      'quebrado', 'quebrada', 'broken', 'roto', 'nao funciona', 'not working', 'no funciona', 'barulho do ar',
      'nao gela', 'geladeira', 'fridge', 'janela', 'window', 'cortina', 'fechadura',
    ],
    casosDeBorda: [
      'Noise from equipment in the room (AC, fridge, pipes) is maintenance; noise from people is front desk.',
    ],
    exigeIdentificacao: false,
  },
  {
    chave: 'alimentos_bebidas',
    nome: 'Alimentos e Bebidas',
    nomes: { es: 'Alimentos y bebidas', en: 'Food & beverage' },
    descricao:
      'Food and beverage. Room service orders, restaurant and bar reservations, breakfast questions that need a person, minibar refills, dietary restrictions and allergies for meals, special occasion cakes, wrong or late room service orders.',
    exemplos: [
      'I would like to order dinner to the room',
      'Can you refill the minibar?',
      'Is it possible to book a table for 4 at 8pm?',
      'My room service order is taking too long',
    ],
    palavrasChave: [
      'room service', 'servico de quarto', 'servicio a la habitacion', 'pedir comida', 'jantar', 'almoco',
      'dinner', 'lunch', 'cena', 'almuerzo', 'restaurante', 'restaurant', 'bar', 'frigobar reposicao',
      'minibar', 'mesa', 'table', 'bolo', 'cake', 'alergia', 'allergy', 'vegano', 'vegan', 'sem gluten',
      'gluten free', 'cardapio', 'menu', 'comida', 'food', 'bebida', 'drink', 'vinho', 'wine', 'frigobar', 'repor', 'reponer', 'refill', 'alergico', 'alergica', 'allergic', 'cozinha', 'cocina', 'kitchen',
    ],
    casosDeBorda: ['Breakfast opening hours are answered from the knowledge base; ordering or complaints go here.'],
    exigeIdentificacao: false,
  },
  {
    chave: 'concierge',
    nome: 'Concierge',
    nomes: { es: 'Conserjería', en: 'Concierge' },
    descricao:
      'Concierge. Tourism tips and local recommendations, tours, tickets for shows and attractions, restaurant suggestions outside the hotel, directions, renting cars or bikes, beach chairs and umbrellas, babysitting, flowers and special arrangements.',
    exemplos: [
      'What can we do in Rio on a rainy day?',
      'Can you book a tour to Christ the Redeemer?',
      'Where is a good place to eat seafood nearby?',
      'We need beach chairs and an umbrella',
    ],
    palavrasChave: [
      'passeio', 'tour', 'excursao', 'excursion', 'ingresso', 'ticket', 'entrada', 'show', 'cristo', 'pao de acucar',
      'praia', 'beach', 'playa', 'cadeira de praia', 'guarda sol', 'umbrella', 'sombrilla', 'dica', 'recomenda',
      'recommend', 'recomienda', 'aluguel', 'rent', 'alquiler', 'baba', 'babysitter', 'flores', 'flowers', 'chuva', 'lluvia', 'rain', 'o que fazer', 'que hacer', 'what to do', 'perto', 'cerca', 'nearby', 'mariscos', 'frutos do mar', 'seafood',
    ],
    casosDeBorda: ['Taxi or airport transfer is front desk; booking a tour with transport is concierge.'],
    exigeIdentificacao: false,
  },
];
