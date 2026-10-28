import {
  Accordion,
  Badge,
  Button,
  ChipGroup,
  Drawer,
  EmptyState,
  IconButton,
  Input,
  ListGroup,
  ListItem,
  SegmentedControl,
  Select,
  Switch,
  Tag,
  Textarea,
} from '@healthventureslm/design-system';
import { Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type CatalogoItemAdmin, type CatalogoItemReq, type Setor } from '../api';
import '../estilo/catalogo-admin.css';
import { avisar } from './Avisos';

type Tipo = 'compra' | 'agendamento';
type VagasPor = 'pessoa' | 'pedido';

interface RascunhoJanela {
  chave: number;
  dias: number[];
  inicio: string;
  fim: string;
  intervalo: string;
}

/** O formulário guarda números como texto: campo vazio tem significado (sem preço, sem limite). */
interface Rascunho {
  id: string | null;
  tipo: Tipo;
  categoria: string;
  nome: string;
  descricao: string;
  setorId: string;
  preco: string;
  maxQuantidade: string;
  porPessoa: boolean;
  duracao: string;
  capacidade: string;
  vagasPor: VagasPor;
  janelas: RascunhoJanela[];
  antecedencia: string;
  diasAFrente: string;
  nomeEs: string;
  descEs: string;
  nomeEn: string;
  descEn: string;
  ativo: boolean;
  ordem: number;
}

type Erros = Record<string, string>;

const DIAS = [
  { v: 0, curto: 'D', nome: 'Domingo' },
  { v: 1, curto: 'S', nome: 'Segunda' },
  { v: 2, curto: 'T', nome: 'Terça' },
  { v: 3, curto: 'Q', nome: 'Quarta' },
  { v: 4, curto: 'Q', nome: 'Quinta' },
  { v: 5, curto: 'S', nome: 'Sexta' },
  { v: 6, curto: 'S', nome: 'Sábado' },
];

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

let proximaChave = 1;
const novaJanela = (): RascunhoJanela => ({ chave: proximaChave++, dias: [0, 1, 2, 3, 4, 5, 6], inicio: '09:00', fim: '18:00', intervalo: '60' });

function precoDoItem(i: CatalogoItemAdmin): string {
  if (i.precoCentavos === null) return 'Sem preço';
  return `${brl(i.precoCentavos)}${i.tipo === 'agendamento' && i.porPessoa ? '/pessoa' : ''}`;
}

function vagasDoItem(i: CatalogoItemAdmin): string {
  if (i.capacidade === null) return 'vagas sem limite';
  if (i.vagasPor === 'pessoa') return `${i.capacidade} ${i.capacidade === 1 ? 'lugar' : 'lugares'} por horário`;
  return `${i.capacidade} ${i.capacidade === 1 ? 'reserva' : 'reservas'} por horário`;
}

