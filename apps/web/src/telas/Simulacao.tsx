import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader, Select, Slider, StatCard, Table, useViewport } from '@healthventureslm/design-system';
import { BadgeCheck, CircleDollarSign, MessageCircle, MessagesSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type UsoMes } from '../api';
import '../estilo/simulacao.css';

/**
 * Premissas medidas nos testes de carga de 06/10/2026 e a tabela da Meta no Brasil (outubro de 2026).
 * "Mensagem" é a enviada pelo hóspede; "pedido" é uma conversa de atendimento.
 */
const P = { msgPorPedido: 2.31, saiPorPedido: 4.29, foraJanela: 0.03, meta: 0.035, gratis: 1000, infraTotal: 690, excedente: 0.06 };
const IA_ATUAL = 0.000191;
const IA_ANTERIOR = 0.000488;
/** Hotel típico das tabelas e dos planos: 70% de ocupação, meio pedido por quarto ocupado por dia, 20 hotéis na infraestrutura. */
const TIPICO = { ocupacao: 0.7, pedidos: 0.5, hoteis: 20 };

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
const usd = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: v && v < 1 ? 4 : 2, maximumFractionDigits: v && v < 1 ? 4 : 2 });
const n = (v: number) => Math.round(v).toLocaleString('pt-BR');
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dec = (v: number, casas = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
/** Campo numérico: aceita vírgula ou ponto. */
const lerNumero = (s: string) => Number(s.replace(',', '.'));

interface Custos {
  msgs: number;
  pedidos: number;
  /** Mensagens do hotel pelo WhatsApp. */
  sai: number;
  ia: number;
  iaAnterior: number;
  /** Meta, cenário 1: só o modelo fora da janela de 24 h. */
  wa1: number;
  /** Meta, cenário 2: resposta cobrada acima de 1.000 por mês, mais o modelo. */
  wa2: number;
}

function custos({ msgs, pedidos, iaUsd = IA_ATUAL, dolar = 5.5, fracWhats = 1 }: { msgs?: number; pedidos?: number; iaUsd?: number; dolar?: number; fracWhats?: number }): Custos {
  const ped = pedidos ?? (msgs ?? 0) / P.msgPorPedido;
  const m = msgs ?? ped * P.msgPorPedido;
  const pedWhats = ped * fracWhats;
  const sai = pedWhats * P.saiPorPedido;
  const tpl = pedWhats * P.foraJanela * P.meta;
  return {
    msgs: m,
    pedidos: ped,
    sai,
    ia: m * iaUsd * dolar,
    iaAnterior: m * IA_ANTERIOR * dolar,
    wa1: tpl,
    wa2: Math.max(0, sai - P.gratis) * P.meta + tpl,
  };
}

const sugerido = (q: number) => (q <= 40 ? 290 : q <= 120 ? 690 : q <= 250 ? 1490 : q <= 500 ? 2690 : Math.round((q * 6.5) / 10) * 10);

const PLANOS = [
  { nome: 'Pousada', faixa: 'até 40 quartos', ate: 40, ref: 30, preco: 290, franquia: 1500 },
  { nome: 'Hotel', faixa: '41 a 120 quartos', ate: 120, ref: 100, preco: 690, franquia: 5000 },
  { nome: 'Hotel Plus', faixa: '121 a 250 quartos', ate: 250, ref: 250, preco: 1490, franquia: 12000 },
  { nome: 'Resort', faixa: '251 a 500 quartos', ate: 500, ref: 400, preco: 2690, franquia: 20000 },
];

const pedidosTipicos = (quartos: number) => quartos * TIPICO.ocupacao * TIPICO.pedidos * 30;

type LinhaHotel = Custos & { q: number };
type LinhaVolume = Custos & { id: number };

/** Uso real do mês, por canal, e a projeção para o mês inteiro no mesmo ritmo. */
function resumoReal(u: UsoMes) {
  const pedidos = u.pedidos.whatsapp + u.pedidos.web;
  const hospede = u.mensagensHospede.whatsapp + u.mensagensHospede.web;
  const hotel = u.mensagensHotel.whatsapp + u.mensagensHotel.web;
  // No primeiro dia do mês a projeção explode: conta pelo menos um dia inteiro.
  const dias = Math.max(1, u.diasDecorridos);
  const fator = u.diasNoMes / dias;
  return {
    pedidos,
    hospede,
    hotel,
    dias,
    fator,
    fracWhats: pedidos ? u.pedidos.whatsapp / pedidos : null,
    iaPorMsg: hospede && u.iaUsd > 0 ? u.iaUsd / hospede : null,
    hospedePorPedido: pedidos ? hospede / pedidos : null,
    hotelPorPedido: pedidos ? hotel / pedidos : null,
  };
}

/**
 * Simulação de preço e margem do Ramais, para gerência e administração: quanto custa atender um hotel
 * (IA, mensagens da Meta e infraestrutura) e a margem de um plano, ao lado do uso real deste mês.
 */
export function Simulacao({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome: string }) {
  const [quartos, setQuartos] = useState('150');
  const [ocupacao, setOcupacao] = useState(70);
  const [pedidosDia, setPedidosDia] = useState('0.5');
  const [whats, setWhats] = useState(60);
  const [cenario, setCenario] = useState('2');
  const [ia, setIa] = useState(String(IA_ATUAL));
  // null: segue a sugestão para o número de quartos, até alguém digitar um preço.
  const [preco, setPreco] = useState<string | null>(null);
  const [dolarTxt, setDolarTxt] = useState('5.5');
  const [hoteisTxt, setHoteisTxt] = useState('20');
  const [uso, setUso] = useState<UsoMes | null | 'erro'>(null);
  // No celular a tabela do DS vira cartões e a 2ª coluna perde o rótulo: o número leva a unidade junto.
  const { isMobile } = useViewport();

  useEffect(() => {
    setUso(null);
    api.admin
      .usoMes(unidadeId)
      .then(setUso)
      .catch(() => setUso('erro'));
  }, [unidadeId]);

  const real = uso && uso !== 'erro' ? resumoReal(uso) : null;

  const q = Math.max(1, Math.round(lerNumero(quartos)) || 1);
  const ocup = ocupacao / 100;
  const ped = Math.max(0, lerNumero(pedidosDia) || 0);
  const fracWhats = whats / 100;
  const iaUsd = ia === 'real' && real?.iaPorMsg ? real.iaPorMsg : Number(ia === 'real' ? IA_ATUAL : ia);
  const dolar = Math.max(1, lerNumero(dolarTxt) || 5.5);
  const hoteis = Math.max(1, Math.round(lerNumero(hoteisTxt)) || 1);
  const precoNum = Math.max(0, preco === null ? sugerido(q) : lerNumero(preco) || 0);

  const pedidos = q * ocup * ped * 30;
  const c = custos({ pedidos, iaUsd, dolar, fracWhats });
  const meta = cenario === '2' ? c.wa2 : c.wa1;
  const infra = P.infraTotal / hoteis;
  const total = c.ia + meta + infra;
  const margem = precoNum ? 1 - total / precoNum : 0;
  const boa = margem >= 0.5;

  function usarReal() {
    if (!uso || uso === 'erro' || !real || !real.pedidos) return;
    const quartosReais = uso.quartos > 0 ? uso.quartos : q;
    if (uso.quartos > 0) setQuartos(String(uso.quartos));
    const porQuarto = real.pedidos / real.dias / Math.max(1, quartosReais * ocup);
    setPedidosDia(String(Math.min(5, Math.max(0.01, Math.round(porQuarto * 100) / 100))));
    if (real.fracWhats !== null) setWhats(Math.round(real.fracWhats * 100));
    if (real.iaPorMsg !== null) setIa('real');
  }

  const opcoesIa = [
    { value: String(IA_ATUAL), label: 'Atuais (Gemini 2.5 Flash Lite)' },
    { value: String(IA_ANTERIOR), label: 'Anteriores (Gemini 3.1/3.5 Flash Lite)' },
    ...(real?.iaPorMsg ? [{ value: 'real', label: `Medido nesta unidade (${usd(real.iaPorMsg)}/mensagem)` }] : []),
  ];

  const infraTipica = P.infraTotal / TIPICO.hoteis;
  const hotel: LinhaHotel[] = [30, 60, 100, 150, 250, 400].map((x) => ({ q: x, ...custos({ pedidos: pedidosTipicos(x) }) }));
  const volume: LinhaVolume[] = [1000, 5000, 10000, 60000].map((m) => ({ id: m, ...custos({ msgs: m }) }));

  return (
    <div className="rolagem">
      <div className="pagina">
        <PageHeader
          title="Simulação"
          subtitle="Quanto custa atender um hotel (IA, mensagens da Meta e infraestrutura) e a margem de cada preço, ao lado do uso real deste mês."
        />

        <div className="sim-topo">
          <Card>
            <CardHeader title="Hotel simulado" subtitle="Os resultados mudam enquanto você digita." />
            <CardBody>
              <div className="sim-campos">
                <Input label="Quartos" type="number" inputMode="numeric" min={1} max={5000} value={quartos} onChange={(e) => setQuartos(e.target.value)} />
                <Slider label="Ocupação" min={10} max={100} value={ocupacao} onChange={setOcupacao} suffix="%" />
                <Input
                  label="Pedidos por quarto ocupado por dia"
                  type="number"
                  inputMode="decimal"
                  min={0.05}
                  max={5}
                  step={0.05}
                  value={pedidosDia}
                  onChange={(e) => setPedidosDia(e.target.value)}
                  hint="0,5 = um pedido a cada dois dias por quarto ocupado."
                />
                <Slider label="Pedidos pelo WhatsApp" min={0} max={100} value={whats} onChange={setWhats} suffix="%" />
                <span className="pequeno mudo sim-ajuda">O resto chega pelo chat do quarto, sem custo da Meta.</span>
                <Select
                  label="Cobrança da Meta"
                  value={cenario}
                  onChange={setCenario}
                  options={[
                    { value: '2', label: 'Cenário 2: resposta cobrada acima de 1.000/mês' },
                    { value: '1', label: 'Cenário 1: respostas na janela grátis' },
                  ]}
                />
                <Select label="Modelos de IA" value={ia} onChange={setIa} options={opcoesIa} />
                <div className="sim-campo">
                  <Input
                    label="Preço do plano (R$/mês)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={10}
                    value={preco ?? String(sugerido(q))}
                    onChange={(e) => setPreco(e.target.value)}
                    hint={`Sugestão para ${n(q)} quartos: ${brl(sugerido(q), 0)}`}
                  />
                  {preco !== null && Number(preco) !== sugerido(q) && (
                    <Button size="sm" variant="ghost" onClick={() => setPreco(null)}>
                      Voltar à sugestão
                    </Button>
                  )}
                </div>
                <Input label="Dólar (R$)" type="number" inputMode="decimal" min={1} step={0.05} value={dolarTxt} onChange={(e) => setDolarTxt(e.target.value)} />
                <Input
                  label="Hotéis dividindo a infraestrutura"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={hoteisTxt}
                  onChange={(e) => setHoteisTxt(e.target.value)}
                  hint={`Infraestrutura estimada em ${brl(P.infraTotal, 0)}/mês no total.`}
                />
              </div>
            </CardBody>
          </Card>

          <Card aria-live="polite">
            <CardHeader title="Resultado por mês" subtitle={`${n(q)} quartos · ${ocupacao}% de ocupação`} />
            <CardBody>
              <div className="sim-resultado">
                <dl className="pares sim-pares">
                  <dt>Pedidos</dt>
                  <dd className="dado">{n(pedidos)}</dd>
                  <dt>Mensagens de hóspedes</dt>
                  <dd className="dado">{n(c.msgs)}</dd>
                  <dt>Mensagens do hotel pelo WhatsApp</dt>
                  <dd className="dado">{n(c.sai)}</dd>
                  <dt>IA</dt>
                  <dd className="dado">{brl(c.ia)}</dd>
                  <dt>Meta (WhatsApp)</dt>
                  <dd className="dado">{brl(meta)}</dd>
                  <dt>Infraestrutura rateada</dt>
                  <dd className="dado">{brl(infra)}</dd>
                  <dt className="sim-total">Custo total</dt>
                  <dd className="dado sim-total">{brl(total)}</dd>
                  <dt>Custo por pedido</dt>
                  <dd className="dado">{brl(pedidos ? total / pedidos : 0, 3)}</dd>
                  <dt>Preço</dt>
                  <dd className="dado">{brl(precoNum)}</dd>
                </dl>
                <div className="sim-margem-bloco">
                  <span className="pequeno mudo">Margem bruta</span>
                  <div className="linha">
                    <span className={`sim-margem ${boa ? 'sim-margem--boa' : 'sim-margem--ruim'}`}>{pct(margem)}</span>
                    <Badge variant={boa ? 'positive' : 'danger'}>{boa ? 'Saudável' : 'Abaixo de 50%'}</Badge>
                  </div>
                  <span className="pequeno mudo">
                    {boa ? 'Margem saudável para SaaS.' : 'Abaixo de 50%: suba o preço ou reduza a franquia de WhatsApp.'}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Uso real deste mês"
              subtitle={
                uso && uso !== 'erro'
                  ? `${unidadeNome} · ${dec(uso.diasDecorridos, 1)} de ${uso.diasNoMes} dias`
                  : unidadeNome
              }
            />
            <CardBody>
              {uso === null ? (
                <EmptyState size="sm" loading />
              ) : uso === 'erro' || !real ? (
                <EmptyState size="sm" title="Não deu para carregar o uso do mês." description="Tente abrir a tela de novo em instantes." />
              ) : (
                <div className="sim-resultado">
                  <dl className="pares sim-pares">
                    <dt>Pedidos</dt>
                    <dd className="dado">{n(real.pedidos)}</dd>
                    <dt>Pelo WhatsApp · chat do quarto</dt>
                    <dd className="dado">
                      {n(uso.pedidos.whatsapp)} · {n(uso.pedidos.web)}
                    </dd>
                    <dt>Mensagens de hóspedes</dt>
                    <dd className="dado">{n(real.hospede)}</dd>
                    <dt>Mensagens do hotel</dt>
                    <dd className="dado">{n(real.hotel)}</dd>
                    <dt>Do hotel pelo WhatsApp</dt>
                    <dd className="dado">{n(uso.mensagensHotel.whatsapp)}</dd>
                    <dt>Custo da IA</dt>
                    <dd className="dado">
                      {usd(uso.iaUsd)} <span className="mudo">· {brl(uso.iaUsd * dolar)}</span>
                    </dd>
                    <dt>Quartos cadastrados</dt>
                    <dd className="dado">{n(uso.quartos)}</dd>
                  </dl>
                  {real.pedidos > 0 ? (
                    <>
                      <dl className="pares sim-pares sim-separador">
                        <dt>Projeção do mês: pedidos</dt>
                        <dd className="dado">{n(real.pedidos * real.fator)}</dd>
                        <dt>Projeção: mensagens de hóspedes</dt>
                        <dd className="dado">{n(real.hospede * real.fator)}</dd>
                        <dt>Projeção: do hotel pelo WhatsApp</dt>
                        <dd className="dado">{n(uso.mensagensHotel.whatsapp * real.fator)}</dd>
                        <dt>Mensagens de hóspedes por pedido</dt>
                        <dd className="dado">
                          {dec(real.hospedePorPedido ?? 0)} <span className="mudo">· simulado {dec(P.msgPorPedido)}</span>
                        </dd>
                        <dt>Mensagens do hotel por pedido</dt>
                        <dd className="dado">
                          {dec(real.hotelPorPedido ?? 0)} <span className="mudo">· simulado {dec(P.saiPorPedido)}</span>
                        </dd>
                      </dl>
                      <div className="sim-campo">
                        <Button size="sm" variant="secondary" onClick={usarReal}>
                          Usar no simulador
                        </Button>
                        <span className="pequeno mudo">
                          Preenche {uso.quartos > 0 ? 'quartos, ' : ''}pedidos por quarto ocupado, a parte do WhatsApp
                          {real.iaPorMsg ? ' e o custo de IA medido' : ''}. A ocupação continua a informada: o Ramais não sabe quantos quartos estão
                          ocupados.
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="pequeno mudo">Nenhum pedido de hóspede neste mês ainda. Conversas do simulador não entram.</span>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <section className="sim-secao" aria-labelledby="sim-planos">
          <h2 id="sim-planos" className="sim-titulo">
            Planos simulados
          </h2>
          <p className="sim-texto">
            Preço fixo por faixa de quartos, usuários ilimitados, chat do quarto e IA inclusos. Margem calculada no hotel de referência de cada faixa, já com a
            infraestrutura rateada. No cenário 2, a franquia de WhatsApp de cada plano cobre o uso típico; o excedente é repassado a {brl(P.excedente)} por
            mensagem.
          </p>
          <div className="sim-planos">
            {PLANOS.map((pl, i) => {
              const cp = custos({ pedidos: pedidosTipicos(pl.ref) });
              const web = cp.ia + infraTipica;
              const c1 = cp.ia + cp.wa1 + infraTipica;
              const c2 = cp.ia + cp.wa2 + infraTipica;
              const daFaixa = q <= pl.ate && (i === 0 || q > PLANOS[i - 1]!.ate);
              return (
                <Card key={pl.nome} accent={daFaixa}>
                  <CardHeader title={pl.nome} subtitle={pl.faixa} action={daFaixa ? <Badge variant="brand">Faixa simulada</Badge> : undefined} />
                  <CardBody>
                    <div className="sim-plano">
                      <div>
                        <span className="sim-preco">{brl(pl.preco, 0)}</span> <span className="pequeno mudo">/mês</span>
                      </div>
                      <span className="pequeno mudo">
                        <span className="dado">{brl(pl.preco / pl.ref)}</span> por quarto no hotel de referência ({pl.ref} quartos)
                      </span>
                      <ul className="sim-lista">
                        <li>WhatsApp e chat do quarto</li>
                        <li>IA em qualquer idioma, áudio e foto</li>
                        <li>
                          Franquia de <span className="dado">{n(pl.franquia)}</span> mensagens de WhatsApp/mês
                        </li>
                        <li>
                          Uso típico: <span className="dado">{n(cp.sai)}</span> mensagens do hotel
                        </li>
                      </ul>
                      <dl className="pares sim-pares sim-separador">
                        <dt>Só chat do quarto</dt>
                        <dd className="dado">
                          {brl(web)} · {pct(1 - web / pl.preco)}
                        </dd>
                        <dt>WhatsApp, cenário 1</dt>
                        <dd className="dado">
                          {brl(c1)} · {pct(1 - c1 / pl.preco)}
                        </dd>
                        <dt>WhatsApp, cenário 2</dt>
                        <dd className="dado">
                          {brl(c2)} · {pct(1 - c2 / pl.preco)}
                        </dd>
                      </dl>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
          <span className="pequeno mudo">Custo do mês e margem bruta, com 70% de ocupação e meio pedido por quarto ocupado por dia.</span>
        </section>

        <Card>
          <CardHeader title="Por tamanho de hotel" subtitle="Por mês, com 70% de ocupação e 0,5 pedido por quarto ocupado por dia" />
          <div className="sim-tabela">
            <Table<LinhaHotel>
              rowKey="q"
              data={hotel}
              columns={[
                { key: 'q', header: 'Hotel', render: (h) => <strong>{h.q} quartos</strong> },
                { key: 'pedidos', header: 'Pedidos', align: 'right', mono: true, render: (h) => (isMobile ? `${n(h.pedidos)} pedidos por mês` : n(h.pedidos)) },
                { key: 'msgs', header: 'Mensagens de hóspedes', align: 'right', mono: true, render: (h) => n(h.msgs) },
                { key: 'ia', header: 'IA', align: 'right', mono: true, render: (h) => brl(h.ia) },
                { key: 'wa1', header: 'WhatsApp cenário 1', align: 'right', mono: true, render: (h) => brl(h.wa1) },
                { key: 'wa2', header: 'WhatsApp cenário 2', align: 'right', mono: true, render: (h) => brl(h.wa2) },
                { key: 'chat', header: 'Só chat do quarto', align: 'right', mono: true, render: (h) => brl(h.ia) },
                { key: 'porQuarto', header: 'IA por quarto', align: 'right', mono: true, render: (h) => brl(h.ia / h.q, 3) },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Por volume de mensagens"
            subtitle="Por mês, num único número de WhatsApp. Cenário 1: respostas na janela de 24 h grátis. Cenário 2: R$ 0,035 por resposta acima de 1.000."
          />
          <div className="sim-tabela">
            <Table<LinhaVolume>
              rowKey="id"
              data={volume}
              columns={[
                { key: 'msgs', header: 'Mensagens de hóspedes', render: (v) => <strong className="dado">{isMobile ? `${n(v.msgs)} mensagens de hóspedes` : n(v.msgs)}</strong> },
                { key: 'pedidos', header: 'Pedidos', align: 'right', mono: true, render: (v) => (isMobile ? `${n(v.pedidos)} pedidos` : n(v.pedidos)) },
                { key: 'sai', header: 'Mensagens do hotel', align: 'right', mono: true, render: (v) => n(v.sai) },
                { key: 'ia', header: 'IA (atual)', align: 'right', mono: true, render: (v) => brl(v.ia) },
                { key: 'iaAnterior', header: 'IA (anterior)', align: 'right', mono: true, render: (v) => <span className="mudo">{brl(v.iaAnterior)}</span> },
                { key: 'wa1', header: 'WhatsApp cenário 1', align: 'right', mono: true, render: (v) => brl(v.wa1) },
                { key: 'wa2', header: 'WhatsApp cenário 2', align: 'right', mono: true, render: (v) => brl(v.wa2) },
                { key: 'chat', header: 'Chat do quarto (Meta)', align: 'right', mono: true, render: () => brl(0) },
                { key: 'total', header: 'Total WhatsApp, cenário 2', align: 'right', mono: true, render: (v) => <strong>{brl(v.ia + v.wa2)}</strong> },
              ]}
            />
          </div>
        </Card>

        <section className="sim-secao" aria-labelledby="sim-premissas">
          <h2 id="sim-premissas" className="sim-titulo">
            Premissas
          </h2>
          <div className="grade-cartoes">
            <StatCard icon={<CircleDollarSign />} label="IA por pedido" value="R$ 0,0024" hint="Modelos atuais; 61% menos que a configuração anterior." />
            <StatCard
              icon={<MessageCircle />}
              label="WhatsApp por pedido"
              value="R$ 0 a 0,15"
              hint="Zero com respostas grátis na janela de 24 h; R$ 0,15 no cenário 2."
            />
            <StatCard icon={<MessagesSquare />} label="Chat do quarto por pedido" value="R$ 0" hint="Sem Meta. Só a infraestrutura, a mesma dos dois canais." accent="emerald" />
            <StatCard icon={<BadgeCheck />} label="Qualidade medida" value="97,5%" hint="Roteamento certo, em 10 idiomas, com áudio e tradução." accent="emerald" />
          </div>
          <Card>
            <CardBody>
              <dl className="pares sim-pares sim-premissas">
                <dt>Mensagens do hóspede por pedido</dt>
                <dd className="dado">{dec(P.msgPorPedido)}</dd>
                <dt>Mensagens do hotel por pedido</dt>
                <dd className="dado">{dec(P.saiPorPedido)}</dd>
                <dt>IA por mensagem (atual, medido)</dt>
                <dd className="dado">US$ {dec(IA_ATUAL, 6)}</dd>
                <dt>IA por mensagem (anterior, medido)</dt>
                <dd className="dado">US$ {dec(IA_ANTERIOR, 6)}</dd>
                <dt>Meta: serviço, cenário 2</dt>
                <dd className="dado">{brl(P.meta, 3)} acima de {n(P.gratis)}/mês</dd>
                <dt>Meta: modelo fora da janela</dt>
                <dd className="dado">
                  {brl(P.meta, 3)} · {pct(P.foraJanela)} dos pedidos
                </dd>
                <dt>Pedidos por quarto ocupado (típico)</dt>
                <dd className="dado">{dec(TIPICO.pedidos)} por dia</dd>
                <dt>Ocupação (típica)</dt>
                <dd className="dado">{pct(TIPICO.ocupacao)}</dd>
                <dt>Infraestrutura (estimada)</dt>
                <dd className="dado">
                  {brl(P.infraTotal, 0)}/mês, {TIPICO.hoteis} hotéis
                </dd>
              </dl>
              <p className="sim-texto sim-separador">
                As proporções por pedido saíram dos testes de carga de 06/10/2026 (1.259 mensagens de hóspedes em 10 idiomas, com áudio, foto, identificação,
                agradecimento e pesquisa). A infraestrutura (api, worker, banco e arquivos) é estimativa, não medida, e vale para os dois canais. Confirme a
                cobrança de mensagens de serviço na fatura do Business Manager antes de fechar preço.
              </p>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}
