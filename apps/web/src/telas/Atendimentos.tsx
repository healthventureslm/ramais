import { Avatar, Badge, Banner, Button, Drawer, EmptyState, ListGroup, ListItem, StatusDot, Tabs } from '@healthventureslm/design-system';
import type { Sessao, SolicitacaoDetalhe, SolicitacaoResumo } from '@ramais/contracts';
import { Inbox } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Filtro } from '../api';
import { avisar } from '../componentes/Avisos';
import { Conversa } from '../componentes/Conversa';
import { Lateral } from '../componentes/Lateral';
import { Chaveiro, situacao } from '../componentes/ui';
import { assinarSolicitacao, useEvento } from '../tempo-real';
import { desde, ESTADO } from '../util';

const ABAS: { value: Filtro; label: string }[] = [
  { value: 'minhas', label: 'Minhas' },
  { value: 'setores', label: 'Meus setores' },
  { value: 'unidade', label: 'Hotel' },
  { value: 'fechadas', label: 'Fechadas' },
];

const VAZIO: Record<Filtro, { titulo: string; texto: string }> = {
  minhas: { titulo: 'Nenhum atendimento com você', texto: 'Quando você estiver no turno, os pedidos dos seus setores chegam aqui.' },
  setores: { titulo: 'Nada aberto nos seus setores', texto: 'Os pedidos novos aparecem aqui assim que entram na fila.' },
  unidade: { titulo: 'Nenhum pedido aberto no hotel', texto: 'Tudo respondido por enquanto.' },
  fechadas: { titulo: 'Nada fechado nos últimos 3 dias', texto: 'Os atendimentos resolvidos e encerrados ficam aqui por 3 dias.' },
};

