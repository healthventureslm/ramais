import { ActionSheet, Button, EmptyState, HVProvider, NavBar, Spinner, TabBar, TopNav, useConfirm, useViewport } from '@healthventureslm/design-system';
import type { Sessao } from '@ramais/contracts';
import { BarChart3, Inbox, LayoutDashboard, Menu as IconeMenu, MessagesSquare, Radio, Settings2, Workflow } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { aparenciaSalva, NOMES_APARENCIA, salvarAparencia, type Aparencia } from './aparencia';
import { api, quandoExpirar, salvarSessao, sessaoSalva, type Eu } from './api';
import { Avisos, avisar } from './componentes/Avisos';
import { TrocarSenha } from './componentes/Conta';
import { Ofertas } from './componentes/Ofertas';
import { conectar, desconectar, useEvento } from './tempo-real';
import { Atendimentos } from './telas/Atendimentos';
import { Diretas } from './telas/Diretas';
import { Login } from './telas/Login';
import { Painel } from './telas/Painel';

// Editor da jornada e administração só para admin, dashboard para gerência e admin: carregam sob demanda
// (o celular da equipe baixa menos).
const Admin = lazy(() => import('./telas/Admin').then((m) => ({ default: m.Admin })));
const Dashboard = lazy(() => import('./telas/Dashboard').then((m) => ({ default: m.Dashboard })));
const Jornada = lazy(() => import('./telas/Jornada').then((m) => ({ default: m.Jornada })));

type Tela = 'atendimentos' | 'painel' | 'diretas' | 'relatorio' | 'admin' | 'jornada';

export function App() {
  const [sessao, setSessao] = useState<Sessao | null>(() => sessaoSalva());

  const sair = useCallback(() => {
    salvarSessao(null);
    desconectar();
    setSessao(null);
  }, []);

  useEffect(() => {
    quandoExpirar(sair);
  }, [sair]);

  return (
    <HVProvider>
      {sessao ? (
        <Casca
          key={sessao.token}
          sessao={sessao}
          aoSair={sair}
          aoTrocarSenha={() => {
            const s = { ...sessao, pessoa: { ...sessao.pessoa, trocarSenha: false } };
            salvarSessao(s);
            setSessao(s);
          }}
        />
      ) : (
        <Login
          aoEntrar={(s) => {
            salvarSessao(s);
            setSessao(s);
          }}
        />
      )}
      <Avisos />
    </HVProvider>
  );
}

