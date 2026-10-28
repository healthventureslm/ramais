import { Badge, Button, EmptyState, IconButton, ListGroup, ListItem, Sheet, Textarea } from '@healthventureslm/design-system';
import type { CatalogoItemView, PedidoReq, PedidoView } from '@ramais/contracts';
import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../estilo/catalogo-hospede.css';

/** Textos da tela (vêm do chat do quarto, já no idioma do hóspede). */
export interface TextosCatalogo {
  pedirOuReservar: string;
  meusPedidos: string;
  catalogoVazio: string;
  voltar: string;
  quantidade: string;
  pessoas: string;
  dia: string;
  horario: string;
  semHorario: string;
  observacao: string;
  total: string;
  naConta: string;
  pedir: string;
  reservar: string;
  semPreco: string;
  porPessoa: string;
  hoje: string;
  amanha: string;
  estadoPendente: string;
  estadoConfirmado: string;
  estadoRecusado: string;
  estadoCancelado: string;
  estadoConcluido: string;
  cancelarPedido: string;
  nenhumPedido: string;
  menos: string;
  mais: string;
}

export interface ApiCatalogo {
  catalogo: () => Promise<{ itens: CatalogoItemView[]; hoje: string }>;
  horarios: (id: string, data: string, pessoas: number) => Promise<{ horarios: { hora: string; livres: number | null }[] }>;
  pedir: (b: PedidoReq) => Promise<PedidoView>;
  pedidos: () => Promise<{ pedidos: PedidoView[] }>;
  cancelar: (id: string) => Promise<unknown>;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function noIdioma(base: string, traducoes: { es?: string; en?: string }, idioma: string): string {
  const i = idioma.split('-')[0];
  if (i === 'pt') return base;
  if (i === 'es') return traducoes.es || base;
  return traducoes.en || base;
}

/** AAAA-MM-DD somando dias (datas do relógio do hotel; sem fuso envolvido). */
function somarDias(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

function rotuloDia(data: string, i: number, idioma: string, t: TextosCatalogo): string {
  if (i === 0) return t.hoje;
  if (i === 1) return t.amanha;
  const [a, m, d] = data.split('-').map(Number);
  return new Intl.DateTimeFormat(idioma, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(a!, m! - 1, d!)));
}

function precoDoItem(i: CatalogoItemView, t: TextosCatalogo): string {
  if (i.precoCentavos === null || i.precoCentavos === 0) return t.semPreco;
  return `${brl(i.precoCentavos)}${i.tipo === 'agendamento' && i.porPessoa ? ` ${t.porPessoa}` : ''}`;
}

export function rotuloEstado(e: PedidoView['estado'], t: TextosCatalogo): { texto: string; variante: 'warning' | 'positive' | 'danger' | 'neutral' | 'info' } {
  if (e === 'pendente') return { texto: t.estadoPendente, variante: 'warning' };
  if (e === 'confirmado') return { texto: t.estadoConfirmado, variante: 'info' };
  if (e === 'recusado') return { texto: t.estadoRecusado, variante: 'danger' };
  if (e === 'cancelado') return { texto: t.estadoCancelado, variante: 'neutral' };
  return { texto: t.estadoConcluido, variante: 'positive' };
}

/**
 * "Pedir ou reservar" no chat do quarto: o catálogo do hotel por categoria, o item com
 * quantidade (compra) ou dia, horário e pessoas (agendamento), e o pedido sai para o setor.
 */
export function CatalogoHospede({
  aberto,
  aoFechar,
  api,
  idioma,
  t,
  aoPedir,
  aoErro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  api: ApiCatalogo;
  idioma: string;
  t: TextosCatalogo;
  aoPedir: (p: PedidoView) => void;
  aoErro: (msg: string) => void;
}) {
  const [dados, setDados] = useState<{ itens: CatalogoItemView[]; hoje: string } | null>(null);
  const [item, setItem] = useState<CatalogoItemView | null>(null);
  const [qtd, setQtd] = useState(1);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<{ hora: string; livres: number | null }[] | null>(null);
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    setItem(null);
    api.catalogo().then(setDados).catch(() => setDados({ itens: [], hoje: new Date().toISOString().slice(0, 10) }));
    // A api muda de identidade a cada render do chat; carrega ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const categorias = useMemo(() => {
    const m = new Map<string, CatalogoItemView[]>();
    for (const i of dados?.itens ?? []) m.set(i.categoria, [...(m.get(i.categoria) ?? []), i]);
    return [...m.entries()];
  }, [dados]);

  function escolher(i: CatalogoItemView) {
    setItem(i);
    setQtd(1);
    setObs('');
    setHora(null);
    setHorarios(null);
    setDia(i.tipo === 'agendamento' && dados ? dados.hoje : null);
  }

  // Horários livres do dia escolhido, para o tamanho do grupo.
  useEffect(() => {
    if (!item || item.tipo !== 'agendamento' || !dia) return;
    let vivo = true;
    setHorarios(null);
    api
      .horarios(item.id, dia, qtd)
      .then((r) => {
        if (!vivo) return;
        setHorarios(r.horarios);
        setHora((h) => (h && r.horarios.some((x) => x.hora === h) ? h : null));
      })
      .catch(() => vivo && setHorarios([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, dia, qtd, recarga]);

  const total = item && item.precoCentavos ? (item.tipo === 'compra' || item.porPessoa ? item.precoCentavos * qtd : item.precoCentavos) : null;
  const pronto = item && (item.tipo === 'compra' || Boolean(dia && hora));

  async function enviar() {
    if (!item || !pronto) return;
    setEnviando(true);
    try {
      const p = await api.pedir({
        itemId: item.id,
        quantidade: qtd,
        ...(item.tipo === 'agendamento' ? { data: dia!, hora: hora! } : {}),
        ...(obs.trim() ? { observacao: obs.trim() } : {}),
      });
      aoPedir(p);
    } catch (e) {
      aoErro((e as Error).message);
      // O horário pode ter acabado de ser ocupado: mostra os que sobraram.
      if (item.tipo === 'agendamento') setRecarga((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  }

  const dias = item && dados ? Array.from({ length: Math.min(item.diasAFrente, 13) + 1 }, (_, n) => somarDias(dados.hoje, n)) : [];
  const nome = item ? noIdioma(item.nome, item.nomes, idioma) : '';

  return (
    <Sheet
      open={aberto}
      onClose={aoFechar}
      detents={[0.92]}
      title={item ? nome : t.pedirOuReservar}
      ariaLabel={t.pedirOuReservar}
      footer={
        item ? (
          <div className="cat-hosp__rodape">
            {total !== null && (
              <span className="cat-hosp__total">
                {t.total}: <strong>{brl(total)}</strong>
                <small>{t.naConta}</small>
              </span>
            )}
            <Button block onClick={enviar} loading={enviando} disabled={!pronto}>
              {item.tipo === 'compra' ? t.pedir : t.reservar}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!item ? (
        dados === null ? (
          <EmptyState loading size="sm" />
        ) : categorias.length === 0 ? (
          <EmptyState size="sm" icon={<ShoppingBag />} title={t.catalogoVazio} />
        ) : (
          <div className="cat-hosp__lista">
            {categorias.map(([cat, itens]) => (
              <ListGroup key={cat} label={cat}>
                {itens.map((i) => (
                  <ListItem
                    key={i.id}
                    chevron
                    onClick={() => escolher(i)}
                    wrap
                    title={noIdioma(i.nome, i.nomes, idioma)}
                    subtitleParts={[precoDoItem(i, t), noIdioma(i.descricao, i.descricoes, idioma)].filter(Boolean)}
                  />
                ))}
              </ListGroup>
            ))}
          </div>
        )
      ) : (
        <div className="cat-hosp__item">
          <span className="cat-hosp__voltar">
            <Button variant="ghost" size="sm" iconLeft={<ArrowLeft />} onClick={() => setItem(null)}>
              {t.voltar}
            </Button>
          </span>
          {noIdioma(item.descricao, item.descricoes, idioma) && <p className="cat-hosp__descricao">{noIdioma(item.descricao, item.descricoes, idioma)}</p>}
          <p className="cat-hosp__preco">{precoDoItem(item, t)}</p>

          <div className="cat-hosp__campo">
            <span className="cat-hosp__rotulo">{item.tipo === 'compra' ? t.quantidade : t.pessoas}</span>
            <div className="cat-hosp__passo">
              <IconButton label={t.menos} variant="outline" onClick={() => setQtd((n) => Math.max(1, n - 1))} disabled={qtd <= 1}>
                <Minus />
              </IconButton>
              <strong aria-live="polite">{qtd}</strong>
              <IconButton label={t.mais} variant="outline" onClick={() => setQtd((n) => Math.min(item.maxQuantidade, n + 1))} disabled={qtd >= item.maxQuantidade}>
                <Plus />
              </IconButton>
            </div>
          </div>

          {item.tipo === 'agendamento' && (
            <>
              <div className="cat-hosp__campo">
                <span className="cat-hosp__rotulo">{t.dia}</span>
                <div className="cat-hosp__opcoes cat-hosp__opcoes--dias">
                  {dias.map((d, n) => (
                    <Button key={d} size="sm" variant={d === dia ? 'primary' : 'secondary'} onClick={() => setDia(d)}>
                      {rotuloDia(d, n, idioma, t)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="cat-hosp__campo">
                <span className="cat-hosp__rotulo">{t.horario}</span>
                {horarios === null ? (
                  <EmptyState loading size="sm" />
                ) : horarios.length === 0 ? (
                  <p className="cat-hosp__descricao">{t.semHorario}</p>
                ) : (
                  <div className="cat-hosp__opcoes">
                    {horarios.map((h) => (
                      <Button key={h.hora} size="sm" variant={h.hora === hora ? 'primary' : 'secondary'} onClick={() => setHora(h.hora)}>
                        {h.hora}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Textarea label={t.observacao} rows={2} value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} />
        </div>
      )}
    </Sheet>
  );
}

/** "Meus pedidos": o que o hóspede pediu nesta estadia e a situação de cada um. */
export function MeusPedidos({
  aberto,
  aoFechar,
  api,
  idioma,
  t,
  aoErro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  api: ApiCatalogo;
  idioma: string;
  t: TextosCatalogo;
  aoErro: (msg: string) => void;
}) {
  const [lista, setLista] = useState<PedidoView[] | null>(null);
  const carregar = () => api.pedidos().then((r) => setLista(r.pedidos)).catch(() => setLista([]));
  useEffect(() => {
    if (aberto) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const quando = (iso: string) =>
    new Intl.DateTimeFormat(idioma, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

  return (
    <Sheet open={aberto} onClose={aoFechar} detents={[0.7]} title={t.meusPedidos}>
      {lista === null ? (
        <EmptyState loading size="sm" />
      ) : lista.length === 0 ? (
        <EmptyState size="sm" icon={<ShoppingBag />} title={t.nenhumPedido} />
      ) : (
        <ListGroup>
          {lista.map((p) => {
            const e = rotuloEstado(p.estado, t);
            const podeCancelar = p.estado === 'pendente' || (p.estado === 'confirmado' && p.agendadoPara && new Date(p.agendadoPara) > new Date());
            return (
              <ListItem
                key={p.id}
                wrap
                title={`${p.tipo === 'compra' ? `${p.quantidade}× ` : ''}${p.itemNome}`}
                subtitleParts={[
                  p.agendadoPara ? `${quando(p.agendadoPara)} · ${p.quantidade} ${t.pessoas.toLowerCase()}` : quando(p.criadoEm),
                  p.totalCentavos ? brl(p.totalCentavos) : null,
                ].filter(Boolean)}
                meta={<Badge variant={e.variante}>{e.texto}</Badge>}
                actions={
                  podeCancelar ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        api
                          .cancelar(p.id)
                          .then(carregar)
                          .catch((err: Error) => aoErro(err.message))
                      }
                    >
                      {t.cancelarPedido}
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </ListGroup>
      )}
    </Sheet>
  );
}
