import { Avatar, Badge, Banner, Button, Card, CardBody, CardHeader, EmptyState, ListGroup, ListItem, PageHeader, StatCard, StatusDot, Table, useConfirm } from '@healthventureslm/design-system';
import type { DashboardView, Sessao } from '@ramais/contracts';
import { BellRing, Clock, Hourglass, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { avisar } from '../componentes/Avisos';
import { Chaveiro } from '../componentes/ui';
import { useEvento } from '../tempo-real';
import { duracao, ESTADO, supervisiona } from '../util';

type Linha = DashboardView['precisaDeAlguem'][number];
type Atendendo = DashboardView['emAtendimento'][number];

const ESCADA: Record<0 | 1 | 2, { texto: string; status: 'live' | 'warning' | 'danger' }> = {
  0: { texto: 'Aguardando', status: 'live' },
  1: { texto: 'Passou de mão', status: 'warning' },
  2: { texto: 'Supervisão chamada', status: 'danger' },
};

/**
 * Painel ao vivo: quem espera a equipe agora, quem está atendendo o quê, os setores e quem está no
 * turno. A supervisão do setor (e gerente, admin) pode assumir uma conversa daqui. Histórico fica no Relatório.
 */
export function Painel({ sessao, unidadeId, aoAbrir }: { sessao: Sessao; unidadeId: string; aoAbrir: (id: string) => void }) {
  const [confirmar, confirmacao] = useConfirm();
  const [dados, setDados] = useState<DashboardView | null>(null);
  const [erro, setErro] = useState('');
  const [, setTique] = useState(0);
  const [carregadoEm, setCarregadoEm] = useState(() => Date.now());

  const carregar = useCallback(() => {
    api
      .dashboard(unidadeId)
      .then((d) => {
        setDados(d);
        setCarregadoEm(Date.now());
        setErro('');
      })
      .catch((e) => setErro(e.message));
  }, [unidadeId]);

  useEffect(carregar, [carregar]);
  useEffect(() => {
    // Recarrega a cada 15 s e atualiza os cronômetros a cada segundo.
    const a = setInterval(carregar, 15_000);
    const b = setInterval(() => setTique((x) => x + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [carregar]);
  useEvento('solicitacao:atualizada', carregar);
  useEvento('escalonamento:supervisor', carregar);

  const passou = () => Math.round((Date.now() - carregadoEm) / 1000);
  const espera = (l: Linha) => l.esperandoSeg + passou();

  async function pegar(id: string) {
    try {
      await api.pegar(id);
      aoAbrir(id);
    } catch (e) {
      avisar((e as Error).message, 'error');
      carregar();
    }
  }

  async function assumir(l: Atendendo) {
    const ok = await confirmar({
      title: `Assumir o atendimento de ${l.responsavel.nome}?`,
      description: 'A conversa passa para você agora. A pessoa é avisada e a troca fica registrada no histórico.',
      confirmLabel: 'Assumir',
    });
    if (!ok) return;
    try {
      await api.assumir(l.solicitacaoId);
      avisar('Atendimento é seu.', 'success');
      aoAbrir(l.solicitacaoId);
    } catch (e) {
      avisar((e as Error).message, 'error');
      carregar();
    }
  }

  // Carregando e erro usam a mesma casca da página pronta: o título não pula quando os dados chegam.
  const cabecalho = <PageHeader title="Painel" subtitle="Quem está esperando a equipe agora. Atualiza sozinho." />;
  if (erro || !dados) {
    return (
      <div className="rolagem">
        <div className="pagina">
          {cabecalho}
          {erro ? (
            <Banner variant="danger" title="Não deu para carregar o painel" description={erro} actions={<Button size="sm" onClick={carregar}>Tentar de novo</Button>} />
          ) : (
            <EmptyState loading />
          )}
        </div>
      </div>
    );
  }

  const naFila = dados.setores.reduce((n, s) => n + s.naFila, 0);
  const escaladas = dados.setores.reduce((n, s) => n + s.escaladas, 0);
  const maisAntigo = dados.precisaDeAlguem.reduce((m, l) => Math.max(m, espera(l)), 0);

  return (
    <div className="rolagem">
      <div className="pagina">
        {cabecalho}

        <div className="grade-cartoes">
          <StatCard icon={<Hourglass />} label="Na fila" value={naFila} hint="pedidos sem ninguém" accent="petrol" />
          <StatCard icon={<Clock />} label="Espera mais longa" value={maisAntigo ? duracao(maisAntigo) : '—'} hint="desde que o hóspede pediu" accent={maisAntigo >= 600 ? 'crimson' : 'amber'} />
          <StatCard icon={<BellRing />} label="Na escada" value={escaladas} hint="supervisão já chamada" accent={escaladas ? 'crimson' : 'emerald'} />
          <StatCard icon={<Users />} label="No turno" value={dados.pessoasEmTurno.length} hint="pessoas recebendo pedidos" accent="emerald" />
        </div>

        <div className="grade-2">
          <Card>
            <CardHeader title="Precisa de alguém" subtitle={dados.precisaDeAlguem.length ? `${dados.precisaDeAlguem.length} esperando` : undefined} />
            <Table<Linha>
              rowKey="solicitacaoId"
              emptyText="Ninguém esperando a equipe agora."
              data={dados.precisaDeAlguem}
              onRowClick={(l) => aoAbrir(l.solicitacaoId)}
              columns={[
                {
                  key: 'espera',
                  header: 'Esperando',
                  mono: true,
                  width: '110px',
                  primary: true,
                  render: (l: Linha) => <span style={{ color: espera(l) >= 600 ? 'var(--danger-fg)' : undefined, fontWeight: 600 }}>{duracao(espera(l))}</span>,
                } as never,
                {
                  key: 'pedido',
                  header: 'Pedido',
                  secondary: true,
                  render: (l: Linha) => (
                    <div>
                      <div className="linha">
                        {l.resumo ?? '—'}
                        {l.urgencia === 'agora' && <Badge variant="danger">Agora</Badge>}
                        {l.urgencia === 'hoje' && <Badge variant="warning">Hoje</Badge>}
                      </div>
                      <div className="pequeno mudo">{l.estado === 'em_atendimento' ? `Sem resposta · com ${l.responsavel ?? 'alguém'}` : ESTADO[l.estado]}</div>
                    </div>
                  ),
                } as never,
                { key: 'setor', header: 'Setor', render: (l) => l.setor ?? '—' },
                { key: 'escada', header: 'Escada', render: (l) => <StatusDot status={ESCADA[l.degrau].status}>{ESCADA[l.degrau].texto}</StatusDot> },
                {
                  key: 'acao',
                  header: '',
                  align: 'right',
                  render: (l) =>
                    l.estado === 'em_atendimento' ? (
                      <Button size="sm" variant="secondary" onClick={(e) => (e.stopPropagation(), aoAbrir(l.solicitacaoId))}>
                        Abrir conversa
                      </Button>
                    ) : (
                      <Button size="sm" onClick={(e) => (e.stopPropagation(), void pegar(l.solicitacaoId))}>
                        Pegar
                      </Button>
                    ),
                },
              ]}
            />
          </Card>

          <div className="pilha pilha--larga">
            <ListGroup label="Setores">
              {dados.setores.map((s) => (
                <ListItem
                  key={s.id}
                  title={s.nome}
                  subtitleParts={[
                    s.emTurno ? <StatusDot status="positive">{s.emTurno} no turno</StatusDot> : <StatusDot status="neutral">ninguém no turno</StatusDot>,
                    s.escaladas ? <span style={{ color: 'var(--danger-fg)' }}>{s.escaladas} na escada</span> : null,
                    s.primeiraRespostaMedianaSeg !== null ? `1ª resposta ${duracao(s.primeiraRespostaMedianaSeg)}` : null,
                  ].filter(Boolean)}
                  meta={`${s.naFila} na fila`}
                  wrap
                />
              ))}
            </ListGroup>
            <ListGroup label={`No turno (${dados.pessoasEmTurno.length})`}>
              {dados.pessoasEmTurno.length === 0 ? (
                <Card flat padded>
                  <CardBody>
                    <span className="pequeno mudo">Ninguém no turno: os pedidos ficam na fila e a escada avisa a supervisão.</span>
                  </CardBody>
                </Card>
              ) : (
                dados.pessoasEmTurno.map((p) => (
                  <ListItem key={p.id} media={<Avatar name={p.nome} size="sm" />} title={p.nome} meta={p.carga ? `${p.carga} em atendimento` : 'livre'} />
                ))
              )}
            </ListGroup>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Em atendimento agora"
            subtitle={dados.emAtendimento.length ? `${dados.emAtendimento.length} conversas com alguém da equipe` : undefined}
          />
          <Table<Atendendo>
            rowKey="solicitacaoId"
            emptyText="Nenhuma conversa em andamento."
            data={dados.emAtendimento}
            onRowClick={(l) => aoAbrir(l.solicitacaoId)}
            columns={[
              {
                key: 'pedido',
                header: 'Pedido',
                primary: true,
                render: (l: Atendendo) => (
                  <div className="linha" style={{ flexWrap: 'nowrap', gap: 'var(--space-3)' }}>
                    {l.quarto && <Chaveiro numero={l.quarto} />}
                    <div style={{ minWidth: 0 }}>
                      <div>{l.resumo ?? '—'}</div>
                      <div className="pequeno mudo">{l.setor ?? 'Sem setor'}</div>
                    </div>
                  </div>
                ),
              } as never,
              {
                key: 'com',
                header: 'Com',
                secondary: true,
                render: (l: Atendendo) => (
                  <div className="linha" style={{ flexWrap: 'nowrap', gap: 'var(--space-2)' }}>
                    <Avatar name={l.responsavel.nome} size="xs" />
                    <span>
                      {l.responsavel.id === sessao.pessoa.id ? 'Você' : l.responsavel.nome}
                      <span className="pequeno mudo"> · há {duracao(l.comResponsavelSeg + passou())}</span>
                    </span>
                  </div>
                ),
              } as never,
              {
                key: 'resposta',
                header: 'Hóspede',
                mono: true,
                render: (l: Atendendo) => {
                  if (l.esperandoRespostaSeg === null) return <span className="pequeno mudo">{l.estado === 'aguardando_solicitante' ? 'equipe respondeu, aguardando' : 'respondido'}</span>;
                  const s = l.esperandoRespostaSeg + passou();
                  return <span style={{ color: s >= 300 ? 'var(--danger-fg)' : undefined, fontWeight: 600 }}>esperando {duracao(s)}</span>;
                },
              } as never,
              {
                key: 'acao',
                header: '',
                align: 'right',
                render: (l: Atendendo) => (
                  <div className="linha" style={{ justifyContent: 'flex-end' }}>
                    {l.responsavel.id !== sessao.pessoa.id && supervisiona(sessao, l.setorId) && (
                      <Button size="sm" variant="secondary" onClick={(e) => (e.stopPropagation(), void assumir(l))}>
                        Assumir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={(e) => (e.stopPropagation(), aoAbrir(l.solicitacaoId))}>
                      Abrir
                    </Button>
                  </div>
                ),
              } as never,
            ]}
          />
        </Card>
      </div>
      {confirmacao}
    </div>
  );
}