export function Atendimentos({
  sessao,
  unidadeId,
  abrir,
  aoAbrir,
  emTurno,
  aoAlternarTurno,
}: {
  sessao: Sessao;
  unidadeId: string;
  abrir: string | null;
  aoAbrir: (id: string | null) => void;
  emTurno: boolean;
  aoAlternarTurno: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('minhas');
  const [lista, setLista] = useState<SolicitacaoResumo[] | null>(null);
  const [detalhe, setDetalhe] = useState<SolicitacaoDetalhe | null>(null);
  const [verDetalhes, setVerDetalhes] = useState(false);
  useEffect(() => setVerDetalhes(false), [abrir]);

  const carregarLista = useCallback(() => {
    api
      .listar(filtro, unidadeId)
      .then(setLista)
      .catch((e) => avisar(e.message, 'error'));
  }, [filtro, unidadeId]);

  const carregarDetalhe = useCallback(() => {
    if (!abrir) {
      setDetalhe(null);
      return;
    }
    api
      .detalhe(abrir)
      .then(setDetalhe)
      .catch((e) => {
        // Perder o acesso é esperado (ex.: a triagem encaminhou para outro setor): fecha sem alarde.
        if (!(e instanceof ErroApi && (e.status === 403 || e.status === 404))) avisar(e.message, 'error');
        setDetalhe(null);
        aoAbrir(null);
      });
  }, [abrir, aoAbrir]);

  useEffect(carregarLista, [carregarLista]);
  useEffect(carregarDetalhe, [carregarDetalhe]);
  // Na conversa aberta, entra na sala da solicitação para receber mensagens novas.
  useEffect(() => (abrir ? assinarSolicitacao(abrir) : undefined), [abrir]);

  useEvento('solicitacao:atualizada', (p) => {
    carregarLista();
    if (p.solicitacaoId === abrir) carregarDetalhe();
  });
  useEvento('solicitacao:mensagem', (p) => {
    if (p.solicitacaoId === abrir) carregarDetalhe();
    carregarLista();
  });
  useEvento('oferta:nova', carregarLista);

  // Atalhos: Alt+1..4 trocam a aba.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const aba = ABAS[Number(e.key) - 1];
      if (aba) {
        e.preventDefault();
        setFiltro(aba.value);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const atualizarTudo = () => {
    carregarLista();
    carregarDetalhe();
  };

  const lateral = detalhe && <Lateral detalhe={detalhe} sessao={sessao} unidadeId={unidadeId} aoMudar={atualizarTudo} aoAbrir={aoAbrir} />;

  return (
    <div className={`atendimentos ${abrir ? 'atendimentos--aberto' : ''}`}>
      <section className="atendimentos__lista" aria-label="Lista de atendimentos">
        <div className="atendimentos__lista-topo">
          {!emTurno && (
            <Banner
              variant="warning"
              title="Você está fora do turno"
              description="Entre no turno para receber os pedidos dos seus setores."
              actions={
                <Button size="sm" onClick={aoAlternarTurno}>
                  Entrar no turno
                </Button>
              }
            />
          )}
          <Tabs items={ABAS} value={filtro} onChange={(v) => setFiltro(v as Filtro)} />
        </div>
        {lista === null ? (
          <EmptyState loading size="sm" />
        ) : lista.length === 0 ? (
          <EmptyState size="sm" icon={<Inbox />} title={VAZIO[filtro].titulo} description={VAZIO[filtro].texto} />
        ) : (
          <ListGroup plain>
            {lista.map((s) => (
              <ItemAtendimento key={s.id} s={s} ativo={s.id === abrir} aoAbrir={() => aoAbrir(s.id)} />
            ))}
          </ListGroup>
        )}
      </section>

      {detalhe ? (
        <>
          <Conversa detalhe={detalhe} sessao={sessao} aoVoltar={() => aoAbrir(null)} aoMudar={atualizarTudo} aoDetalhes={() => setVerDetalhes(true)} />
          <aside className="atendimentos__detalhes" aria-label="Detalhes do atendimento">
            {lateral}
          </aside>
          <Drawer open={verDetalhes} onClose={() => setVerDetalhes(false)} title="Detalhes do atendimento" size="sm">
            <div className="pilha pilha--larga">{lateral}</div>
          </Drawer>
        </>
      ) : (
        <div className="atendimentos__vazio">
          {abrir ? (
            <EmptyState loading />
          ) : (
            <EmptyState align="center" icon={<Inbox />} title="Escolha um atendimento" description="A conversa abre aqui, com os detalhes ao lado." />
          )}
        </div>
      )}
    </div>
  );
}

function ItemAtendimento({ s, ativo, aoAbrir }: { s: SolicitacaoResumo; ativo: boolean; aoAbrir: () => void }) {
  const nome = s.origem === 'interna' ? `Apoio · ${s.setor?.nome ?? ''}` : s.solicitante?.nome ?? 'Hóspede';
  return (
    <ListItem
      onClick={aoAbrir}
      active={ativo}
      wrap
      media={s.local ? <Chaveiro numero={s.local.identificador} pendente={!s.local.confirmado} /> : <Avatar name={nome} size="sm" />}
      title={
        <span className="linha" style={{ gap: 'var(--space-2)' }}>
          {nome}
          {s.urgencia === 'agora' && <Badge variant="danger">Agora</Badge>}
          {s.urgencia === 'hoje' && <Badge variant="warning">Hoje</Badge>}
        </span>
      }
      subtitle={
        <span className="pilha" style={{ gap: 'var(--space-1)' }}>
          <span>{s.resumo ?? s.ultimaMensagem ?? ''}</span>
          <span className="linha" style={{ gap: 'var(--space-3)' }}>
            <StatusDot status={situacao(s.estado, s.escalada)}>{s.escalada ? 'Escalado' : ESTADO[s.estado]}</StatusDot>
            <span>{s.setor?.nome ?? 'sem setor'}</span>
            {s.responsavel && <span>{s.responsavel.nome}</span>}
            {s.idioma !== 'pt' && <Badge outline>{s.idioma.toUpperCase()}</Badge>}
            {s.baixaCerteza && <Badge variant="warning" outline>IA em dúvida</Badge>}
            {s.triagem && <Badge variant="info">Sugestão: {s.triagem.setorSugerido.nome}</Badge>}
          </span>
        </span>
      }
      meta={desde(s.atualizadoEm)}
    />
  );
}
