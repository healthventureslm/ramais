import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CopyField,
  EmptyState,
  Input,
  PageHeader,
  SegmentedControl,
  StatCard,
  Table,
  Tabs,
  Tag,
  Textarea,
  useConfirm,
} from '@healthventureslm/design-system';
import { Gauge, ListChecks, QrCode, Target, Upload, Waypoints } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { API, api } from '../api';
import { avisar } from '../componentes/Avisos';
import '../estilo/admin.css';
import { Conhecimento } from './admin/Conhecimento';
import { Equipe } from './admin/Equipe';
import { Quartos } from './admin/Quartos';

const ABAS = [
  { id: 'equipe', nome: 'Equipe' },
  { id: 'quartos', nome: 'Quartos e QR' },
  { id: 'conhecimento', nome: 'Base de conhecimento' },
  { id: 'automacao', nome: 'Automação da IA' },
  { id: 'aparelhos', nome: 'Celulares e hóspedes' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

const CHAVE_ABA = 'ramais.admin.aba';
function abaSalva(): Aba {
  try {
    const a = localStorage.getItem(CHAVE_ABA);
    return ABAS.some((x) => x.id === a) ? (a as Aba) : 'equipe';
  } catch {
    return 'equipe';
  }
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/** Administração da unidade: equipe, quartos, base de conhecimento, números e a automação da IA. */
export function Admin({ unidadeId, unidadeNome, euId }: { unidadeId: string; unidadeNome: string; euId: string }) {
  const [aba, setAba] = useState<Aba>(abaSalva);
  const escolher = (a: Aba) => {
    setAba(a);
    try {
      localStorage.setItem(CHAVE_ABA, a);
    } catch {
      // sem armazenamento: só não lembra a aba
    }
  };
  return (
    <div className="rolagem">
      <div className="pagina">
        <PageHeader title="Administração" subtitle={`Equipe, quartos, base de conhecimento e a IA de ${unidadeNome}.`} />
        <Tabs
          className="admin-abas"
          aria-label="Administração"
          items={ABAS.map((a) => ({ value: a.id, label: a.nome }))}
          value={aba}
          onChange={(v) => escolher(v as Aba)}
        />
        <div role="tabpanel" className="pilha pilha--larga">
          {aba === 'equipe' && <Equipe unidadeId={unidadeId} euId={euId} />}
          {aba === 'quartos' && <Quartos unidadeId={unidadeId} unidadeNome={unidadeNome} />}
          {aba === 'conhecimento' && <Conhecimento unidadeId={unidadeId} />}
          {aba === 'automacao' && (
            <>
              <Automacao unidadeId={unidadeId} />
              <Calibracao unidadeId={unidadeId} />
            </>
          )}
          {aba === 'aparelhos' && (
            <div className="admin-colunas">
              <Dispositivo unidadeId={unidadeId} />
              <Hospedes unidadeId={unidadeId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type LinhaAutomacao = Awaited<ReturnType<typeof api.admin.automacao>>[number];

/** Automação setor a setor: começa em sombra e libera quando o acerto prova que pode. */
function Automacao({ unidadeId }: { unidadeId: string }) {
  const [linhas, setLinhas] = useState<LinhaAutomacao[] | null>(null);
  const [confirmar, confirmacao] = useConfirm();
  const carregar = () => api.admin.automacao(unidadeId).then(setLinhas).catch((e) => avisar(e.message, 'error'));
  useEffect(() => {
    void carregar();
  }, [unidadeId]);

  async function mudarModo(l: LinhaAutomacao, m: 'sombra' | 'automatico') {
    if (l.modo === m) return;
    if (
      m === 'automatico' &&
      l.recomendacao !== 'pode_liberar' &&
      !(await confirmar({
        title: `Liberar o automático em ${l.nome}?`,
        description: `O acerto de ${l.nome} ainda não comprovou o automático. Liberar mesmo assim?`,
        confirmLabel: 'Liberar mesmo assim',
        danger: true,
      }))
    )
      return;
    await api.admin.modoIa(l.setorId, m).catch((e) => avisar(e.message, 'error'));
    void carregar();
  }

  return (
    <Card>
      <CardHeader
        title="Automação por setor"
        subtitle="Sombra: a IA sugere e a recepção confirma com um toque. Automático: a IA encaminha direto. Libere um setor quando o acerto passar de 95% com pelo menos 20 pedidos avaliados (últimos 30 dias)."
      />
      <Table<LinhaAutomacao>
        rowKey="setorId"
        data={linhas ?? []}
        emptyText={linhas === null ? 'Carregando…' : 'Nenhum setor cadastrado.'}
        columns={[
          { key: 'nome', header: 'Setor', primary: true, render: (l: LinhaAutomacao) => <strong>{l.nome}</strong> } as never,
          {
            key: 'modo',
            header: 'Modo',
            secondary: true,
            render: (l: LinhaAutomacao) => (
              <SegmentedControl
                options={[
                  { value: 'sombra', label: 'Sombra' },
                  { value: 'automatico', label: 'Automático' },
                ]}
                value={l.modo}
                onChange={(v) => void mudarModo(l, v as 'sombra' | 'automatico')}
              />
            ),
          } as never,
          { key: 'avaliadas', header: 'Avaliados', align: 'right', mono: true },
          { key: 'acerto', header: 'Acerto', align: 'right', mono: true, render: (l) => pct(l.acerto) },
          { key: 'pendentes', header: 'Aguardando triagem', align: 'right', mono: true, render: (l) => l.pendentes || '—' },
          {
            key: 'recomendacao',
            header: 'Recomendação',
            render: (l) =>
              l.recomendacao === 'pode_liberar' ? (
                <Badge variant="positive" dot>
                  Pode liberar o automático
                </Badge>
              ) : l.recomendacao === 'voltar_sombra' ? (
                <Badge variant="danger" dot>
                  Acerto caiu: voltar para sombra
                </Badge>
              ) : l.faltam > 0 ? (
                <span className="pequeno mudo">Faltam {l.faltam} avaliações</span>
              ) : null,
          },
        ]}
      />
      {confirmacao}
    </Card>
  );
}

function Dispositivo({ unidadeId }: { unidadeId: string }) {
  const [nome, setNome] = useState('Celular Governança');
  const [qr, setQr] = useState<{ img: string; codigo: string; expira: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  async function gerar() {
    setGerando(true);
    try {
      const r = await api.admin.dispositivo(unidadeId, nome);
      const url = `ramais://cadastro?servidor=${encodeURIComponent(API)}&codigo=${encodeURIComponent(r.codigo)}`;
      setQr({ img: await QRCode.toDataURL(url, { margin: 1, width: 240 }), codigo: r.codigo, expira: r.expiraEm });
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setGerando(false);
    }
  }
  return (
    <Card>
      <CardHeader title="Cadastrar celular do setor" subtitle='O QR vale por 30 minutos e uma vez só. No app, toque em "Ler QR de cadastro".' />
      <CardBody>
        <div className="pilha pilha--larga">
          <div className="linha" style={{ alignItems: 'flex-end' }}>
            <div className="espaco" style={{ minWidth: 200 }}>
              <Input label="Nome do aparelho" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <Button iconLeft={<QrCode />} loading={gerando} onClick={gerar}>
              Gerar QR
            </Button>
          </div>
          {qr && (
            <div className="admin-qr">
              <img src={qr.img} alt="QR de cadastro do celular" width={240} height={240} />
              <div style={{ width: '100%' }}>
                <CopyField label="Código de cadastro" value={qr.codigo} hint={`Expira às ${new Date(qr.expira).toLocaleTimeString('pt-BR')}`} />
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Hospedes({ unidadeId }: { unidadeId: string }) {
  const [csv, setCsv] = useState('');
  const [importando, setImportando] = useState(false);
  async function importar() {
    const linhas = csv
      .split(/\r?\n/)
      .map((l) => l.split(/[;,\t]/).map((x) => x.trim()))
      .filter((l) => l.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(l[2]!));
    setImportando(true);
    try {
      const r = await api.admin.hospedes(
        unidadeId,
        linhas.map(([quarto, sobrenome, checkin, checkout]) => ({ quarto: quarto!, sobrenome: sobrenome!, checkin: checkin!, checkout: checkout! })),
      );
      avisar(`${r.importados} importados${r.ignorados.length ? `; quartos desconhecidos: ${r.ignorados.join(', ')}` : ''}`, r.ignorados.length ? 'warning' : 'success');
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setImportando(false);
    }
  }
  return (
    <Card>
      <CardHeader title="Hóspedes ativos" subtitle="Substitui a lista inteira. É o que confirma quarto + sobrenome." />
      <CardBody>
        <div className="pilha pilha--larga">
          <Textarea
            label="Planilha do dia"
            hint="Uma linha por hóspede: quarto;sobrenome;checkin;checkout (datas AAAA-MM-DD)."
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'302;Silva;2026-10-01;2026-10-05\n101;Fernández;2026-10-02;2026-10-04'}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <div className="linha">
            <Button variant="secondary" iconLeft={<Upload />} disabled={!csv.trim()} loading={importando} onClick={importar}>
              Importar
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

type Calib = Awaited<ReturnType<typeof api.admin.calibracao>>;
type Faixa = Calib['faixas'][number];
type Erro = Calib['erros'][number] & { i: number };

function Calibracao({ unidadeId }: { unidadeId: string }) {
  const [r, setR] = useState<Calib | null>(null);
  useEffect(() => {
    api.admin.calibracao(unidadeId).then(setR).catch((e) => avisar(e.message, 'error'));
  }, [unidadeId]);
  if (!r) return <EmptyState loading loadingLabel="Carregando calibração…" size="sm" />;
  const insuficiente = r.limiteSugeridoEncaminhar === null;
  return (
    <>
      <h2 className="admin-titulo">Roteamento nos últimos 7 dias</h2>
      <div className="grade-cartoes">
        <StatCard icon={<Waypoints />} label="Decisões" value={r.total} hint="pedidos que a IA encaminhou" accent="petrol" />
        <StatCard icon={<Target />} label="Acerto" value={pct(r.acuracia)} hint="setor certo na primeira" accent="emerald" />
        <StatCard icon={<Gauge />} label="Separação (AUROC)" value={pct(r.auroc)} hint="a confiança separa acertos de erros? 50% = não separa" accent="petrol" />
        <StatCard
          icon={<ListChecks />}
          label="Limite para encaminhar"
          value={pct(r.limiteSugeridoEncaminhar)}
          hint={insuficiente ? 'dados insuficientes' : 'sugerido para 95% de acerto'}
          accent="amber"
        />
        <StatCard
          icon={<ListChecks />}
          label="Limite de baixa certeza"
          value={pct(r.limiteSugeridoBaixaCerteza)}
          hint={r.limiteSugeridoBaixaCerteza === null ? 'dados insuficientes' : 'sugerido para 80% de acerto'}
          accent="amber"
        />
      </div>

      <Card>
        <CardHeader title="Acerto por faixa de confiança" />
        <Table<Faixa>
          rowKey="de"
          data={r.faixas}
          emptyText="Sem decisões no período."
          columns={[
            { key: 'de', header: 'Confiança', mono: true, render: (f) => `${pct(f.de)}–${pct(f.ate)}` },
            { key: 'n', header: 'Decisões', align: 'right', mono: true },
            { key: 'acuracia', header: 'Acerto', align: 'right', mono: true, render: (f) => pct(f.acuracia) },
          ]}
        />
      </Card>

      {r.erros.length > 0 && (
        <Card>
          <CardHeader title="Correções da equipe" subtitle="Ajuste as descrições do catálogo e rode pnpm eval antes de publicar." />
          <Table<Erro>
            rowKey="i"
            data={r.erros.slice(0, 10).map((e, i) => ({ ...e, i }))}
            columns={[
              { key: 'texto', header: 'Pedido', render: (e) => e.texto ?? <span className="mudo">sem texto</span> },
              { key: 'previsto', header: 'A IA disse', render: (e) => <Tag>{e.previsto}</Tag> },
              {
                key: 'correto',
                header: 'Era',
                render: (e) => (
                  <Tag family="emerald" treatment="outline">
                    {e.correto}
                  </Tag>
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
