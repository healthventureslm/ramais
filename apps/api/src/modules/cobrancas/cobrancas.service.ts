import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Config } from '../../config.js';
import { Nucleo, type Ctx } from '../../infra/nucleo.js';
import { ClienteSalabim, type EstadoLink, type ItemLink } from '../../infra/salabim.js';
import { CONFIG } from '../../infra/tokens.js';
import { Unidades } from '../../infra/unidades.js';
import { Acoes } from '../solicitacoes/acoes.js';
import type { SolicitacaoRow } from '../solicitacoes/tipos.js';

export interface CobrancaRow {
  id: string;
  unidade_id: string;
  solicitacao_id: string;
  tipo: 'pedido' | 'extensao';
  descricao: string;
  valor_centavos: number;
  link_id: string | null;
  link: string | null;
  estado: EstadoLink;
  expira_em: Date | null;
  pago_em: Date | null;
  criado_por: string | null;
}

/**
 * Quem pediu a cobrança reage quando ela muda (pedido: avisa os setores; extensão: confirma as
 * noites na VOA). Devolve true se já falou com o hóspede (aí o aviso padrão não sai).
 */
export type ReacaoCobranca = (c: Ctx, cobranca: CobrancaRow, estado: EstadoLink) => Promise<boolean>;

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Conferência no provedor: a cada 15 s nos primeiros 10 min, depois a cada 2 min até vencer. */
const espera = (tentativa: number) => (tentativa < 40 ? 15_000 : 120_000);

/**
 * Pagamento por link (Salabim Pay): cria o link, manda ao hóspede e confere no provedor até ser
 * pago ou vencer. O aviso do provedor (webhook) só acelera a conferência: o que vale é a consulta.
 */
@Injectable()
export class Cobrancas {
  private readonly log = new Logger('cobrancas');
  private readonly reacoes = new Map<CobrancaRow['tipo'], ReacaoCobranca>();

  constructor(
    private readonly nucleo: Nucleo,
    private readonly acoes: Acoes,
    private readonly unidades: Unidades,
    private readonly salabim: ClienteSalabim,
    @Inject(CONFIG) private readonly cfg: Config,
  ) {}

  get disponivel(): boolean {
    return this.salabim.disponivel;
  }

  reagir(tipo: CobrancaRow['tipo'], fn: ReacaoCobranca) {
    this.reacoes.set(tipo, fn);
  }

