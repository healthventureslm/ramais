import {
  Avatar,
  BarChart,
  Card,
  CardBody,
  CardHeader,
  DonutChart,
  EmptyState,
  LineChart,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  StatCard,
  Table,
} from '@healthventureslm/design-system';
import { BellRing, CheckCircle2, CircleDollarSign, Inbox, Sparkles, Star, Timer, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type NumerosPeriodo, type Relatorio as Dados } from '../api';
import { avisar } from '../componentes/Avisos';
import { NomeIdioma } from '../util';
import '../estilo/admin.css';

/** Segundos em texto: "45 s", "3 min", "1 h 20 min". */
export function duracao(s: number | null): string {
  if (s === null) return '—';
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** Tendência do StatCard do DS (o tipo não é exportado). */
interface StatTrend {
  value: string;
  direction?: 'up' | 'down' | 'flat';
  positive?: boolean;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Dólar: centavos de dólar viram 4 casas (o custo por pedido é pequeno). */
function usd(v: number | null): string {
  if (v === null) return '—';
  const casas = v !== 0 && Math.abs(v) < 1 ? 4 : 2;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

/**
 * Comparação com o período anterior. `menorMelhor`: tempo e custo, que melhoram caindo.
 * Sem base anterior, não mostra tendência (não inventa "+100%").
 */
function variacao(atual: number | null, anterior: number | null, menorMelhor = false): StatTrend | undefined {
  if (atual === null || anterior === null || anterior === 0) return undefined;
  const d = (atual - anterior) / anterior;
  if (Math.abs(d) < 0.005) return { value: 'igual ao período anterior', direction: 'flat' };
  const subiu = d > 0;
  return {
    value: `${subiu ? '+' : '−'}${Math.round(Math.abs(d) * 100)}% vs. anterior`,
    direction: subiu ? 'up' : 'down',
    positive: menorMelhor ? !subiu : subiu,
  };
}

const proporcao = (n: NumerosPeriodo, campo: 'pelaIa' | 'resolvidos' | 'escalados') => (n.pedidos ? n[campo] / n.pedidos : null);

const TAREFA: Record<string, string> = {
  decisoes: 'Roteamento (Jev)',
  respostas: 'Roteamento',
  traducao: 'Tradução',
  traducoes: 'Tela do chat em outro idioma',
  transcricao: 'Transcrição de áudio',
  descricao: 'Descrição de foto',
  resposta: 'Resposta pela base de conhecimento',
  chat: 'Outras',
};

type LinhaSetor = Dados['setores'][number];
type LinhaPessoa = Dados['pessoas'][number];
type LinhaTarefa = Dados['custo']['porTarefa'][number];

const nota = (v: number | null) => (v === null ? <span className="mudo">—</span> : v.toFixed(1).replace('.', ','));

/**
 * Dashboard da unidade, para gerência e administração: volume, rapidez, satisfação, quem atende,
 * a escada de escalonamento, o que a IA resolveu e quanto a IA custou. Tudo comparado com o
 * período anterior do mesmo tamanho. Conversas do simulador não entram.
 */
export function Dashboard({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome: string }) {
  const [dias, setDias] = useState(7);
  const [r, setR] = useState<Dados | null>(null);

  useEffect(() => {
    setR(null);
    api.admin
      .relatorio(unidadeId, dias)
      .then(setR)
      .catch((e) => avisar(e.message, 'error'));
  }, [unidadeId, dias]);

  return (
    <div className="rolagem">
      <div className="pagina">
        <PageHeader title="Dashboard" subtitle={`Como ${unidadeNome} está atendendo: rapidez, satisfação, equipe, IA e custo.`} />
        <div className="admin-barra">
          <SegmentedControl
            options={[
              { value: '1', label: 'Hoje' },
              { value: '7', label: '7 dias' },
              { value: '30', label: '30 dias' },
              { value: '90', label: '90 dias' },
            ]}
            value={String(dias)}
            onChange={(v) => setDias(Number(v))}
          />
          <span className="pequeno mudo">
            {dias === 1 ? 'Últimas 24 h' : `Últimos ${dias} dias`}, comparado com o período anterior. Conversas do simulador não entram.
          </span>
        </div>
        {!r ? <EmptyState loading /> : <Conteudo r={r} />}
      </div>
    </div>
  );
}

function Conteudo({ r }: { r: Dados }) {
  const g = r.geral;
  const a = r.anterior;
  const diaCurto = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const totalIdiomas = r.idiomas.reduce((s, i) => s + i.n, 0);
  const triagem = r.ia.triagemConfirmadas + r.ia.triagemCorrigidas;

  return (
    <>
      <div className="grade-cartoes">
        <StatCard
          icon={<Inbox />}
          label="Pedidos de hóspedes"
          value={g.pedidos}
          hint={g.abertos ? `${g.abertos} em aberto agora` : 'nenhum em aberto'}
          trend={variacao(g.pedidos, a.pedidos)}
          sparklineData={r.porDia.length > 1 ? r.porDia.map((d) => d.n) : undefined}
          accent="petrol"
        />
        <StatCard
          icon={<Timer />}
          label="1ª resposta (mediana)"
          value={duracao(g.primeiraRespostaP50)}
          hint={g.primeiraRespostaP90 !== null ? `9 em cada 10 até ${duracao(g.primeiraRespostaP90)}` : undefined}
          trend={variacao(g.primeiraRespostaP50, a.primeiraRespostaP50, true)}
          accent="petrol"
        />
        <StatCard
          icon={<CheckCircle2 />}
          label="Resolvidos"
          value={pct(g.resolvidos, g.pedidos)}
          hint={g.resolucaoP50 !== null ? `em ${duracao(g.resolucaoP50)} (mediana)` : `${g.resolvidos} pedidos`}
          trend={variacao(proporcao(g, 'resolvidos'), proporcao(a, 'resolvidos'))}
          accent="emerald"
        />
        <StatCard
          icon={<Star />}
          label="Nota dos hóspedes"
          value={r.pesquisa.media !== null ? r.pesquisa.media.toFixed(1).replace('.', ',') : '—'}
          hint={r.pesquisa.respostas ? `de 5 · ${r.pesquisa.respostas} respostas` : 'sem respostas ainda'}
          accent="amber"
        />
        <StatCard
          icon={<Sparkles />}
          label="Resolvidos pela IA"
          value={pct(g.pelaIa, g.pedidos)}
          hint={`${g.pelaIa} sem precisar da equipe`}
          trend={variacao(proporcao(g, 'pelaIa'), proporcao(a, 'pelaIa'))}
          accent="emerald"
        />
        <StatCard
          icon={<BellRing />}
          label="Escalados à supervisão"
          value={pct(g.escalados, g.pedidos)}
          hint={`${g.escalados} pedidos · ${r.escada.repassadas} passados adiante`}
          trend={variacao(proporcao(g, 'escalados'), proporcao(a, 'escalados'), true)}
          accent={g.escalados > 0 ? 'crimson' : 'emerald'}
        />
        <StatCard
          icon={<CircleDollarSign />}
          label="Custo da IA"
          value={usd(r.custo.totalUsd)}
          hint={r.custo.porPedidoUsd !== null ? `${usd(r.custo.porPedidoUsd)} por pedido · ${r.custo.chamadas} chamadas` : `${r.custo.chamadas} chamadas`}
          trend={variacao(r.custo.totalUsd, a.custoIaUsd, true)}
          accent="petrol"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Aceite de oferta (mediana)"
          value={duracao(g.aceiteP50)}
          hint={g.ofertas ? `${pct(g.ofertasExpiradas, g.ofertas)} expiraram · ${g.ofertasRecusadas} recusadas` : 'sem ofertas'}
          accent="petrol"
        />
      </div>

      <div className="admin-colunas">
        <Card>
          <CardHeader title="Pedidos por dia" subtitle="Por canal" />
          <CardBody>
            {r.porDia.every((d) => d.n === 0) ? (
              <EmptyState size="sm" title="Sem pedidos no período." />
            ) : r.porDia.length === 1 ? (
              <BarChart
                height={220}
                data={[
                  { label: 'WhatsApp', value: r.porDia[0]!.whatsapp },
                  { label: 'Chat do quarto', value: r.porDia[0]!.web },
                ]}
                formatValue={(v) => String(Math.round(v))}
              />
            ) : (
              <LineChart
                height={220}
                legend
                labels={r.porDia.map((d) => diaCurto(d.dia))}
                series={[
                  { name: 'WhatsApp', data: r.porDia.map((d) => d.whatsapp) },
                  { name: 'Chat do quarto', data: r.porDia.map((d) => d.web) },
                ]}
                formatValue={(v) => String(Math.round(v))}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pedidos por hora do dia" subtitle="Quando a equipe precisa de mais gente" />
          <CardBody>
            {r.porHora.every((h) => h.n === 0) ? (
              <EmptyState size="sm" title="Sem pedidos no período." />
            ) : (
              <BarChart
                height={220}
                aria-label={r.porHora.map((h) => `${h.hora}h: ${h.n}`).join(', ')}
                data={r.porHora.map((h) => ({ label: h.hora % 3 === 0 ? `${h.hora}h` : '', value: h.n }))}
                formatValue={(v) => String(Math.round(v))}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Por setor" subtitle="Rapidez e escalonamento de cada setor" />
        <Table<LinhaSetor>
          rowKey="nome"
          data={r.setores}
          emptyText="Sem pedidos no período."
          columns={[
            { key: 'nome', header: 'Setor', primary: true, render: (s: LinhaSetor) => <strong>{s.nome}</strong> } as never,
            { key: 'pedidos', header: 'Pedidos', align: 'right', mono: true },
            {
              key: 'primeira',
              header: '1ª resposta (mediana · 90%)',
              align: 'right',
              mono: true,
              render: (s) => (
                <span title="mediana · 9 em cada 10">
                  {duracao(s.primeiraRespostaP50)}
                  {s.primeiraRespostaP90 !== null && <span className="mudo"> · {duracao(s.primeiraRespostaP90)}</span>}
                </span>
              ),
            },
            { key: 'resolucao', header: 'Resolvido em', align: 'right', mono: true, render: (s) => duracao(s.resolucaoP50) },
            { key: 'resolvidos', header: 'Resolvidos', align: 'right', mono: true, render: (s) => pct(s.resolvidos, s.pedidos) },
            {
              key: 'escalados',
              header: 'Escalados',
              align: 'right',
              mono: true,
              render: (s) => (s.escalados ? <span style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{pct(s.escalados, s.pedidos)}</span> : <span className="mudo">—</span>),
            },
            { key: 'nota', header: 'Nota', align: 'right', mono: true, render: (s) => nota(s.nota) },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Equipe" subtitle="Quem ficou com cada pedido, quanto respondeu e com que rapidez" />
        <Table<LinhaPessoa>
          rowKey="id"
          data={r.pessoas}
          emptyText="Ninguém atendeu no período."
          columns={[
            {
              key: 'nome',
              header: 'Pessoa',
              primary: true,
              render: (p: LinhaPessoa) => (
                <span className="linha" style={{ flexWrap: 'nowrap' }}>
                  <Avatar name={p.nome} size="xs" />
                  <strong>{p.nome}</strong>
                </span>
              ),
            } as never,
            { key: 'atendimentos', header: 'Atendimentos', align: 'right', mono: true },
            { key: 'respostas', header: 'Respostas', align: 'right', mono: true },
            { key: 'resolvidos', header: 'Resolvidos', align: 'right', mono: true, render: (p) => pct(p.resolvidos, p.atendimentos) },
            { key: 'primeira', header: '1ª resposta', align: 'right', mono: true, render: (p) => duracao(p.primeiraRespostaP50) },
            { key: 'assumidos', header: 'Assumiu', align: 'right', mono: true, render: (p) => p.assumidos || <span className="mudo">—</span> },
            { key: 'nota', header: 'Nota', align: 'right', mono: true, render: (p) => nota(p.nota) },
          ]}
        />
      </Card>

      <div className="admin-colunas">
        <Card>
          <CardHeader title="Por onde chegam" subtitle={`${r.mensagens.doHospede} mensagens de hóspedes`} />
          <CardBody>
            <div className="dash-roscas">
              <DonutChart
                size={150}
                legend
                centerLabel="pedidos"
                centerValue={r.canais.whatsapp + r.canais.web}
                data={[
                  { label: 'WhatsApp', value: r.canais.whatsapp },
                  { label: 'Chat do quarto', value: r.canais.web },
                ]}
              />
              <DonutChart
                size={150}
                legend
                centerLabel="mensagens"
                centerValue={r.mensagens.doHospede}
                data={[
                  { label: 'Texto', value: r.mensagens.texto },
                  { label: 'Áudio', value: r.mensagens.audio },
                  { label: 'Foto', value: r.mensagens.foto },
                ]}
              />
            </div>
            <dl className="pares">
              <dt>Respostas da equipe</dt>
              <dd className="dado">{r.mensagens.daEquipe}</dd>
              <dt>Mensagens automáticas</dt>
              <dd className="dado">{r.mensagens.automaticas}</dd>
              <dt>Notas internas</dt>
              <dd className="dado">{r.mensagens.notas}</dd>
              {r.mensagens.falharam > 0 && (
                <>
                  <dt>Não entregues</dt>
                  <dd className="dado" style={{ color: 'var(--danger-fg)' }}>
                    {r.mensagens.falharam}
                  </dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Idiomas" subtitle={r.idiomas.length ? `${r.idiomas.length} idiomas no período` : undefined} />
          <CardBody>
            {r.idiomas.length === 0 ? (
              <EmptyState size="sm" title="Sem pedidos no período." />
            ) : (
              <div className="pilha">
                {r.idiomas.slice(0, 8).map((i) => (
                  <ProgressBar
                    key={i.idioma ?? '?'}
                    label={i.idioma ? NomeIdioma(i.idioma) : 'Não identificado'}
                    value={i.n}
                    max={totalIdiomas}
                    showValue
                    valueFormat={(v) => (
                      <span className="dado">
                        {v} ({pct(v, totalIdiomas)})
                      </span>
                    )}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="admin-colunas">
        <Card>
          <CardHeader title="Escada e ofertas" subtitle="O que precisou de empurrão" />
          <CardBody>
            <dl className="pares">
              <dt>Avisos à supervisão</dt>
              <dd className="dado">{r.escada.avisos}</dd>
              <dt>Lembretes ao responsável</dt>
              <dd className="dado">{r.escada.lembretes}</dd>
              <dt>Passados adiante por falta de resposta</dt>
              <dd className="dado">{r.escada.repassadas}</dd>
              <dt>Assumidos pela supervisão</dt>
              <dd className="dado">{r.escada.assumidas}</dd>
              <dt>Transferidos de setor</dt>
              <dd className="dado">{r.escada.transferidas}</dd>
              <dt>Ofertas expiradas</dt>
              <dd className="dado">
                {g.ofertasExpiradas} <span className="pequeno mudo">de {g.ofertas}</span>
              </dd>
              <dt>Emergências</dt>
              <dd className="dado" style={r.escada.emergencias ? { color: 'var(--danger-fg)', fontWeight: 600 } : undefined}>
                {r.escada.emergencias}
              </dd>
              {g.apoios > 0 && (
                <>
                  <dt>Pedidos de apoio entre setores</dt>
                  <dd className="dado">{g.apoios}</dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pesquisa de satisfação" subtitle={r.pesquisa.respostas ? `${r.pesquisa.respostas} respostas` : undefined} />
          <CardBody>
            {r.pesquisa.respostas === 0 ? (
              <EmptyState size="sm" title="Nenhuma resposta no período." />
            ) : (
              <div className="pilha">
                {[...r.pesquisa.distribuicao].reverse().map((d) => (
                  <ProgressBar
                    key={d.nota}
                    label={`Nota ${d.nota}`}
                    value={d.n}
                    max={r.pesquisa.respostas}
                    showValue
                    valueFormat={(v) => (
                      <span className="dado">
                        {v} ({pct(v, r.pesquisa.respostas)})
                      </span>
                    )}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Inteligência artificial"
          subtitle={`Encaminhou com certeza ${pct(r.ia.comCerteza, r.ia.decisoes)} dos pedidos${
            r.ia.confiancaMedia !== null ? ` · confiança média ${Math.round(r.ia.confiancaMedia * 100)}%` : ''
          }${triagem ? ` · triagem confirmou ${pct(r.ia.triagemConfirmadas, triagem)} das sugestões` : ''}`}
        />
        <Table<LinhaTarefa>
          rowKey="tarefa"
          data={r.custo.porTarefa}
          emptyText="Nenhuma chamada à IA no período."
          columns={[
            { key: 'tarefa', header: 'Tarefa', primary: true, render: (t: LinhaTarefa) => <strong>{TAREFA[t.tarefa] ?? t.tarefa}</strong> } as never,
            { key: 'chamadas', header: 'Chamadas', align: 'right', mono: true },
            {
              key: 'falhas',
              header: 'Falhas',
              align: 'right',
              mono: true,
              render: (t) => (t.falhas ? <span style={{ color: 'var(--danger-fg)' }}>{t.falhas}</span> : <span className="mudo">—</span>),
            },
            { key: 'tokens', header: 'Tokens', align: 'right', mono: true, render: (t) => t.tokens.toLocaleString('pt-BR') },
            { key: 'latencia', header: 'Tempo médio', align: 'right', mono: true, render: (t) => (t.latenciaMs === null ? '—' : `${(t.latenciaMs / 1000).toFixed(1).replace('.', ',')} s`) },
            { key: 'usd', header: 'Custo', align: 'right', mono: true, render: (t) => usd(t.usd) },
          ]}
        />
        {r.custo.porModelo.length > 0 && (
          <CardBody>
            <dl className="pares">
              {r.custo.porModelo.map((m) => (
                <div key={m.modelo} style={{ display: 'contents' }}>
                  <dt className="dado">{m.modelo}</dt>
                  <dd>
                    <span className="dado">{usd(m.usd)}</span> <span className="pequeno mudo">· {m.chamadas} chamadas</span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        )}
      </Card>

      {r.porDia.length > 1 && r.porDia.some((d) => d.custo > 0) && (
        <Card>
          <CardHeader title="Custo da IA por dia" />
          <CardBody>
            <BarChart height={180} data={r.porDia.map((d) => ({ label: diaCurto(d.dia), value: d.custo }))} formatValue={usd} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
