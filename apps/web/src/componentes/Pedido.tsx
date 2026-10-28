import { Badge, Button, Card, CardBody, CardHeader, Dialog, Textarea } from '@healthventureslm/design-system';
import type { EstadoPedido, PedidoView } from '@ramais/contracts';
import { Check, CheckCircle2, Receipt, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useEvento } from '../tempo-real';
import { desde } from '../util';
import { avisar } from './Avisos';
import '../estilo/pedidos.css';

/** Relógio do hotel: datas e horas dos pedidos sempre no fuso de São Paulo. */
const FUSO = 'America/Sao_Paulo';
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "sex., 10/10 às 15:00" */
export const quandoPedido = (iso: string) => `${fmtDiaCurto.format(new Date(iso))} às ${fmtHora.format(new Date(iso))}`;
/** "15:00" */
export const horaPedido = (iso: string) => fmtHora.format(new Date(iso));
/** "2026-10-10", no dia do hotel. */
export const diaPedido = (iso: string) => fmtChave.format(new Date(iso));
/** "Sábado, 11/10" */
export const diaPorExtenso = (iso: string) => {
  const s = fmtDiaLongo.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const reais = (centavos: number) => fmtReais.format(centavos / 100);

/** "2 unidades" na compra, "2 pessoas" no agendamento. */
export function quantidade(p: Pick<PedidoView, 'tipo' | 'quantidade'>) {
  const um = p.quantidade === 1;
  return p.tipo === 'agendamento' ? `${p.quantidade} ${um ? 'pessoa' : 'pessoas'}` : `${p.quantidade} ${um ? 'unidade' : 'unidades'}`;
}

const SELO: Record<EstadoPedido, { variant: 'warning' | 'info' | 'danger' | 'neutral' | 'positive'; texto: (tipo: PedidoView['tipo']) => string }> = {
  pendente: { variant: 'warning', texto: () => 'Aguardando confirmação' },
  confirmado: { variant: 'info', texto: (t) => (t === 'agendamento' ? 'Confirmada' : 'Confirmado') },
  recusado: { variant: 'danger', texto: (t) => (t === 'agendamento' ? 'Recusada' : 'Recusado') },
  cancelado: { variant: 'neutral', texto: () => 'Cancelado pelo hóspede' },
  concluido: { variant: 'positive', texto: (t) => (t === 'agendamento' ? 'Realizada' : 'Entregue') },
};

export function SeloPedido({ pedido: p }: { pedido: Pick<PedidoView, 'estado' | 'tipo'> }) {
  const s = SELO[p.estado];
  return <Badge variant={s.variant}>{s.texto(p.tipo)}</Badge>;
}

export const emAberto = (p: Pick<PedidoView, 'estado'>) => p.estado === 'pendente' || p.estado === 'confirmado';
const podeLancar = (p: PedidoView) => !p.lancadoEm && p.estado !== 'recusado' && p.estado !== 'cancelado' && p.totalCentavos !== 0;

type Acao = 'confirmar' | 'recusar' | 'lancar' | 'concluir';

/**
 * Cartão do pedido (room service) ou da reserva (spa, passeio, transfer, mesa) no topo da lateral
 * do atendimento. Só aparece quando o atendimento nasceu de um pedido do catálogo.
 */
export function CartaoPedido({ solicitacaoId, estado, aoMudar }: { solicitacaoId: string; estado: string; aoMudar: () => void }) {
  const [pedido, setPedido] = useState<PedidoView | null>(null);
  const [ocupado, setOcupado] = useState<Acao | null>(null);
  const [recusando, setRecusando] = useState(false);
  const atual = useRef(solicitacaoId);
  atual.current = solicitacaoId;

  const carregar = useCallback(() => {
    api
      .pedidoDoAtendimento(solicitacaoId)
      .then((r) => {
        // Resposta atrasada de outro atendimento não pinta este.
        if (atual.current === solicitacaoId) setPedido(r.pedido);
      })
      .catch(() => undefined);
  }, [solicitacaoId]);

  useEffect(() => setPedido(null), [solicitacaoId]);
  // O estado do atendimento mudou (pegou, resolveu, encerrou): o do pedido pode ter mudado junto.
  useEffect(carregar, [carregar, estado]);
  useEvento('solicitacao:atualizada', (p) => {
    if (p.solicitacaoId === solicitacaoId) carregar();
  });

  if (!pedido || pedido.solicitacaoId !== solicitacaoId) return null;
  const p = pedido;
  const agendamento = p.tipo === 'agendamento';

  async function agir(acao: Acao, fn: () => Promise<unknown>, ok: string) {
    setOcupado(acao);
    try {
      await fn();
      avisar(ok, 'success');
      setRecusando(false);
      aoMudar();
    } catch (e) {
      // 409: alguém já respondeu. A mensagem do servidor explica e o cartão mostra como ficou.
      avisar((e as Error).message, 'error');
    } finally {
      setOcupado(null);
      carregar();
    }
  }

  const aberto = emAberto(p);
  const lancar = podeLancar(p);
  const travado = ocupado !== null;

  return (
    <Card accent={p.estado === 'pendente'}>
      <CardHeader title={agendamento ? 'Reserva' : 'Pedido'} subtitle={[p.setorNome, p.categoria].filter(Boolean).join(' · ') || undefined} action={<SeloPedido pedido={p} />} />
      <CardBody>
        <div className="pilha pilha--larga">
          <dl className="pares">
            <dt>Item</dt>
            <dd>{p.itemNome}</dd>
            <dt>{agendamento ? 'Pessoas' : 'Quantidade'}</dt>
            <dd className="dado">{quantidade(p)}</dd>
            {p.agendadoPara && (
              <>
                <dt>Quando</dt>
                <dd>
                  {quandoPedido(p.agendadoPara)}
                  {p.duracaoMin ? <span className="mudo"> · {p.duracaoMin} min</span> : null}
                </dd>
              </>
            )}
            {!agendamento && (
              <>
                <dt>Pedido</dt>
                <dd>há {desde(p.criadoEm)}</dd>
              </>
            )}
            {p.observacao && (
              <>
                <dt>Observação</dt>
                <dd>{p.observacao}</dd>
              </>
            )}
            <dt>Preço</dt>
            <dd className="dado">
              {p.precoUnitCentavos === null ? <span className="mudo">sem preço no catálogo</span> : p.precoUnitCentavos === 0 ? 'sem custo' : `${reais(p.precoUnitCentavos)} cada`}
            </dd>
            {p.totalCentavos !== null && p.totalCentavos > 0 && (
              <>
                <dt>Total</dt>
                <dd className="dado pedido__total">{reais(p.totalCentavos)}</dd>
              </>
            )}
            {p.totalCentavos !== 0 && (
              <>
                <dt>Conta</dt>
                <dd className="linha">
                  {p.lancadoEm ? (
                    <>
                      <Badge variant="positive" outline>
                        Lançado na conta
                      </Badge>
                      <span className="pequeno mudo">{quandoPedido(p.lancadoEm)}</span>
                    </>
                  ) : (
                    <span className="mudo">ainda não lançado</span>
                  )}
                </dd>
              </>
            )}
            {p.motivo && (
              <>
                <dt>Motivo</dt>
                <dd>{p.motivo}</dd>
              </>
            )}
          </dl>

          {(aberto || lancar) && (
            <div className="pilha">
              {p.estado === 'pendente' && (
                <Button block iconLeft={<Check />} loading={ocupado === 'confirmar'} disabled={travado} onClick={() => agir('confirmar', () => api.confirmarPedido(p.id), agendamento ? 'Reserva confirmada. O hóspede foi avisado.' : 'Pedido confirmado. O hóspede foi avisado.')}>
                  Confirmar
                </Button>
              )}
              {aberto && (
                <Button
                  block
                  variant={p.estado === 'confirmado' ? 'primary' : 'secondary'}
                  iconLeft={<CheckCircle2 />}
                  loading={ocupado === 'concluir'}
                  disabled={travado}
                  onClick={() => agir('concluir', () => api.concluirPedido(p.id), agendamento ? 'Marcada como realizada.' : 'Marcado como entregue.')}
                >
                  {agendamento ? 'Realizado' : 'Entregue'}
                </Button>
              )}
              {lancar && (
                <Button block variant="secondary" iconLeft={<Receipt />} loading={ocupado === 'lancar'} disabled={travado} onClick={() => agir('lancar', () => api.lancarPedido(p.id), 'Lançado na conta do quarto.')}>
                  Lançar na conta
                </Button>
              )}
              {aberto && (
                <Button block variant="ghost" iconLeft={<XCircle />} disabled={travado} onClick={() => setRecusando(true)}>
                  Recusar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardBody>
      <ModalRecusar
        open={recusando}
        agendamento={agendamento}
        enviando={ocupado === 'recusar'}
        aoFechar={() => setRecusando(false)}
        aoConfirmar={(motivo) => agir('recusar', () => api.recusarPedido(p.id, motivo), agendamento ? 'Reserva recusada. O hóspede recebeu o motivo.' : 'Pedido recusado. O hóspede recebeu o motivo.')}
      />
    </Card>
  );
}

function ModalRecusar({
  open,
  agendamento,
  enviando,
  aoFechar,
  aoConfirmar,
}: {
  open: boolean;
  agendamento: boolean;
  enviando: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (open) {
      setMotivo('');
      setTocado(false);
    }
  }, [open]);
  const valido = motivo.trim().length >= 2;
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      danger
      icon={<XCircle />}
      title={agendamento ? 'Recusar a reserva' : 'Recusar o pedido'}
      description="O hóspede recebe o motivo traduzido para o idioma dele e o atendimento é encerrado."
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="danger" loading={enviando} disabled={!valido} onClick={() => aoConfirmar(motivo.trim())}>
            Recusar
          </Button>
        </>
      }
    >
      <Textarea
        label="Motivo"
        required
        rows={3}
        maxLength={300}
        autoFocus
        placeholder={agendamento ? 'Ex.: não há mais horário livre às 15h' : 'Ex.: a cozinha fecha às 23h'}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        onBlur={() => setTocado(true)}
        error={tocado && !valido ? 'Escreva o motivo (pelo menos 2 letras).' : undefined}
      />
    </Dialog>
  );
}