  /**
   * Cria o link e a cobrança (sem mandar nada ao hóspede: quem chama monta a mensagem com o link).
   * Falha do provedor sobe como erro e nada fica gravado.
   */
  async criar(
    c: Ctx,
    p: {
      s: SolicitacaoRow;
      tipo: CobrancaRow['tipo'];
      descricao: string;
      itens: ItemLink[];
      cliente?: { nome?: string | null; email?: string | null };
      reserva?: { checkIn: string; checkOut: string; codigo?: string | null; hospede?: string | null } | null;
      criadoPor?: string | null;
      minutos?: number;
    },
  ): Promise<CobrancaRow> {
    const id = randomUUID();
    const hotel = (await c.tx.client.query<{ nome: string }>('SELECT nome FROM unidade WHERE id = $1', [p.s.unidade_id])).rows[0]?.nome ?? 'Hotel';
    const link = await this.salabim.criarLink({
      nome: `${hotel}: ${p.descricao}`,
      itens: p.itens,
      expiraEm: new Date(Date.now() + (p.minutos ?? this.cfg.SALABIM_LINK_MINUTOS) * 60_000),
      cliente: p.cliente,
      reserva: p.reserva,
      idempotencia: id,
    });
    const r = await c.tx.client.query<CobrancaRow>(
      `INSERT INTO cobranca (id, org_id, unidade_id, solicitacao_id, tipo, descricao, valor_centavos, link_id, link, expira_em, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [id, c.tx.orgId, p.s.unidade_id, p.s.id, p.tipo, p.descricao, link.valorCentavos, link.id, link.url, link.expiraEm, p.criadoPor ?? null],
    );
    await this.nucleo.evento(c, { solicitacaoId: p.s.id, tipo: 'cobranca_criada', atorTipo: p.criadoPor ? 'pessoa' : 'ia', atorId: p.criadoPor ?? null, dados: { cobranca: id, valor: link.valorCentavos, tipo: p.tipo } });
    await this.nucleo.temporizador(c, { tipo: 'cobranca', orgId: c.tx.orgId, cobrancaId: id, tentativa: 0 }, new Date(Date.now() + espera(0)));
    return r.rows[0]!;
  }

  /** "até 14:30" (ou "até 29/10 às 14:30" se não for hoje), no relógio do hotel. */
  async prazo(c: Ctx, unidadeId: string, quando: Date | null): Promise<string> {
    if (!quando) return '';
    const fuso = (await this.unidades.versaoAtual(c.tx, unidadeId)).fuso;
    const dia = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit' }).format(d);
    const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quando);
    return dia(quando) === dia(new Date()) ? `até ${hora}` : `até ${dia(quando)} às ${hora}`;
  }

  /** Texto do link para o hóspede (o mesmo em todo lugar). */
  async textoDoLink(c: Ctx, cob: CobrancaRow): Promise<string> {
    const teste = this.salabim.teste ? '\n(Ambiente de testes: use os dados de teste do Salabim, nenhum valor é cobrado.)' : '';
    return `Pague por Pix ou cartão neste link (vale ${await this.prazo(c, cob.unidade_id, cob.expira_em)}):\n${cob.link}${teste}`;
  }

  /**
   * Confere no provedor (temporizador ou aviso do webhook). A consulta é fora da transação; a
   * mudança, dentro, com a cobrança travada (dois avisos juntos não aplicam duas vezes).
   */
  async conferir(orgId: string, cobrancaId: string, tentativa: number | null): Promise<void> {
    const atual = await this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query<CobrancaRow>('SELECT * FROM cobranca WHERE id = $1', [cobrancaId]);
      return r.rows[0] ?? null;
    });
    if (!atual || atual.estado !== 'aguardando' || !atual.link_id) return;
    let estado: EstadoLink | null = null;
    try {
      estado = (await this.salabim.consultar(atual.link_id)).estado;
    } catch (e) {
      this.log.warn(`conferir cobrança ${cobrancaId}: ${(e as Error).message}`);
    }
    // O provedor às vezes demora a marcar o vencido: passada a folga, vale o relógio.
    const vencida = atual.expira_em && new Date(atual.expira_em).getTime() + 10 * 60_000 < Date.now();
    if (estado === 'aguardando' && vencida) estado = 'expirada';
    await this.nucleo.executar(orgId, async (c) => {
      const r = await c.tx.client.query<CobrancaRow>('SELECT * FROM cobranca WHERE id = $1 FOR UPDATE', [cobrancaId]);
      const cob = r.rows[0]!;
      if (cob.estado !== 'aguardando') return;
      if (estado && estado !== 'aguardando') {
        await this.aplicar(c, cob, estado);
        return;
      }
      // Ainda aguardando: confere de novo (só o temporizador encadeia; o webhook só antecipa).
      if (tentativa !== null && !vencida) {
        await this.nucleo.temporizador(c, { tipo: 'cobranca', orgId, cobrancaId, tentativa: tentativa + 1 }, new Date(Date.now() + espera(tentativa + 1)));
      }
    });
  }

  private async aplicar(c: Ctx, cob: CobrancaRow, estado: EstadoLink) {
    const q = await c.tx.client.query<CobrancaRow>(
      `UPDATE cobranca SET estado = $2, pago_em = CASE WHEN $2 = 'paga' THEN now() ELSE pago_em END, atualizado_em = now() WHERE id = $1 RETURNING *`,
      [cob.id, estado],
    );
    const nova = q.rows[0]!;
    await this.nucleo.evento(c, { solicitacaoId: cob.solicitacao_id, tipo: `cobranca_${estado}`, atorTipo: 'sistema', dados: { cobranca: cob.id, valor: cob.valor_centavos } });
    const valor = brl(cob.valor_centavos);
    const nota = {
      paga: `Pago por link (Pix ou cartão): ${cob.descricao} · ${valor}.`,
      expirada: `O link de pagamento venceu sem pagamento: ${cob.descricao} · ${valor}.`,
      cancelada: `O link de pagamento foi cancelado: ${cob.descricao} · ${valor}.`,
      estornada: `Pagamento estornado: ${cob.descricao} · ${valor}.`,
      aguardando: '',
    }[estado];
    if (nota) await this.acoes.notaInterna(c, cob.solicitacao_id, nota, { tipo: 'sistema' });
    const falou = (await this.reacoes.get(cob.tipo)?.(c, nova, estado)) ?? false;
    if (falou) return;
    const s = await this.acoes.carregar(c, cob.solicitacao_id, false);
    const texto = {
      paga: `Pagamento confirmado: ${cob.descricao}, ${valor}. Obrigado!`,
      expirada: `O link de pagamento venceu sem pagamento (${cob.descricao}, ${valor}). Se ainda quiser pagar, é só pedir um novo.`,
      cancelada: '',
      estornada: `O pagamento foi estornado: ${cob.descricao}, ${valor}.`,
      aguardando: '',
    }[estado];
    if (texto) await this.acoes.enviarAoSolicitante(c, s, { texto, idioma: 'pt', autor: { tipo: 'ia' } });
  }

  /** As cobranças de um atendimento (para o cartão do pedido). */
  async daSolicitacao(c: Ctx, solicitacaoId: string): Promise<CobrancaRow[]> {
    const r = await c.tx.client.query<CobrancaRow>('SELECT * FROM cobranca WHERE solicitacao_id = $1 ORDER BY criado_em', [solicitacaoId]);
    return r.rows;
  }
}
