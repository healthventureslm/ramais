import type { CartaoMensagem, CartaoTarifa } from '@ramais/contracts';

/**
 * O cartão da reserva no WhatsApp, como no bot de reservas da VOA: os quartos num carrossel com
 * foto e botão, as tarifas e o resumo com botões (e a foto do quarto no alto), o pagamento com o
 * botão do link. Cada cartão devolve formatos em ordem de preferência: se a Meta recusar um (foto
 * fora do ar, recurso ainda não liberado no número), a saída tenta o próximo e, por fim, o texto.
 *
 * O corpo vem do texto da mensagem (já traduzido); aqui só os rótulos curtos. O id de cada botão
 * leva o número e o nome da opção ("quarto_2|Deluxe Casal"): a resposta entra na conversa como
 * "2. Deluxe Casal", que a reserva entende como se o hóspede tivesse digitado.
 */

const ROTULOS = {
  pt: {
    verQuartos: 'Ver quartos',
    verTarifas: 'Ver tarifas',
    escolher: 'Escolher',
    quartos: 'Quartos',
    tarifas: 'Tarifas',
    opcao: 'Opção',
    aPartirDe: 'A partir de',
    cafe: 'Café da manhã',
    semCafe: 'Sem café',
    cancelGratis: 'Cancelamento grátis',
    flexivel: 'Flexível',
    naoReembolsavel: 'Não reembolsável',
    tarifa: 'tarifa',
    tarifasN: 'tarifas',
    deslize: 'Deslize e toque no quarto que preferir.',
    trocarTarifa: 'Trocar tarifa',
    trocarQuarto: 'Trocar quarto',
    pagamento: 'Link de pagamento',
    pagar: 'Pagar agora',
  },
  en: {
    verQuartos: 'See rooms',
    verTarifas: 'See rates',
    escolher: 'Choose',
    quartos: 'Rooms',
    tarifas: 'Rates',
    opcao: 'Option',
    aPartirDe: 'From',
    cafe: 'Breakfast',
    semCafe: 'No breakfast',
    cancelGratis: 'Free cancellation',
    flexivel: 'Flexible',
    naoReembolsavel: 'Non-refundable',
    tarifa: 'rate',
    tarifasN: 'rates',
    deslize: 'Swipe and tap the room you prefer.',
    trocarTarifa: 'Change rate',
    trocarQuarto: 'Change room',
    pagamento: 'Payment link',
    pagar: 'Pay now',
  },
  es: {
    verQuartos: 'Ver habitaciones',
    verTarifas: 'Ver tarifas',
    escolher: 'Elegir',
    quartos: 'Habitaciones',
    tarifas: 'Tarifas',
    opcao: 'Opción',
    aPartirDe: 'Desde',
    cafe: 'Desayuno',
    semCafe: 'Sin desayuno',
    cancelGratis: 'Cancelación gratis',
    flexivel: 'Flexible',
    naoReembolsavel: 'No reembolsable',
    tarifa: 'tarifa',
    tarifasN: 'tarifas',
    deslize: 'Desliza y toca la habitación que prefieras.',
    trocarTarifa: 'Cambiar tarifa',
    trocarQuarto: 'Cambiar habitación',
    pagamento: 'Enlace de pago',
    pagar: 'Pagar ahora',
  },
};
type Rotulos = (typeof ROTULOS)['pt'];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const corta = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);
/** Id do botão: tipo, número e nome (o nome volta na resposta). */
const idOpcao = (tipo: 'quarto' | 'tarifa', n: number, nome: string) => `${tipo}_${n}|${nome.slice(0, 200)}`;

function tarifaLinha(t: CartaoTarifa, r: Rotulos): string {
  return [brl(t.total), t.cafe ? r.cafe : r.semCafe, t.cancelavel ? r.cancelGratis : r.naoReembolsavel].join(' · ');
}

/** Rótulo curto de cada tarifa nos botões (20 caracteres): "1. Não reembolsável", "2. Flexível". */
function rotulosTarifas(tarifas: CartaoTarifa[], r: Rotulos): string[] {
  const curtos = tarifas.map((t) => `${t.n}. ${t.cancelavel ? r.flexivel : r.naoReembolsavel}`);
  const tipos = tarifas.map((t) => `${t.cancelavel}`);
  return new Set(tipos).size === tipos.length ? curtos : tarifas.map((t) => `${r.opcao} ${t.n}`);
}

/** Com foto, ela vai no alto (botões e link aceitam cabeçalho de imagem). */
const cabecalho = (foto: string | null | undefined) => (foto ? { header: { type: 'image', image: { link: foto } } } : {});