function Casca({ sessao, aoSair, aoTrocarSenha }: { sessao: Sessao; aoSair: () => void; aoTrocarSenha: () => void }) {
  useEffect(() => {
    conectar(sessao.token);
    return desconectar;
  }, [sessao.token]);
  const { isMobile } = useViewport();
  const [confirmar, confirmacao] = useConfirm();
  const [tela, setTela] = useState<Tela>('atendimentos');
  const [unidadeId, setUnidadeId] = useState(sessao.unidades[0]?.id ?? '');
  const [eu, setEu] = useState<Eu | null>(null);
  const [abrir, setAbrir] = useState<string | null>(null);
  const [diretasNovas, setDiretasNovas] = useState(0);
  const [minhaConta, setMinhaConta] = useState(false);
  const [mais, setMais] = useState(false);
  const [aparencia, setAparencia] = useState<Aparencia>(aparenciaSalva);
  const [escolherAparencia, setEscolherAparencia] = useState(false);
  const mudarAparencia = (a: Aparencia) => {
    salvarAparencia(a);
    setAparencia(a);
  };
  const opcoesAparencia = (Object.keys(NOMES_APARENCIA) as Aparencia[]).map((a) => ({
    id: `aparencia-${a}`,
    label: a === aparencia ? `${NOMES_APARENCIA[a]} (atual)` : NOMES_APARENCIA[a],
    onSelect: () => mudarAparencia(a),
  }));

  const recarregarEu = useCallback(() => {
    api.eu().then(setEu).catch(() => undefined);
  }, []);
  useEffect(recarregarEu, [recarregarEu]);

  // As telas sob demanda já descem logo depois da entrada, com o navegador ocioso: abrir Dashboard,
  // Jornada ou Administração pela primeira vez não passa mais pelo "carregando" no meio da tela,
  // que depois pulava para o conteúdo. Quem não tem acesso a elas não baixa nada.
  useEffect(() => {
    const gestao = sessao.pessoa.admin || sessao.pessoa.gerente;
    if (!gestao) return;
    const baixar = () => {
      void import('./telas/Dashboard');
      if (sessao.pessoa.admin) {
        void import('./telas/Jornada');
        void import('./telas/Admin');
      }
    };
    const ocioso = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    if (ocioso) ocioso(baixar);
    else setTimeout(baixar, 1500);
  }, [sessao.pessoa.admin, sessao.pessoa.gerente]);

  useEvento('aviso', (p) => avisar(p.texto));
  useEvento('direta:nova', (p) => {
    if (tela !== 'diretas') setDiretasNovas((n) => n + 1);
    avisar(p.urgente ? 'Mensagem direta urgente: abra para dar ciente' : 'Nova mensagem direta', p.urgente ? 'warning' : 'info');
  });
  useEvento('escalonamento:supervisor', (p) =>
    avisar(`${p.titulo} · esperando há ${p.esperandoSeg < 90 ? `${p.esperandoSeg} s` : `${Math.round(p.esperandoSeg / 60)} min`}`, 'warning'),
  );

  const emTurno = Boolean(eu?.turno);
  // Senha temporária: troca antes de usar qualquer coisa. A sessão salva pode ser antiga; o /auth/eu é a palavra final.
  const trocaObrigatoria = eu ? eu.pessoa.trocarSenha : Boolean(sessao.pessoa.trocarSenha);

  async function alternarTurno() {
    if (emTurno) {
      const ok = await confirmar({
        title: 'Sair do turno?',
        description: 'Suas conversas abertas voltam para a fila do setor e você para de receber pedidos.',
        confirmLabel: 'Sair do turno',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      if (emTurno) await api.sairTurno();
      else await api.entrarTurno(unidadeId);
      recarregarEu();
      avisar(emTurno ? 'Você saiu do turno.' : 'Você está no turno. Os pedidos dos seus setores chegam para você.', 'success');
    } catch (e) {
      avisar((e as Error).message, 'error');
    }
  }

  if (!unidadeId) {
    return (
      <div className="atendimentos__vazio" style={{ height: '100%' }}>
        <EmptyState
          title="Sua conta não está lotada em nenhuma unidade"
          description="Peça ao administrador do hotel para incluir você em um setor."
          action={<Button onClick={aoSair}>Sair</Button>}
        />
      </div>
    );
  }

  const ir = (t: Tela) => {
    setTela(t);
    setMais(false);
    if (t === 'diretas') setDiretasNovas(0);
  };
  // A lista do servidor (/auth/eu) vale mais que a do login: unidade criada depois aparece sem sair.
  const unidades = eu?.unidades ?? sessao.unidades;
  const unidadeNome = unidades.find((u) => u.id === unidadeId)?.nome ?? '';
  const icones: Record<Tela, ReactNode> = {
    atendimentos: <Inbox />,
    painel: <LayoutDashboard />,
    diretas: <MessagesSquare />,
    relatorio: <BarChart3 />,
    jornada: <Workflow />,
    admin: <Settings2 />,
  };
  const telas: { id: Tela; nome: string }[] = [
    { id: 'atendimentos', nome: 'Atendimentos' },
    { id: 'painel', nome: 'Painel' },
    { id: 'diretas', nome: 'Mensagens' },
    // Gerência e administração veem o dashboard; só a administração configura.
    ...(sessao.pessoa.admin || sessao.pessoa.gerente ? [{ id: 'relatorio' as const, nome: 'Dashboard' }] : []),
    ...(sessao.pessoa.admin
      ? [
          { id: 'jornada' as const, nome: 'Jornada' },
          { id: 'admin' as const, nome: 'Administração' },
        ]
      : []),
  ];
  const emConversa = isMobile && tela === 'atendimentos' && Boolean(abrir);

  return (
    <div className={`casca ${emConversa ? 'casca--sem-tabbar' : ''}`}>
      {!isMobile ? (
        <TopNav
          brand={{ title: 'Ramais', markSrc: null }}
          items={telas.map((t) => ({ id: t.id, label: t.nome, icon: icones[t.id], badge: t.id === 'diretas' && diretasNovas > 0 }))}
          activeId={tela}
          onSelect={(id) => ir(id as Tela)}
          user={{ name: sessao.pessoa.nome, role: `${unidadeNome} · ${emTurno ? 'no turno' : 'fora do turno'}` }}
          userMenu={[
            { id: 'turno', label: emTurno ? 'Sair do turno' : 'Entrar no turno', onSelect: () => void alternarTurno() },
            ...(unidades.length > 1
              ? [
                  { type: 'heading' as const, label: 'Unidade' },
                  ...unidades.map((u) => ({ id: `u-${u.id}`, label: u.id === unidadeId ? `${u.nome} (atual)` : u.nome, onSelect: () => setUnidadeId(u.id) })),
                ]
              : []),
            { type: 'heading' as const, label: 'Aparência' },
            ...opcoesAparencia,
            { type: 'separator' as const },
            { id: 'conta', label: 'Minha conta', onSelect: () => setMinhaConta(true) },
            { id: 'sair', label: 'Sair', danger: true, onSelect: aoSair },
          ]}
        />
      ) : tela === 'atendimentos' && !abrir ? (
        <NavBar
          title="Atendimentos"
          subtitle={`${unidadeNome} · ${emTurno ? 'no turno' : 'fora do turno'}`}
          largeTitle={false}
          variant="solid"
          position="static"
          actions={[{ id: 'turno', icon: <Radio />, label: emTurno ? 'Sair do turno' : 'Entrar no turno', badge: emTurno, onClick: () => void alternarTurno() }]}
        />
      ) : (
        <div />
      )}

      <main className="casca__miolo">
        {tela === 'atendimentos' && (
          <Atendimentos sessao={sessao} unidadeId={unidadeId} abrir={abrir} aoAbrir={setAbrir} emTurno={emTurno} aoAlternarTurno={alternarTurno} />
        )}
        {tela === 'painel' && (
          <Painel
            sessao={sessao}
            unidadeId={unidadeId}
            aoAbrir={(id) => {
              setAbrir(id);
              setTela('atendimentos');
            }}
          />
        )}
        {tela === 'diretas' && <Diretas sessao={sessao} unidadeId={unidadeId} />}
        <Suspense
          fallback={
            <div className="atendimentos__vazio">
              <Spinner label="Carregando" />
            </div>
          }
        >
          {tela === 'admin' && <Admin unidadeId={unidadeId} unidadeNome={unidadeNome} euId={sessao.pessoa.id} />}
          {tela === 'jornada' && <Jornada unidadeId={unidadeId} />}
          {tela === 'relatorio' && <Dashboard unidadeId={unidadeId} unidadeNome={unidadeNome} />}
        </Suspense>
      </main>

      {isMobile && !emConversa && (
        <TabBar
          variant="solid"
          activeId={['jornada', 'admin', 'relatorio'].includes(tela) ? 'mais' : tela}
          onSelect={(id) => (id === 'mais' ? setMais(true) : ir(id as Tela))}
          items={[
            ...telas.slice(0, 3).map((t) => ({ id: t.id, label: t.nome, icon: icones[t.id], badge: t.id === 'diretas' && diretasNovas ? diretasNovas : undefined })),
            { id: 'mais', label: 'Mais', icon: <IconeMenu /> },
          ]}
        />
      )}

      <ActionSheet
        open={mais}
        onClose={() => setMais(false)}
        title={sessao.pessoa.nome}
        description={`${unidadeNome} · ${emTurno ? 'no turno' : 'fora do turno'}`}
        items={[
          ...telas.slice(3).map((t) => ({ id: t.id, label: t.nome, icon: icones[t.id], onSelect: () => ir(t.id) })),
          { id: 'turno', label: emTurno ? 'Sair do turno' : 'Entrar no turno', onSelect: () => void alternarTurno() },
          ...unidades.filter((u) => u.id !== unidadeId).map((u) => ({ id: `u-${u.id}`, label: `Trocar para ${u.nome}`, onSelect: () => setUnidadeId(u.id) })),
          {
            id: 'aparencia',
            label: `Aparência: ${NOMES_APARENCIA[aparencia].toLowerCase()}`,
            onSelect: () => {
              setMais(false);
              setEscolherAparencia(true);
            },
          },
          { id: 'conta', label: 'Minha conta', onSelect: () => setMinhaConta(true) },
          { id: 'sair', label: 'Sair da conta', danger: true, onSelect: aoSair },
        ]}
      />
      <ActionSheet
        open={escolherAparencia}
        onClose={() => setEscolherAparencia(false)}
        title="Aparência"
        description="Vale para este navegador."
        items={opcoesAparencia.map((o) => ({ ...o, onSelect: () => (o.onSelect(), setEscolherAparencia(false)) }))}
      />

      <Ofertas
        emTurno={emTurno}
        aoAceitar={(id) => {
          setAbrir(id);
          setTela('atendimentos');
        }}
      />
      {confirmacao}
      {(trocaObrigatoria || minhaConta) && (
        <TrocarSenha
          nome={sessao.pessoa.nome}
          email={sessao.pessoa.email}
          obrigatoria={trocaObrigatoria}
          aoTrocar={() => {
            setMinhaConta(false);
            setEu((x) => (x ? { ...x, pessoa: { ...x.pessoa, trocarSenha: false } } : x));
            aoTrocarSenha();
          }}
          aoFechar={() => setMinhaConta(false)}
          aoSair={aoSair}
        />
      )}
    </div>
  );
}
