import type { CartaoMensagem, CartaoTarifa } from '@ramais/contracts';

/**
 * O cartão da reserva no WhatsApp: quartos e tarifas viram lista, o resumo vira botões e o
 * pagamento vira botão de link. O corpo é o texto da mensagem (já traduzido); aqui só os rótulos.
 * A resposta da lista chega como o título da linha ("2. Standard Casal") e a do botão como o
 * rótulo ("Trocar tarifa"): a reserva entende os dois como se fossem digitados.
 */

const ROTULOS = {
  pt: {
    verQuartos: 'Ver quartos',
    verTarifas: 'Ver tarifas',
    quartos: 'Quartos',
    tarifas: 'Tarifas',
    aPartirDe: 'a partir de',
    cafe: 'café da manhã',
    semCafe: 'sem café',
    cancelGratis: 'cancelamento grátis',
    naoReembolsavel: 'não reembolsável',
    trocarTarifa: 'Trocar tarifa',
    trocarQuarto: 'Trocar quarto',
    pagar: 'Pagar agora',
  },
  en: {
    verQuartos: 'See rooms',
    verTarifas: 'See rates',
    quartos: 'Rooms',
    tarifas: 'Rates',
    aPartirDe: 'from',
    cafe: 'breakfast',
    semCafe: 'no breakfast',
    cancelGratis: 'free cancellation',
    naoReembolsavel: 'non-refundable',
    trocarTarifa: 'Change rate',
    trocarQuarto: 'Change room',
    pagar: 'Pay now',
  },
  es: {
    verQuartos: 'Ver habitaciones',
    verTarifas: 'Ver tarifas',
    quartos: 'Habitaciones',
    tarifas: 'Tarifas',
    aPartirDe: 'desde',
    cafe: 'desayuno',
    semCafe: 'sin desayuno',
    cancelGratis: 'cancelación gratis',
    naoReembolsavel: 'no reembolsable',
    trocarTarifa: 'Cambiar tarifa',
    trocarQuarto: 'Cambiar habitación',
    pagar: 'Pagar ahora',
  },
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const corta = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

function tarifaLinha(t: CartaoTarifa, r: (typeof ROTULOS)['pt']): string {
  return [brl(t.total), t.cafe ? r.cafe : r.semCafe, t.cancelavel ? r.cancelGratis : r.naoReembolsavel].join(' · ');
}

/** O `interactive` da Cloud API, ou null quando o cartão não tem o que virar botão. */
export function interativoDoCartao(cartao: CartaoMensagem, texto: string, idioma: string | null): Record<string, unknown> | null {
  const r = ROTULOS[(idioma ?? 'pt').slice(0, 2) as keyof typeof ROTULOS] ?? ROTULOS.en;
  const corpo = (t: string) => ({ text: corta(t.trim(), 1024) });
  if (cartao.tipo === 'quartos') {
    return {
      type: 'list',
      body: corpo(texto),
      action: {
        button: r.verQuartos,
        sections: [
          {
            title: corta(r.quartos, 24),
            rows: cartao.opcoes.slice(0, 10).map((o) => ({
              id: `quarto_${o.n}`,
              title: corta(`${o.n}. ${o.nome}`, 24),
              description: corta([`${r.aPartirDe} ${brl(o.aPartirDe)}`, ...(o.cafe ? [r.cafe] : []), ...(o.cancelamentoGratis ? [r.cancelGratis] : [])].join(' · '), 72),
            })),
          },
        ],
      },
    };
  }
  if (cartao.tipo === 'tarifas') {
    return {
      type: 'list',
      body: corpo(texto),
      action: {
        button: r.verTarifas,
        sections: [
          {
            title: corta(cartao.quarto || r.tarifas, 24),
            rows: cartao.tarifas.slice(0, 10).map((t) => ({ id: `tarifa_${t.n}`, title: corta(`${t.n}. ${t.nome}`, 24), description: corta(tarifaLinha(t, r), 72) })),
          },
        ],
      },
    };
  }
  if (cartao.tipo === 'resumo') {
    const botoes = [
      ...(cartao.trocarTarifa ? [{ type: 'reply', reply: { id: 'trocar_tarifa', title: corta(r.trocarTarifa, 20) } }] : []),
      ...(cartao.trocarQuarto ? [{ type: 'reply', reply: { id: 'trocar_quarto', title: corta(r.trocarQuarto, 20) } }] : []),
    ];
    return botoes.length ? { type: 'button', body: corpo(texto), action: { buttons: botoes } } : null;
  }
  // Pagamento: o link vai no botão, não no meio do texto.
  const semLink = texto.split(cartao.link).join('').replace(/\n{3,}/g, '\n\n');
  return { type: 'cta_url', body: corpo(semLink), action: { name: 'cta_url', parameters: { display_text: corta(r.pagar, 20), url: cartao.link } } };
}