function duracaoTexto(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "45,90", "45.90", "1.234,50" ou "R$ 45" em centavos. Vazio = sem preço; inválido = NaN. */
function centavos(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

const inteiro = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : Number.NaN);

function rascunhoDe(i: CatalogoItemAdmin): Rascunho {
  return {
    id: i.id,
    tipo: i.tipo,
    categoria: i.categoria,
    nome: i.nome,
    descricao: i.descricao,
    setorId: i.setorId,
    preco: i.precoCentavos === null ? '' : (i.precoCentavos / 100).toFixed(2).replace('.', ','),
    maxQuantidade: String(i.maxQuantidade),
    porPessoa: i.porPessoa,
    duracao: i.duracaoMin === null ? '' : String(i.duracaoMin),
    capacidade: i.capacidade === null ? '' : String(i.capacidade),
    vagasPor: i.vagasPor,
    janelas: i.horarios.map((j) => ({ chave: proximaChave++, dias: [...j.dias], inicio: j.inicio, fim: j.fim, intervalo: String(j.intervaloMin) })),
    antecedencia: String(i.antecedenciaMin),
    diasAFrente: String(i.diasAFrente),
    nomeEs: i.nomes.es ?? '',
    descEs: i.descricoes.es ?? '',
    nomeEn: i.nomes.en ?? '',
    descEn: i.descricoes.en ?? '',
    ativo: i.ativo,
    ordem: i.ordem,
  };
}

function novoRascunho(setorId: string, ordem: number): Rascunho {
  return {
    id: null,
    tipo: 'compra',
    categoria: '',
    nome: '',
    descricao: '',
    setorId,
    preco: '',
    maxQuantidade: '10',
    porPessoa: false,
    duracao: '60',
    capacidade: '',
    vagasPor: 'pessoa',
    janelas: [novaJanela()],
    antecedencia: '60',
    diasAFrente: '14',
    nomeEs: '',
    descEs: '',
    nomeEn: '',
    descEn: '',
    ativo: true,
    ordem,
  };
}

/** Confere o rascunho e monta o corpo da API. Devolve os erros por campo quando não dá para salvar. */
function validar(r: Rascunho): { corpo: CatalogoItemReq } | { erros: Erros } {
  const e: Erros = {};
  const agenda = r.tipo === 'agendamento';
  if (!r.categoria.trim()) e.categoria = 'Informe a categoria.';
  if (!r.nome.trim()) e.nome = 'Informe o nome.';
  if (!r.setorId) e.setor = 'Escolha quem atende o pedido.';
  const preco = centavos(r.preco);
  if (preco !== null && Number.isNaN(preco)) e.preco = 'Use só números, como 45,90.';
  const max = inteiro(r.maxQuantidade);
  if (!(max >= 1 && max <= 100)) e.maxQuantidade = 'Entre 1 e 100.';

  const duracao = inteiro(r.duracao);
  const capacidade = r.capacidade.trim() ? inteiro(r.capacidade) : null;
  const antecedencia = inteiro(r.antecedencia);
  const diasAFrente = inteiro(r.diasAFrente);
  if (agenda) {
    if (!(duracao >= 5 && duracao <= 1440)) e.duracao = 'Entre 5 e 1440 minutos.';
    if (capacidade !== null && !(capacidade >= 1 && capacidade <= 10_000)) e.capacidade = 'Pelo menos 1, ou vazio para sem limite.';
    if (!(antecedencia >= 0 && antecedencia <= 10_080)) e.antecedencia = 'Entre 0 e 10080 minutos (7 dias).';
    if (!(diasAFrente >= 0 && diasAFrente <= 120)) e.diasAFrente = 'Entre 0 e 120 dias.';
    if (!r.janelas.length) e.janelas = 'Cadastre pelo menos uma janela de horários.';
    r.janelas.forEach((j, n) => {
      if (!j.dias.length) e[`dias-${n}`] = 'Marque pelo menos um dia.';
      if (!HORA.test(j.inicio)) e[`inicio-${n}`] = 'Use HH:MM.';
      if (!HORA.test(j.fim)) e[`fim-${n}`] = 'Use HH:MM.';
      else if (HORA.test(j.inicio) && j.fim <= j.inicio) e[`fim-${n}`] = 'Precisa ser depois do início.';
      else if (HORA.test(j.inicio) && duracao >= 5 && minutos(j.inicio) + duracao > minutos(j.fim))
        e[`fim-${n}`] = `Não cabe nenhum horário: a duração é ${duracaoTexto(duracao)}.`;
      const intervalo = inteiro(j.intervalo);
      if (!(intervalo >= 5 && intervalo <= 1440)) e[`intervalo-${n}`] = 'Entre 5 e 1440.';
    });
  }
  if (Object.keys(e).length) return { erros: e };

  const opcional = (t: string) => t.trim() || undefined;
  return {
    corpo: {
      setorId: r.setorId,
      tipo: r.tipo,
      categoria: r.categoria.trim(),
      nome: r.nome.trim(),
      descricao: r.descricao.trim(),
      nomes: { es: opcional(r.nomeEs), en: opcional(r.nomeEn) },
      descricoes: { es: opcional(r.descEs), en: opcional(r.descEn) },
      precoCentavos: preco,
      porPessoa: agenda && r.porPessoa,
      maxQuantidade: max,
      duracaoMin: agenda ? duracao : null,
      capacidade: agenda ? capacidade : null,
      vagasPor: r.vagasPor,
      horarios: agenda
        ? r.janelas.map((j) => ({ dias: [...j.dias].sort((a, b) => a - b), inicio: j.inicio, fim: j.fim, intervaloMin: inteiro(j.intervalo) }))
        : [],
      antecedenciaMin: agenda ? antecedencia : 60,
      diasAFrente: agenda ? diasAFrente : 14,
      ativo: r.ativo,
      ordem: r.ordem,
    },
  };
}

/** O que o hotel vende ou agenda pelo chat do quarto: room service, amenidades, spa, passeios, transfer, mesa. */
export function CatalogoAdmin({ unidadeId }: { unidadeId: string }) {
  const [itens, setItens] = useState<CatalogoItemAdmin[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [filtro, setFiltro] = useState('');

  const carregar = () => api.admin.catalogo(unidadeId).then(setItens).catch((e) => avisar(e.message, 'error'));
  useEffect(() => {
    void carregar();
    api.setores(unidadeId).then(setSetores).catch((e) => avisar(e.message, 'error'));
  }, [unidadeId]);

  const categorias = useMemo(() => [...new Set((itens ?? []).map((i) => i.categoria))], [itens]);

  const f = filtro.trim().toLowerCase();
  const grupos = useMemo(() => {
    const m = new Map<string, CatalogoItemAdmin[]>();
    for (const i of itens ?? []) {
      if (f && !`${i.categoria} ${i.nome} ${i.descricao} ${i.setorNome}`.toLowerCase().includes(f)) continue;
      m.set(i.categoria, [...(m.get(i.categoria) ?? []), i]);
    }
    return [...m.entries()];
  }, [itens, f]);

  function novo() {
    const ordem = Math.max(-1, ...(itens ?? []).map((i) => i.ordem)) + 1;
    setEditando(novoRascunho(setores.length === 1 ? setores[0]!.id : '', ordem));
  }

  return (
    <>
      <div className="admin-barra">
        <div className="admin-barra__busca">
          <Input type="search" iconLeft={<Search />} placeholder="Buscar no catálogo…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar no catálogo" />
        </div>
        <span className="pequeno mudo espaco">{itens ? `${itens.filter((i) => i.ativo).length} itens ativos` : ''}</span>
        <Button iconLeft={<Plus />} onClick={novo}>
          Novo item
        </Button>
      </div>

      {itens === null ? (
        <EmptyState loading size="sm" />
      ) : itens.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={<ShoppingBag />}
          title="O catálogo está vazio"
          description="Cadastre o que o hóspede pode pedir pelo chat do quarto: room service, amenidades, late checkout, spa, passeios, transfer, mesa no restaurante."
        />
      ) : grupos.length === 0 ? (
        <EmptyState size="sm" icon={<Search />} title="Nada encontrado" description="Tente outra palavra ou limpe a busca." />
      ) : (
        <div className="pilha pilha--larga">
          {grupos.map(([cat, lista]) => (
            <ListGroup key={cat} label={cat}>
              {lista.map((i) => (
                <ListItem
                  key={i.id}
                  wrap
                  chevron
                  onClick={() => setEditando(rascunhoDe(i))}
                  className={i.ativo ? undefined : 'catalogo-admin__inativo'}
                  title={i.nome}
                  subtitleParts={[
                    <span key="selos" className="catalogo-admin__selos">
                      <Badge variant={i.tipo === 'agendamento' ? 'info' : 'brand'}>{i.tipo === 'agendamento' ? 'Agendamento' : 'Compra'}</Badge>
                      {!i.ativo && <Badge variant="neutral">Inativo</Badge>}
                    </span>,
                    i.setorNome,
                    ...(i.tipo === 'agendamento' && i.duracaoMin !== null ? [duracaoTexto(i.duracaoMin), vagasDoItem(i)] : []),
                    i.pedidos30d ? `${i.pedidos30d} ${i.pedidos30d === 1 ? 'pedido' : 'pedidos'} em 30 dias` : 'sem pedidos em 30 dias',
                  ]}
                  meta={precoDoItem(i)}
                />
              ))}
            </ListGroup>
          ))}
        </div>
      )}

      {editando && (
        <FormItem
          key={editando.id ?? 'novo'}
          r={editando}
          unidadeId={unidadeId}
          setores={setores}
          categorias={categorias}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            void carregar();
          }}
        />
      )}
    </>
  );
}

