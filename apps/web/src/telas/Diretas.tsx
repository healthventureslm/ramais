import { Avatar, Badge, Button, ChatBubble, EmptyState, IconButton, Input, ListGroup, ListItem, SegmentedControl, StatusDot, Switch, Textarea } from '@healthventureslm/design-system';
import type { Sessao } from '@ramais/contracts';
import { ArrowLeft, MessagesSquare, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type ConversaDireta, type MensagemDireta, type PessoaBusca } from '../api';
import { avisar } from '../componentes/Avisos';
import { AnexarMidia, MidiaMensagem } from '../componentes/Midia';
import { useEvento } from '../tempo-real';
import { hora } from '../util';

const iniciais = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Online (app ou web aberta), no turno sem estar com o app aberto, ou fora. */
function Presenca({ p }: { p: PessoaBusca }) {
  if (p.online) return <StatusDot status="positive">Online</StatusDot>;
  if (p.emTurno) return <StatusDot status="info">No turno</StatusDot>;
  return <StatusDot status="neutral">Fora do turno</StatusDot>;
}

const ocupacao = (p: PessoaBusca) => (p.atendendo > 0 ? `Atendendo ${p.atendendo}` : p.online || p.emTurno ? 'Livre' : null);

/**
 * Mensagem direta, como ramal: para uma pessoa exata, com status. A urgente toca no celular e pede ciente.
 * Texto, foto ou áudio (com a transcrição embaixo).
 */
