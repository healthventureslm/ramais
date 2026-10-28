import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ContextoPedido, ExtracaoPedido, ServicosIA } from '@ramais/ai';
import type { CatalogoItemView } from '@ramais/contracts';
import { dataLocal, diaDaSemana, normalizar, totalDoPedido } from '@ramais/domain';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { IA } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { Cobrancas } from '../cobrancas/cobrancas.service.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';
import { Pedidos } from './pedidos.service.js';

/** Uma linha do pedido em montagem. Agendamento: quantidade = pessoas, mais dia e hora. */
interface Linha {
  itemId: string;
  quantidade: number | null;
  observacao: string | null;
  data: string | null;
  hora: string | null;
}

/** O pedido que o hóspede está montando, guardado na conversa (contexto da solicitação). */
interface Carrinho {
  linhas: Linha[];
  etapa: 'montando' | 'confirmando';
  pergunta: string | null;
}

const PERGUNTA_MAIS = 'Quer mais alguma coisa?';
const PERGUNTA_PAGAMENTO = 'Como prefere pagar?\n1. Na conta do quarto\n2. Agora, por Pix ou cartão (mando o link)';
/** Resposta curta à pergunta do pagamento, sem depender da IA ("2", "pix", "na conta"). */
function formaDireta(texto: string): 'quarto' | 'agora' | null {
  const t = texto.trim().toLowerCase();
  if (/^(1|um|op[cç][aã]o 1|(na )?conta( do quarto)?|quarto)[.!]?$/.test(t)) return 'quarto';
  if (/^(2|dois|op[cç][aã]o 2|pix|cart[aã]o|link|agora|pagar agora|card|now)[.!]?$/.test(t)) return 'agora';
  return null;
}
/** A descrição do item na lista: a primeira frase (o resto o hóspede vê se perguntar). */
const primeiraFrase = (t: string) => {
  const f = /^.{20,160}?[.!?](\s|$)/.exec(t.trim())?.[0]?.trim();
  return f ?? (t.length > 160 ? `${t.slice(0, 157).trim()}…` : t);
};
/** "cerveja", "cerveja e vinho", "cerveja, vinho e gelo". */
const juntar = (l: string[]) => (l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diaSemanaPt = (iso: string) => ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'][diaDaSemana(iso)]!;

/**
 * Palavras que, numa mensagem, sugerem pedido do catálogo (antes de gastar a IA). Sem `\b`: para
 * ele, "á" não é letra e "água" nunca casaria.
 */
const GENERICAS = /(?<!\p{L})(card[aá]pio|menu|comer|comida|fome|lanche|jantar|almo[cç]o|bebida|beber|[aá]gua|refri|cerveja|vinho|room service|pedir|pedido|passeio|tour|spa|massagem|transfer|aeroporto|traslado|mesa|frigobar|toalha extra|travesseiro|ber[cç]o|late check|food|eat|hungry|drink|order|tours?|massage|comida|cena|paseo|masaje|essen|trinken|ausflug)/iu;

/**
 * Atendente de pedidos pela conversa: responde o que há no catálogo, anota os itens, pergunta
 * dia, horário e pessoas no que é agendado, soma tudo e, confirmado, abre os pedidos nos setores.
 * A IA só diz a intenção e aponta os itens; o que se responde ao hóspede sai do catálogo.
 */
@Injectable()
export class ConversaPedidos {
  private readonly log = new Logger('pedidos-conversa');

  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
    private readonly pedidos: Pedidos,
    private readonly cobrancas: Cobrancas,
    @Inject(IA) private readonly ia: ServicosIA,
  ) {}

  /** Para a análise: catálogo ativo da unidade e o pedido em montagem nesta conversa. */
  async paraAnalise(c: Ctx, s: SolicitacaoRow): Promise<{ itens: CatalogoItemView[]; carrinho: Carrinho | null }> {
    if (!this.ia.pedido.disponivel) return { itens: [], carrinho: null };
    const itens = await this.pedidos.itens(c, s.unidade_id, true);
    return { itens, carrinho: (s.contexto as { carrinho?: Carrinho }).carrinho ?? null };
  }

  /** A mensagem tem cara de pedido do catálogo? Palavras gerais ou o nome de um item/categoria. */
  pareceCatalogo(textos: (string | null | undefined)[], itens: CatalogoItemView[]): boolean {
    const t = textos.filter(Boolean).join(' ');
    if (GENERICAS.test(t)) return true;
    const n = ` ${normalizar(t)} `;
    return itens.some((i) =>
      [i.categoria, i.nome, i.nomes.en, i.nomes.es]
        .filter(Boolean)
        .flatMap((x) => normalizar(x!).split(/\s+/))
        .some((p) => p.length >= 5 && n.includes(` ${p} `)),
    );
  }

  contexto(fuso: string, itens: CatalogoItemView[], carrinho: Carrinho | null): ContextoPedido {
    const hoje = dataLocal(new Date(), fuso);
    return {
      hoje,
      diaSemana: DIAS[diaDaSemana(hoje)]!,
      catalogo: itens.map(
        (i, n) =>
          `c${n + 1}: [${i.categoria}] ${i.nome}${i.nomes.en ? ` / ${i.nomes.en}` : ''}, ${this.preco(i, 'en')} (${i.tipo === 'compra' ? 'purchase' : `booking${i.duracaoMin ? `, ${i.duracaoMin} min` : ''}`}).${i.descricao ? ` ${i.descricao.slice(0, 140)}` : ''}`,
      ),
      carrinho: (carrinho?.linhas ?? []).map((l) => this.linhaTexto(l, itens.find((i) => i.id === l.itemId))),
      pergunta: carrinho?.pergunta ?? null,
    };
  }

  async extrair(texto: string, ctx: ContextoPedido): Promise<ExtracaoPedido | null> {
    try {
      return await this.ia.pedido.extrair(texto, ctx);
    } catch (e) {
      this.log.warn(`extração de pedido falhou: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Trata a mensagem no pedido pela conversa. true = cuidou (nada mais a fazer); false = não é
   * pedido do catálogo e segue o caminho normal.
   */
  async tratar(
    c: Ctx,
    s: SolicitacaoRow,
    ex: ExtracaoPedido | null,
    itens: CatalogoItemView[],
    kb: { responde: boolean; resposta: string | null; confianca: number } | null,
    limiteKb: number,
    texto = '',
  ): Promise<boolean> {
    if (!itens.length) return false;
    let carrinho = (s.contexto as { carrinho?: Carrinho }).carrinho ?? null;
    const porCodigo = (cod: string) => itens[Number(cod.slice(1)) - 1];
    // A forma de pagamento respondida ("2", "pix") vale mesmo sem a IA.
    const forma = carrinho?.etapa === 'confirmando' && carrinho.pergunta?.endsWith(PERGUNTA_PAGAMENTO) ? (ex?.pagamento ?? formaDireta(texto)) : null;
    if (carrinho && forma && !ex?.adicionar.length && !ex?.remover.length) return this.fechar(c, s, carrinho, itens, forma === 'agora');

    if (!carrinho) {
      // Começa só com pergunta ou pedido do catálogo, e com o quarto conhecido (vai para a conta dele).
      if (!ex?.sobreCatalogo || !['browse', 'add'].includes(ex.intencao) || !s.local_id) return false;
      carrinho = { linhas: [], etapa: 'montando', pergunta: null };
      await this.acoes.notaInterna(c, s.id, 'Pedido pela conversa: a IA está atendendo (catálogo, carrinho e confirmação).', { tipo: 'sistema' });
    } else if (!ex) {
      if (carrinho.pergunta) await this.falar(c, s, carrinho.pergunta);
      return true;
    } else if (ex.intencao === 'cancel') {
      await this.guardar(c, s, null);
      await this.falar(c, s, 'Tudo bem, cancelei o pedido. Se quiser algo depois, é só me chamar.');
      await this.concluir(c, s, 'Pedido pela conversa: o hóspede desistiu.');
      return true;
    } else if (!ex.sobreCatalogo && ex.intencao === 'other') {
      // Outro assunto no meio do pedido: a base responde e a pergunta volta; senão, a equipe assume.
      if (kb?.responde && kb.resposta && kb.confianca >= limiteKb) {
        await this.acoes.enviarAoSolicitante(c, s, { texto: kb.resposta, idioma: 'pt', autor: { tipo: 'ia' } });
        if (carrinho.pergunta) await this.falar(c, s, carrinho.pergunta);
        return true;
      }
      await this.guardar(c, s, null);
      await this.acoes.notaInterna(c, s.id, 'Pedido pela conversa interrompido: o hóspede mudou de assunto.', { tipo: 'sistema' });
      return false;
    }
    const e = ex!;

    // Pediu o que o hotel não tem: diz logo, sem trocar por outro item.
    const naoTem = e.naoTem?.length ? `Não temos ${juntar(e.naoTem)} no cardápio do hotel.\n\n` : '';

    // Mostrar o que há.
    if (e.intencao === 'browse' && !e.adicionar.length) {
      const lista = (e.mostrar.length ? e.mostrar.map(porCodigo).filter(Boolean) : itens) as CatalogoItemView[];
      const linhas = lista.slice(0, 12).map((i) => `• ${i.nome}: ${this.preco(i, 'pt')}${i.descricao ? `. ${primeiraFrase(i.descricao)}` : ''}`);
      await this.perguntar(
        c,
        s,
        carrinho,
        `${naoTem}${lista.length ? `Temos:\n${linhas.join('\n')}` : naoTem ? '' : 'Não temos isso no cardápio do hotel agora.'}${lista.length || !naoTem ? '\n\n' : ''}Quer pedir algum? É só me dizer o que e quanto.`,
      );
      return true;
    }

    // Adicionar e tirar itens.
    for (const a of e.adicionar) {
      const i = porCodigo(a.codigo);
      if (!i) continue;
      if (i.tipo === 'compra') {
        const ja = carrinho.linhas.find((l) => l.itemId === i.id && (l.observacao ?? '') === (a.observacao ?? ''));
        if (ja) ja.quantidade = Math.min(i.maxQuantidade, (ja.quantidade ?? 0) + (a.quantidade ?? 1));
        else carrinho.linhas.push({ itemId: i.id, quantidade: Math.min(i.maxQuantidade, a.quantidade ?? 1), observacao: a.observacao, data: null, hora: null });
      } else {
        carrinho.linhas.push({ itemId: i.id, quantidade: e.pessoas ?? a.quantidade, observacao: null, data: e.data, hora: e.hora });
      }
    }
    for (const cod of e.remover) {
      const i = porCodigo(cod);
      if (i) carrinho.linhas = carrinho.linhas.filter((l) => l.itemId !== i.id);
    }
    carrinho.etapa = e.adicionar.length || e.remover.length ? 'montando' : carrinho.etapa;

    // Agendamento incompleto: o que falta, na ordem pessoas → dia → horário.
    const pendente = carrinho.linhas.find((l) => {
      const i = itens.find((x) => x.id === l.itemId);
      return i?.tipo === 'agendamento' && (!l.quantidade || !l.data || !l.hora);
    });
    if (pendente) {
      const i = itens.find((x) => x.id === pendente.itemId)!;
      if (!e.adicionar.length) {
        if (e.pessoas) pendente.quantidade = e.pessoas;
        if (e.data) pendente.data = e.data;
        if (e.hora) pendente.hora = e.hora;
      }
      if (!pendente.quantidade) {
        await this.perguntar(c, s, carrinho, `${i.nome}: para quantas pessoas?`);
        return true;
      }
      if (pendente.quantidade > i.maxQuantidade) pendente.quantidade = i.maxQuantidade;
      if (!pendente.data) {
        await this.perguntar(c, s, carrinho, `${i.nome}: para qual dia? (dá para marcar até ${i.diasAFrente} dias à frente)`);
        return true;
      }
      const livres = (await this.pedidos.horarios(c, s.unidade_id, i.id, pendente.data, pendente.quantidade)).map((h) => h.hora);
      if (!livres.length) {
        pendente.data = null;
        pendente.hora = null;
        await this.perguntar(c, s, carrinho, `${i.nome}: não tenho horário livre nesse dia para ${pendente.quantidade} ${pendente.quantidade === 1 ? 'pessoa' : 'pessoas'}. Quer outro dia?`);
        return true;
      }
      if (!pendente.hora || !livres.includes(pendente.hora)) {
        const pedida = pendente.hora;
        pendente.hora = null;
        await this.perguntar(
          c,
          s,
          carrinho,
          `${pedida ? `Às ${pedida} não tenho vaga. ` : ''}${i.nome} em ${diaSemanaPt(pendente.data)} ${dm(pendente.data)}: tenho ${livres.slice(0, 12).join(', ')}. Qual horário prefere?`,
        );
        return true;
      }
    }

    // Confirmação do resumo: abre os pedidos.
    if (carrinho.etapa === 'confirmando' && (e.intencao === 'confirm' || (e.sim && !e.adicionar.length))) {
      // "Sim" à pergunta do pagamento, sem dizer como: pergunta de novo; à de confirmar, fecha.
      if (carrinho.pergunta?.endsWith(PERGUNTA_PAGAMENTO)) {
        await this.perguntar(c, s, carrinho, `Responda 1 para pôr na conta do quarto ou 2 para pagar agora.\n\n${PERGUNTA_PAGAMENTO}`);
        return true;
      }
      return this.fechar(c, s, carrinho, itens, false);
    }
    if (carrinho.etapa === 'confirmando' && e.nao && !e.adicionar.length && !e.remover.length) {
      carrinho.etapa = 'montando';
      await this.perguntar(c, s, carrinho, 'Tudo bem. O que você quer mudar?');
      return true;
    }

    // Fechar: resumo com o total e pede a confirmação.
    const quer = e.intencao === 'checkout' || (carrinho.etapa === 'montando' && e.nao && !e.adicionar.length && Boolean(carrinho.pergunta?.endsWith(PERGUNTA_MAIS)));
    if (quer || (e.intencao === 'confirm' && carrinho.linhas.length)) {
      if (!carrinho.linhas.length) {
        await this.perguntar(c, s, carrinho, 'Seu pedido ainda está vazio. O que você gostaria?');
        return true;
      }
      carrinho.etapa = 'confirmando';
      const { texto, total } = this.resumo(carrinho, itens);
      // Com pagamento online, o hóspede escolhe: conta do quarto ou link agora (Pix ou cartão).
      await this.perguntar(
        c,
        s,
        carrinho,
        this.cobrancas.disponivel && (total ?? 0) > 0
          ? `Seu pedido:\n${texto}\nTotal: ${brl(total!)}.\n\n${PERGUNTA_PAGAMENTO}`
          : `Seu pedido:\n${texto}${total !== null ? `\nTotal: ${brl(total)}, na conta do quarto.` : ''}\n\nConfirma?`,
      );
      return true;
    }

    // Itens anotados (ou nada mudou): mostra o que entrou e pergunta se quer mais.
    if (e.adicionar.length || e.remover.length || pendente) {
      const novos = e.adicionar.length
        ? carrinho.linhas.filter((l) => e.adicionar.some((a) => porCodigo(a.codigo)?.id === l.itemId))
        : pendente
          ? [pendente]
          : [];
      const anotado = novos.map((l) => this.linhaTexto(l, itens.find((i) => i.id === l.itemId), true)).join('\n');
      await this.perguntar(c, s, carrinho, `${naoTem}${anotado ? `Anotado:\n${anotado}\n\n` : e.remover.length ? 'Tirei do pedido.\n\n' : ''}${PERGUNTA_MAIS}`);
      return true;
    }
    if (naoTem) {
      await this.perguntar(c, s, carrinho, `${naoTem}${carrinho.linhas.length ? PERGUNTA_MAIS : 'Quer ver o que temos? É só perguntar.'}`);
      return true;
    }
    if (e.sim && carrinho.etapa === 'montando') {
      await this.perguntar(c, s, carrinho, 'Claro! O que mais você gostaria?');
      return true;
    }
    if (carrinho.pergunta) await this.falar(c, s, carrinho.pergunta);
    else await this.perguntar(c, s, carrinho, 'O que você gostaria de pedir?');
    return true;
  }

  private async fechar(c: Ctx, s: SolicitacaoRow, carrinho: Carrinho, itens: CatalogoItemView[], pagarAgora: boolean): Promise<boolean> {
    const { texto, total } = this.resumo(carrinho, itens);
    try {
      const r = await this.pedidos.criarDoCarrinho(
        c,
        s,
        carrinho.linhas.map((l) => ({ itemId: l.itemId, quantidade: l.quantidade ?? 1, data: l.data, hora: l.hora, observacao: l.observacao })),
      );
      await this.guardar(c, s, null);
      let pagamento = total !== null ? `\nTotal: ${brl(total)}, na conta do quarto.` : '';
      let link = false;
      if (pagarAgora && (total ?? 0) > 0) {
        try {
          const cob = await this.pedidos.cobrar(c, s, r.pedidos.map((p) => p.id), null);
          pagamento = `\nTotal: ${brl(cob.valor_centavos)}.\n\n${await this.cobrancas.textoDoLink(c, cob)}`;
          link = true;
        } catch (err) {
          this.log.warn(`link de pagamento falhou (${s.id}): ${(err as Error).message}`);
          pagamento = `\nTotal: ${brl(total!)}, na conta do quarto (não consegui gerar o link de pagamento agora).`;
        }
      }
      const aviso = link ? 'Avisamos aqui quando o pagamento cair e quando o pedido for confirmado.' : `Avisamos aqui assim que ${r.atendimentos > 1 ? 'cada setor confirmar' : 'for confirmado'}.`;
      await this.falar(c, s, `Pronto! Pedido enviado:\n${texto}${pagamento}\n\n${aviso}`);
      await this.concluir(
        c,
        s,
        `Pedido pela conversa: ${r.pedidos.length} ${r.pedidos.length === 1 ? 'item' : 'itens'}${total !== null ? ` · ${brl(total)}` : ''} (${link ? 'pagamento por link' : 'conta do quarto'})`,
      );
    } catch (err) {
      // Horário ocupado no meio do caminho, item desativado: explica e volta a montar.
      carrinho.etapa = 'montando';
      await this.perguntar(c, s, carrinho, `Não consegui fechar: ${(err as Error).message}. Quer ajustar o pedido?`);
    }
    return true;
  }

  // ---------- auxiliares ----------

  private preco(i: CatalogoItemView, idioma: 'pt' | 'en'): string {
    if (i.precoCentavos === null || i.precoCentavos === 0) return idioma === 'pt' ? 'sem custo' : 'no charge';
    const p = brl(i.precoCentavos);
    return i.tipo === 'agendamento' && i.porPessoa ? `${p} ${idioma === 'pt' ? 'por pessoa' : 'per person'}` : p;
  }

  private linhaTexto(l: Linha, i: CatalogoItemView | undefined, _comValor = false): string {
    if (!i) return '';
    const total = totalDoPedido({ tipo: i.tipo, precoCentavos: i.precoCentavos, porPessoa: i.porPessoa }, l.quantidade ?? 1);
    const valor = total ? `: ${brl(total)}` : i.precoCentavos === 0 || i.precoCentavos === null ? ' (sem custo)' : '';
    if (i.tipo === 'compra') return `• ${l.quantidade ?? 1}× ${i.nome}${l.observacao ? ` (${l.observacao})` : ''}${valor}`;
    const quando = l.data ? `, ${diaSemanaPt(l.data)} ${dm(l.data)}${l.hora ? ` às ${l.hora}` : ''}` : '';
    const pessoas = l.quantidade ? `, ${l.quantidade} ${l.quantidade === 1 ? 'pessoa' : 'pessoas'}` : '';
    return `• ${i.nome}${quando}${pessoas}${valor}`;
  }

  private resumo(carrinho: Carrinho, itens: CatalogoItemView[]): { texto: string; total: number | null } {
    let total: number | null = null;
    const linhas = carrinho.linhas.map((l) => {
      const i = itens.find((x) => x.id === l.itemId);
      if (!i) return '';
      const t = totalDoPedido({ tipo: i.tipo, precoCentavos: i.precoCentavos, porPessoa: i.porPessoa }, l.quantidade ?? 1);
      if (t !== null) total = (total ?? 0) + t;
      return this.linhaTexto(l, i, true);
    });
    return { texto: linhas.filter(Boolean).join('\n'), total };
  }

  private async guardar(c: Ctx, s: SolicitacaoRow, carrinho: Carrinho | null) {
    const atual = await this.acoes.carregar(c, s.id);
    await this.acoes.atualizar(c, atual, { contexto: { ...atual.contexto, carrinho } });
  }

  private async perguntar(c: Ctx, s: SolicitacaoRow, carrinho: Carrinho, texto: string) {
    carrinho.pergunta = texto;
    await this.guardar(c, s, carrinho);
    await this.falar(c, s, texto);
  }

  /** A IA fala em português; a saída traduz para o idioma do hóspede. */
  private falar(c: Ctx, s: SolicitacaoRow, texto: string) {
    return this.acoes.enviarAoSolicitante(c, s, { texto, idioma: 'pt', autor: { tipo: 'ia' } });
  }

  private async concluir(c: Ctx, s: SolicitacaoRow, resumo: string) {
    const atual = await this.acoes.carregar(c, s.id);
    const com = await this.acoes.atualizar(c, atual, { resumo });
    if (com.estado === 'automacao') await this.acoes.resolver(c, com, { tipo: 'ia' });
  }
}