/** Os formatos do cartão para a Cloud API (`interactive`), do mais rico ao mais simples. */
export function interativosDoCartao(cartao: CartaoMensagem, texto: string, idioma: string | null): Record<string, unknown>[] {
  const r = ROTULOS[(idioma ?? 'pt').slice(0, 2) as keyof typeof ROTULOS] ?? ROTULOS.en;
  const corpo = (t: string, max = 1024) => ({ text: corta(t.trim(), max) });

  if (cartao.tipo === 'quartos') {
    const formatos: Record<string, unknown>[] = [];
    // Carrossel: de 2 a 10 cartões, todos com foto e o mesmo tipo e número de botões.
    if (cartao.opcoes.length >= 2 && cartao.opcoes.every((o) => o.foto)) {
      const intro = texto.split('\n')[0]!.replace(/:\s*$/, '.');
      formatos.push({
        type: 'carousel',
        body: corpo(`${intro}\n${r.deslize}`),
        action: {
          cards: cartao.opcoes.slice(0, 10).map((o, i) => ({
            card_index: i,
            type: 'cta_url',
            header: { type: 'image', image: { link: o.foto } },
            body: {
              text: corta(
                [
                  o.nome,
                  `${r.aPartirDe} ${brl(o.aPartirDe)}`,
                  [...(o.cafe ? [r.cafe] : []), ...(o.cancelamentoGratis ? [r.cancelGratis] : []), `${o.tarifas} ${o.tarifas === 1 ? r.tarifa : r.tarifasN}`].join(' · '),
                ].join('\n'),
                160,
              ),
            },
            action: {
              buttons: [{ type: 'quick_reply', quick_reply: { id: idOpcao('quarto', o.n, o.nome), title: corta(o.tarifas > 1 ? r.verTarifas : r.escolher, 20) } }],
            },
          })),
        },
      });
    }
    formatos.push({
      type: 'list',
      body: corpo(texto, 4096),
      action: {
        button: corta(r.verQuartos, 20),
        sections: [
          {
            title: corta(r.quartos, 24),
            rows: cartao.opcoes.slice(0, 10).map((o) => ({
              id: idOpcao('quarto', o.n, o.nome),
              title: corta(`${o.n}. ${o.nome}`, 24),
              description: corta([`${r.aPartirDe} ${brl(o.aPartirDe)}`, ...(o.cafe ? [r.cafe] : []), ...(o.cancelamentoGratis ? [r.cancelGratis] : [])].join(' · '), 72),
            })),
          },
        ],
      },
    });
    return formatos;
  }

  if (cartao.tipo === 'tarifas') {
    const lista = {
      type: 'list',
      body: corpo(texto, 4096),
      action: {
        button: corta(r.verTarifas, 20),
        sections: [
          {
            title: corta(cartao.quarto || r.tarifas, 24),
            rows: cartao.tarifas.slice(0, 10).map((t) => ({ id: idOpcao('tarifa', t.n, t.nome), title: corta(`${t.n}. ${t.nome}`, 24), description: corta(tarifaLinha(t, r), 72) })),
          },
        ],
      },
    };
    if (cartao.tarifas.length > 3) return [lista];
    const rotulos = rotulosTarifas(cartao.tarifas, r);
    const botoes = (comFoto: boolean) => ({
      type: 'button',
      ...(comFoto ? cabecalho(cartao.foto) : {}),
      body: corpo(texto),
      action: { buttons: cartao.tarifas.map((t, i) => ({ type: 'reply', reply: { id: idOpcao('tarifa', t.n, t.nome), title: corta(rotulos[i]!, 20) } })) },
    });
    return [...(cartao.foto ? [botoes(true)] : []), botoes(false), lista];
  }

  if (cartao.tipo === 'resumo') {
    const botoes = [
      ...(cartao.trocarTarifa ? [{ type: 'reply', reply: { id: 'trocar_tarifa', title: corta(r.trocarTarifa, 20) } }] : []),
      ...(cartao.trocarQuarto ? [{ type: 'reply', reply: { id: 'trocar_quarto', title: corta(r.trocarQuarto, 20) } }] : []),
    ];
    if (!botoes.length) return [];
    const msg = (comFoto: boolean) => ({ type: 'button', ...(comFoto ? cabecalho(cartao.foto) : {}), body: corpo(texto), action: { buttons: botoes } });
    return [...(cartao.foto ? [msg(true)] : []), msg(false)];
  }

  // Pagamento: o link vai no botão, não no meio do texto.
  const semLink = texto.split(cartao.link).join('').replace(/\n{3,}/g, '\n\n');
  return [
    {
      type: 'cta_url',
      header: { type: 'text', text: corta(r.pagamento, 60) },
      body: corpo(semLink),
      action: { name: 'cta_url', parameters: { display_text: corta(r.pagar, 20), url: cartao.link } },
    },
  ];
}

/**
 * Toque num botão ou numa linha (lista, botões, carrossel): o que entra na conversa. O formato do
 * toque no carrossel não está documentado pela Meta; procura qualquer `{ id, title }` na resposta.
 */
export function textoDoToque(interativo: unknown): string | null {
  const opcao = opcaoNaMensagem(interativo);
  if (opcao) return opcao;
  const resposta = acharResposta(interativo);
  return resposta ? resposta.title || resposta.id : null;
}

const ID_OPCAO = /^(quarto|tarifa)_(\d{1,2})\|(.+)$/s;

/**
 * O id de um botão nosso ("quarto_2|Deluxe Casal") em qualquer campo da mensagem. O toque no
 * carrossel chega como `type: "button"` com o id em `button.payload` e o rótulo ("Escolher") em
 * `button.text`; sem o id, o hóspede escolhia "Escolher" e a reserva não sabia qual quarto.
 */
export function opcaoNaMensagem(v: unknown, fundo = 0): string | null {
  if (typeof v === 'string') {
    const m = ID_OPCAO.exec(v);
    return m ? `${m[2]}. ${m[3]}` : null;
  }
  if (!v || typeof v !== 'object' || fundo > 4) return null;
  for (const x of Object.values(v as Record<string, unknown>)) {
    const achou = opcaoNaMensagem(x, fundo + 1);
    if (achou) return achou;
  }
  return null;
}

function acharResposta(v: unknown, fundo = 0): { id: string; title: string } | null {
  if (!v || typeof v !== 'object' || fundo > 3) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id === 'string' && (typeof o.title === 'string' || typeof o.text === 'string')) {
    return { id: o.id, title: String(o.title ?? o.text) };
  }
  for (const x of Object.values(o)) {
    const achou = acharResposta(x, fundo + 1);
    if (achou) return achou;
  }
  return null;
}
