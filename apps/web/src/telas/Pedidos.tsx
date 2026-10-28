import { Badge, Banner, Button, EmptyState, ListGroup, ListItem, PageHeader, SegmentedControl } from '@healthventureslm/design-system';
import type { PedidoView } from '@ramais/contracts';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type FiltroPedidos } from '../api';
import { diaPedido, diaPorExtenso, horaPedido, quandoPedido, quantidade, reais, SeloPedido } from '../componentes/Pedido';
import { useEvento } from '../tempo-real';
import { desde } from '../util';
import '../estilo/pedidos.css';

const FILTROS: { value: FiltroPedidos; label: string }[] = [
  { value: 'abertos', label: 'Em aberto' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'todos', label: 'Todos' },
];

const VAZIO: Record<FiltroPedidos, { titulo: string; texto: string }> = {
  abertos: { titulo: 'Nenhum pedido em aberto', texto: 'Quando um hóspede pedir algo do catálogo pelo chat do quarto, o pedido aparece aqui.' },
  agenda: { titulo: 'Nada agendado', texto: 'Reservas de spa, passeios, transfer e mesa aparecem aqui, separadas por dia.' },
  todos: { titulo: 'Nenhum pedido ainda', texto: 'Os pedidos e reservas feitos pelo chat do quarto ficam registrados aqui.' },
};

/** "2026-10-10" + 1 dia, sem passar pelo fuso do navegador. */
function diaSeguinte(dia: string) {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Pedidos do catálogo: room service, spa, passeios, transfer e mesa. Cada pedido é um atendimento
 * na fila do setor do item; tocar na linha abre a conversa com o cartão do pedido ao lado.
 */
export function Pedidos({ unidadeId, aoAbrir }: { unidadeId: string; aoAbrir: (solicitacaoId: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroPedidos>('abertos');
  const [dados, setDados] = useState<{ hoje: string; pedidos: PedidoView[] } | null>(null);
  const [erro, setErro] = useState('');
  const pedidoAtual = useRef(0);

  const carregar = useCallback(() => {
    const n = ++pedidoAtual.current;
    api
      .pedidos(unidadeId, filtro)
      .then((d) => {
        // Trocou de aba no meio do caminho: a resposta antiga não pinta a lista nova.
        if (n !== pedidoAtual.current) return;
        setDados(d);
        setErro('');
      })
      .catch((e: Error) => {
        if (n === pedidoAtual.current) setErro(e.message);
      });
  }, [unidadeId, filtro]);

  useEffect(() => {
    setDados(null);
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => clearInterval(t);
  }, [carregar]);
  useEvento('solicitacao:atualizada', (p) => {
    if (p.unidadeId === unidadeId) carregar();
  });

  const linha = (p: PedidoView, naAgenda: boolean) => {
    const agendamento = p.tipo === 'agendamento';
    return (
      <ListItem
        key={p.id}
        onClick={() => aoAbrir(p.solicitacaoId)}
        wrap
        title={p.itemNome}
        subtitleParts={[
          p.quarto ? `Quarto ${p.quarto}` : 'Quarto não identificado',
          quantidade(p),
          p.totalCentavos ? reais(p.totalCentavos) : null,
          !naAgenda && agendamento && p.agendadoPara ? quandoPedido(p.agendadoPara) : null,
        ].filter(Boolean)}
        meta={naAgenda && p.agendadoPara ? horaPedido(p.agendadoPara) : !agendamento ? `há ${desde(p.criadoEm)}` : undefined}
        chevron
      >
        <span className="pedidos__selos">
          <SeloPedido pedido={p} />
          {p.lancadoEm && (
            <Badge variant="positive" outline>
              Lançado na conta
            </Badge>
          )}
        </span>
        {p.observacao && <span className="pedidos__obs pequeno mudo">{p.observacao}</span>}
      </ListItem>
    );
  };

  let conteudo;
  if (erro && !dados) {
    conteudo = <Banner variant="danger" title="Não deu para carregar os pedidos" description={erro} actions={<Button size="sm" onClick={carregar}>Tentar de novo</Button>} />;
  } else if (!dados) {
    conteudo = <EmptyState loading />;
  } else if (dados.pedidos.length === 0) {
    conteudo = (
      <EmptyState
        variant="card"
        icon={filtro === 'agenda' ? <CalendarDays /> : <ShoppingBag />}
        title={VAZIO[filtro].titulo}
        description={VAZIO[filtro].texto}
      />
    );
  } else if (filtro === 'agenda') {
    // Agenda: um grupo por dia (no relógio do hotel), na ordem do horário.
    const amanha = diaSeguinte(dados.hoje);
    const porDia = new Map<string, PedidoView[]>();
    const ordenados = [...dados.pedidos].filter((p) => p.agendadoPara).sort((a, b) => Date.parse(a.agendadoPara!) - Date.parse(b.agendadoPara!));
    for (const p of ordenados) {
      const dia = diaPedido(p.agendadoPara!);
      porDia.set(dia, [...(porDia.get(dia) ?? []), p]);
    }
    conteudo = (
      <div className="pilha pilha--larga">
        {[...porDia].map(([dia, lista]) => (
          <ListGroup key={dia} label={dia === dados.hoje ? 'Hoje' : dia === amanha ? 'Amanhã' : diaPorExtenso(lista[0]!.agendadoPara!)}>
            {lista.map((p) => linha(p, true))}
          </ListGroup>
        ))}
      </div>
    );
  } else {
    conteudo = <ListGroup>{dados.pedidos.map((p) => linha(p, false))}</ListGroup>;
  }

  return (
    <div className="rolagem">
      <div className="pagina">
        <PageHeader title="Pedidos" subtitle="Room service e reservas feitos pelo chat do quarto. Atualiza sozinho." />
        <div className="pedidos__filtro">
          <SegmentedControl block options={FILTROS} value={filtro} onChange={(v) => setFiltro(v as FiltroPedidos)} />
        </div>
        {conteudo}
      </div>
    </div>
  );
}