export function Diretas({ sessao, unidadeId }: { sessao: Sessao; unidadeId: string }) {
  const [conversas, setConversas] = useState<ConversaDireta[] | null>(null);
  const [aberta, setAberta] = useState<{ id: string | null; pessoa: { id: string; nome: string } } | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDireta[]>([]);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<'equipe' | 'conversas'>('equipe');
  const [equipe, setEquipe] = useState<PessoaBusca[] | null>(null);
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    api.diretas().then(setConversas).catch(() => setConversas([]));
  }, []);
  const carregarMensagens = useCallback(() => {
    if (aberta?.id) api.direta(aberta.id).then(setMensagens).catch(() => undefined);
    else setMensagens([]);
  }, [aberta?.id]);
  useEffect(carregar, [carregar]);
  useEffect(carregarMensagens, [carregarMensagens]);
  useEffect(() => {
    void fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);
  useEvento('direta:nova', (p) => {
    carregar();
    if (p.conversaId === aberta?.id) carregarMensagens();
  });
  useEvento('direta:atualizada', (p) => {
    if (p.conversaId === aberta?.id) carregarMensagens();
  });

  // A equipe inteira, com presença e ocupação; atualiza sozinha enquanto a tela está aberta.
  const carregarEquipe = useCallback(() => {
    api
      .pessoas(unidadeId, '')
      .then((l) => setEquipe(l.filter((p) => p.id !== sessao.pessoa.id)))
      .catch(() => setEquipe((e) => e ?? []));
  }, [unidadeId, sessao.pessoa.id]);
  useEffect(() => {
    carregarEquipe();
    const t = setInterval(carregarEquipe, 15_000);
    return () => clearInterval(t);
  }, [carregarEquipe]);
  useEvento('solicitacao:atualizada', () => {
    if (aba === 'equipe') carregarEquipe();
  });

  const filtro = semAcento(busca.trim());
  const equipeFiltrada = useMemo(
    () => (equipe ?? []).filter((p) => !filtro || semAcento(`${p.nome} ${p.setores ?? ''}`).includes(filtro)),
    [equipe, filtro],
  );
  const conversasFiltradas = useMemo(
    () => (conversas ?? []).filter((c) => !filtro || semAcento(c.outros?.map((o) => o.nome).join(' ') ?? '').includes(filtro)),
    [conversas, filtro],
  );
  const online = equipe?.filter((p) => p.online).length ?? 0;
  const urgentes = conversas?.reduce((n, c) => n + c.urgentes_pendentes, 0) ?? 0;
  const presencaDe = (id: string) => equipe?.find((p) => p.id === id);
  const presencaAberta = aberta ? presencaDe(aberta.pessoa.id) : undefined;

  function abrirPessoa(p: { id: string; nome: string }) {
    const existente = conversas?.find((c) => c.outros?.some((o) => o.id === p.id) && !c.solicitacao_id);
    setAberta({ id: existente?.id ?? null, pessoa: { id: p.id, nome: p.nome } });
  }

  function enviado(r: { conversaId: string; foraDoTurno: boolean; destinatario: string }) {
    if (!aberta) return;
    if (r.foraDoTurno) avisar(`${r.destinatario} está fora do turno e vai ver quando entrar.`, 'warning');
    setUrgente(false);
    setAberta({ id: r.conversaId, pessoa: aberta.pessoa });
    carregar();
    if (r.conversaId === aberta.id) carregarMensagens();
  }

  async function enviar() {
    if (!aberta || !texto.trim()) return;
    setEnviando(true);
    try {
      enviado(await api.enviarDireta(aberta.pessoa.id, texto.trim(), urgente));
      setTexto('');
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`diretas ${aberta ? 'diretas--aberta' : ''}`}>
      <section className="diretas__lista" aria-label="Conversas">
        <div className="diretas__busca">
          <SegmentedControl
            block
            value={aba}
            onChange={(v) => setAba(v as 'equipe' | 'conversas')}
            options={[
              { value: 'equipe', label: 'Equipe', count: online },
              { value: 'conversas', label: 'Conversas', ...(urgentes > 0 ? { count: urgentes, tone: 'danger' as const } : {}) },
            ]}
          />
          <Input iconLeft={<Search />} placeholder="Filtrar por nome ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Filtrar pessoas" />
        </div>
        {aba === 'equipe' ? (
          equipe === null ? (
            <EmptyState loading size="sm" />
          ) : equipeFiltrada.length === 0 ? (
            <EmptyState size="sm" icon={<Users />} title="Ninguém encontrado" description="Tente o nome do setor, como manutenção ou recepção." />
          ) : (
            <ListGroup plain>
              {equipeFiltrada.map((p) => (
                <ListItem
                  key={p.id}
                  active={aberta?.pessoa.id === p.id}
                  onClick={() => abrirPessoa(p)}
                  media={<Avatar name={p.nome} size="sm" />}
                  title={p.nome}
                  subtitleParts={[p.setores ?? 'Sem setor', ocupacao(p)].filter(Boolean)}
                  meta={<Presenca p={p} />}
                />
              ))}
            </ListGroup>
          )
        ) : conversas === null ? (
          <EmptyState loading size="sm" />
        ) : conversasFiltradas.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<MessagesSquare />}
            title={filtro ? 'Nenhuma conversa com esse nome' : 'Nenhuma conversa ainda'}
            description="Na aba Equipe aparece todo mundo; toque em alguém para escrever."
          />
        ) : (
          <ListGroup plain>
            {conversasFiltradas.map((c) => {
              const outro = c.outros?.[0];
              if (!outro) return null;
              const minha = c.ultima?.autor_id === sessao.pessoa.id;
              return (
                <ListItem
                  key={c.id}
                  active={aberta?.id === c.id}
                  onClick={() => setAberta({ id: c.id, pessoa: outro })}
                  media={<Avatar name={outro.nome} size="sm" />}
                  title={
                    <span className="linha">
                      {c.outros?.map((o) => o.nome).join(', ')}
                      {c.urgentes_pendentes > 0 && <Badge variant="danger">Urgente</Badge>}
                    </span>
                  }
                  subtitle={c.ultima ? `${minha ? 'Você: ' : ''}${c.ultima.tipo === 'audio' ? 'Mensagem de voz' : c.ultima.tipo === 'imagem' ? `Foto${c.ultima.texto ? `: ${c.ultima.texto}` : ''}` : c.ultima.texto}` : undefined}
                  meta={presencaDe(outro.id)?.online ? <StatusDot status="positive">{c.ultima ? hora(c.ultima.criado_em) : 'Online'}</StatusDot> : c.ultima ? hora(c.ultima.criado_em) : undefined}
                />
              );
            })}
          </ListGroup>
        )}
      </section>

      {aberta ? (
        <section className="conversa" aria-label={`Conversa com ${aberta.pessoa.nome}`}>
          <header className="conversa__cabeca">
            <span className="so-celular">
              <IconButton label="Voltar para as conversas" onClick={() => setAberta(null)}>
                <ArrowLeft />
              </IconButton>
            </span>
            <Avatar name={aberta.pessoa.nome} size="sm" />
            <div className="conversa__quem">
              <strong>{aberta.pessoa.nome}</strong>
              {presencaAberta ? (
                <span className="linha">
                  <Presenca p={presencaAberta} />
                  {ocupacao(presencaAberta) && <span>· {ocupacao(presencaAberta)}</span>}
                </span>
              ) : (
                <span>Mensagem direta</span>
              )}
            </div>
          </header>
          <div className="conversa__mensagens">
            {mensagens.length === 0 && <EmptyState size="sm" title={`Escreva a primeira mensagem para ${aberta.pessoa.nome.split(' ')[0]}`} />}
            {mensagens.map((m) => {
              const minha = m.autor_id === sessao.pessoa.id;
              return (
                <ChatBubble
                  key={m.id}
                  role={minha ? 'user' : 'assistant'}
                  avatar={iniciais(m.autor_nome)}
                  name={m.urgente ? <Badge variant="danger">Urgente</Badge> : minha ? 'Você' : m.autor_nome}
                  time={<span className="dado">{hora(m.criado_em)}</span>}
                >
                  {m.tipo !== 'texto' && (
                    <MidiaMensagem
                      tipo={m.tipo}
                      url={m.midia_url}
                      transcricao={m.transcricao}
                      criadoEm={m.criado_em}
                      alt={`Foto de ${m.autor_nome}`}
                      carregar={api.midia}
                    />
                  )}
                  {m.texto && <div style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                  {m.urgente && minha && <div className="conversa__traducao">{m.ciente_em ? `Ciente às ${hora(m.ciente_em)}` : 'Aguardando ciente'}</div>}
                  {m.urgente && !minha && m.ciente_em && <div className="conversa__traducao">Você deu ciente às {hora(m.ciente_em)}</div>}
                  {m.urgente && !minha && !m.ciente_em && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <Button size="sm" onClick={() => api.ciente(m.id).then(carregarMensagens)}>
                        Dar ciente
                      </Button>
                    </div>
                  )}
                </ChatBubble>
              );
            })}
            <div ref={fim} />
          </div>
          <div className="conversa__compositor">
            <Textarea
              rows={2}
              value={texto}
              placeholder={`Mensagem para ${aberta.pessoa.nome.split(' ')[0]}`}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              aria-label={`Mensagem para ${aberta.pessoa.nome}`}
            />
            <Switch label="Urgente: toca no celular e pede ciente" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            <AnexarMidia
              destino={`para ${aberta.pessoa.nome.split(' ')[0]}`}
              aoErro={(msg) => avisar(msg, 'error')}
              aoEnviar={async (a, legenda) => enviado(await api.enviarDiretaMidia(aberta.pessoa.id, a, legenda, urgente))}
            >
              <span className="espaco" />
              <Button variant={urgente ? 'danger' : 'primary'} onClick={enviar} loading={enviando} disabled={!texto.trim()}>
                Enviar
              </Button>
            </AnexarMidia>
          </div>
        </section>
      ) : (
        <div className="atendimentos__vazio">
          <EmptyState align="center" icon={<MessagesSquare />} title="Escolha alguém da equipe" description="Quem está online aparece primeiro, com quantos atendimentos tem abertos." />
        </div>
      )}
    </div>
  );
}