function FormItem({
  r: inicial,
  unidadeId,
  setores,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  r: Rascunho;
  unidadeId: string;
  setores: Setor[];
  categorias: string[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [r, setR] = useState(inicial);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const novo = r.id === null;
  const agenda = r.tipo === 'agendamento';

  const mudar = (p: Partial<Rascunho>) => setR((x) => ({ ...x, ...p }));
  const mudarJanela = (n: number, p: Partial<RascunhoJanela>) => setR((x) => ({ ...x, janelas: x.janelas.map((j, i) => (i === n ? { ...j, ...p } : j)) }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = validar(r);
    if ('erros' in v) {
      setErros(v.erros);
      avisar('Confira os campos marcados.', 'warning');
      return;
    }
    setErros({});
    setSalvando(true);
    try {
      if (novo) await api.admin.criarItem(unidadeId, v.corpo);
      else await api.admin.salvarItem(r.id!, v.corpo);
      avisar('Salvo. O hóspede já vê no chat do quarto.', 'success');
      aoSalvar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setSalvando(false);
    }
  }

  const traducoes = [r.nomeEs, r.descEs, r.nomeEn, r.descEn].filter((t) => t.trim()).length;

  return (
    <Drawer
      open
      onClose={aoFechar}
      size="md"
      title={novo ? 'Novo item' : 'Editar item'}
      subtitle="O hóspede vê e pede pelo chat do quarto; o pedido cai no setor escolhido."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-catalogo" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-catalogo" onSubmit={salvar} noValidate className="pilha pilha--larga">
        <div className="pilha">
          <span className="admin-rotulo">Tipo</span>
          <SegmentedControl
            block
            options={[
              { value: 'compra', label: 'Compra' },
              { value: 'agendamento', label: 'Agendamento' },
            ]}
            value={r.tipo}
            onChange={(v) => mudar({ tipo: v as Tipo })}
          />
          <span className="pequeno mudo">
            {agenda ? 'Tem dia e hora marcados, com vagas por horário: spa, passeio, transfer, mesa.' : 'Entregue no quarto ou lançado na conta: room service, amenidades, late checkout.'}
          </span>
        </div>

        <div className="pilha">
          <Input
            label="Categoria"
            required
            maxLength={60}
            value={r.categoria}
            onChange={(e) => mudar({ categoria: e.target.value })}
            placeholder="Room service"
            error={erros.categoria}
            hint="Agrupa os itens no chat do quarto."
          />
          {categorias.length > 0 && (
            <ChipGroup label="Categorias existentes">
              {categorias.map((c) => (
                <Tag key={c} pressed={r.categoria === c} onToggle={() => mudar({ categoria: c })}>
                  {c}
                </Tag>
              ))}
            </ChipGroup>
          )}
        </div>

        <Input
          label="Nome"
          required
          maxLength={120}
          value={r.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
          autoFocus={novo}
          placeholder={agenda ? 'Massagem relaxante (60 min)' : 'Club sandwich'}
          error={erros.nome}
        />
        <Textarea
          label="Descrição"
          maxLength={1000}
          rows={3}
          value={r.descricao}
          onChange={(e) => mudar({ descricao: e.target.value })}
          hint="O que vem, o que está incluído, se é cortesia."
        />
        <Select
          label="Quem atende"
          required
          value={r.setorId}
          onChange={(v) => mudar({ setorId: v })}
          options={setores.map((s) => ({ value: s.id, label: s.nome }))}
          placeholder="Escolha o setor…"
          sheetTitle="Setor que atende o pedido"
          error={erros.setor}
        />

        <div className="catalogo-admin__duplo">
          <Input
            label="Preço (R$)"
            inputMode="decimal"
            value={r.preco}
            onChange={(e) => mudar({ preco: e.target.value })}
            placeholder="Sem preço"
            error={erros.preco}
            hint="Vazio: sem preço (cortesia ou sob consulta)."
          />
          <Input
            label={agenda ? 'Máx. de pessoas por reserva' : 'Máx. por pedido'}
            type="number"
            min={1}
            max={100}
            value={r.maxQuantidade}
            onChange={(e) => mudar({ maxQuantidade: e.target.value })}
            error={erros.maxQuantidade}
          />
        </div>

        {agenda && (
          <>
            <Switch label="Preço por pessoa (multiplica pelo número de pessoas)" checked={r.porPessoa} onChange={(e) => mudar({ porPessoa: e.target.checked })} />

            <div className="catalogo-admin__duplo">
              <Input
                label="Duração (min)"
                type="number"
                min={5}
                max={1440}
                required
                value={r.duracao}
                onChange={(e) => mudar({ duracao: e.target.value })}
                error={erros.duracao}
              />
              <Input
                label="Vagas por horário"
                type="number"
                min={1}
                value={r.capacidade}
                onChange={(e) => mudar({ capacidade: e.target.value })}
                placeholder="Sem limite"
                error={erros.capacidade}
                hint="Vazio: sem limite."
              />
            </div>
            <div className="pilha">
              <span className="admin-rotulo">Cada vaga é</span>
              <SegmentedControl
                block
                options={[
                  { value: 'pessoa', label: 'Uma pessoa' },
                  { value: 'pedido', label: 'Uma reserva' },
                ]}
                value={r.vagasPor}
                onChange={(v) => mudar({ vagasPor: v as VagasPor })}
              />
              <span className="pequeno mudo">
                {r.vagasPor === 'pessoa'
                  ? 'Cada pessoa ocupa um lugar: passeio, mesa no restaurante.'
                  : 'A reserva inteira ocupa uma vaga, com quantas pessoas for: sala de massagem, carro do transfer.'}
              </span>
            </div>

            <div className="pilha">
              <span className="admin-rotulo">Grade de horários</span>
              <span className="pequeno mudo">Um horário a cada intervalo, do início até o fim; o atendimento precisa terminar até o fim da janela.</span>
              {r.janelas.map((j, n) => (
                <div key={j.chave} className="catalogo-admin__janela">
                  <div className="linha">
                    <span className="admin-rotulo espaco">Janela {n + 1}</span>
                    <IconButton
                      size="sm"
                      variant="danger"
                      label={`Remover janela ${n + 1}`}
                      onClick={() => setR((x) => ({ ...x, janelas: x.janelas.filter((_, i) => i !== n) }))}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <ChipGroup label={`Dias da janela ${n + 1}`}>
                    {DIAS.map((d) => {
                      const tem = j.dias.includes(d.v);
                      return (
                        <Tag
                          key={d.v}
                          pressed={tem}
                          aria-label={d.nome}
                          title={d.nome}
                          onToggle={() => mudarJanela(n, { dias: tem ? j.dias.filter((x) => x !== d.v) : [...j.dias, d.v] })}
                        >
                          {d.curto}
                        </Tag>
                      );
                    })}
                  </ChipGroup>
                  {erros[`dias-${n}`] && <span className="catalogo-admin__erro">{erros[`dias-${n}`]}</span>}
                  <div className="catalogo-admin__campos">
                    <Input label="Início" type="time" value={j.inicio} onChange={(e) => mudarJanela(n, { inicio: e.target.value })} error={erros[`inicio-${n}`]} />
                    <Input label="Fim" type="time" value={j.fim} onChange={(e) => mudarJanela(n, { fim: e.target.value })} error={erros[`fim-${n}`]} />
                    <Input
                      label="A cada (min)"
                      type="number"
                      min={5}
                      max={1440}
                      value={j.intervalo}
                      onChange={(e) => mudarJanela(n, { intervalo: e.target.value })}
                      error={erros[`intervalo-${n}`]}
                    />
                  </div>
                </div>
              ))}
              {erros.janelas && <span className="catalogo-admin__erro">{erros.janelas}</span>}
              <div className="linha">
                <Button type="button" size="sm" variant="secondary" iconLeft={<Plus />} onClick={() => mudar({ janelas: [...r.janelas, novaJanela()] })}>
                  Adicionar janela
                </Button>
              </div>
            </div>

            <div className="catalogo-admin__duplo">
              <Input
                label="Antecedência mínima (min)"
                type="number"
                min={0}
                max={10080}
                value={r.antecedencia}
                onChange={(e) => mudar({ antecedencia: e.target.value })}
                error={erros.antecedencia}
                hint="60 = 1 hora; 1440 = 1 dia."
              />
              <Input
                label="Reserva até quantos dias à frente"
                type="number"
                min={0}
                max={120}
                value={r.diasAFrente}
                onChange={(e) => mudar({ diasAFrente: e.target.value })}
                error={erros.diasAFrente}
              />
            </div>
          </>
        )}

        <Accordion
          items={[
            {
              id: 'traducao',
              title: 'Tradução para o hóspede',
              subtitle: traducoes ? `${traducoes} de 4 campos preenchidos` : 'Opcional: sem ela, o hóspede vê em português.',
              content: (
                <div className="pilha pilha--larga">
                  <Input label="Nome em espanhol" maxLength={160} value={r.nomeEs} onChange={(e) => mudar({ nomeEs: e.target.value })} />
                  <Textarea label="Descrição em espanhol" maxLength={1000} rows={2} value={r.descEs} onChange={(e) => mudar({ descEs: e.target.value })} />
                  <Input label="Nome em inglês" maxLength={160} value={r.nomeEn} onChange={(e) => mudar({ nomeEn: e.target.value })} />
                  <Textarea label="Descrição em inglês" maxLength={1000} rows={2} value={r.descEn} onChange={(e) => mudar({ descEn: e.target.value })} />
                </div>
              ),
            },
          ]}
        />

        <Switch label="Ativo (o hóspede vê e pode pedir)" checked={r.ativo} onChange={(e) => mudar({ ativo: e.target.checked })} />
      </form>
    </Drawer>
  );
}
