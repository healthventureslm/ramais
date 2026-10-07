import { Avatar, Badge, Button, ChatBubble, EmptyState, IconButton, Input, ListGroup, ListItem, StatusDot, Switch, Textarea } from '@healthventureslm/design-system';
import type { Sessao } from '@ramais/contracts';
import { ArrowLeft, MessagesSquare, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Mensagem direta, como ramal: para uma pessoa exata, com status. A urgente toca no celular e pede ciente.
 * Texto, foto ou áudio (com a transcrição embaixo).
 */
export function Diretas({ sessao, unidadeId }: { sessao: Sessao; unidadeId: string }) {
  const [conversas, setConversas] = useState<ConversaDireta[] | null>(null);
  const [aberta, setAberta] = useState<{ id: string | null; pessoa: { id: string; nome: string } } | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDireta[]>([]);
  const [busca, setBusca] = useState('');
  const [pessoas, setPessoas] = useState<PessoaBusca[]>([]);
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

  useEffect(() => {
    if (!busca.trim()) {
      setPessoas([]);
      return;
    }
    const t = setTimeout(() => api.pessoas(unidadeId, busca).then((l) => setPessoas(l.filter((p) => p.id !== sessao.pessoa.id))), 200);
    return () => clearTimeout(t);
  }, [busca, unidadeId, sessao.pessoa.id]);

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
          <Input iconLeft={<Search />} placeholder="Buscar por nome ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pessoa" />
        </div>
        {busca.trim() ? (
          <ListGroup plain>
            {pessoas.length === 0 && <EmptyState size="sm" title="Ninguém encontrado" description="Tente o nome do setor, como manutenção ou recepção." />}
            {pessoas.map((p) => (
              <ListItem
                key={p.id}
                onClick={() => {
                  const existente = conversas?.find((c) => c.outros?.some((o) => o.id === p.id) && !c.solicitacao_id);
                  setAberta({ id: existente?.id ?? null, pessoa: { id: p.id, nome: p.nome } });
                  setBusca('');
                }}
                media={<Avatar name={p.nome} size="sm" />}
                title={p.nome}
                subtitle={p.setores ?? undefined}
                meta={<StatusDot status={p.emTurno ? 'positive' : 'neutral'}>{p.emTurno ? 'no turno' : 'fora'}</StatusDot>}
              />
            ))}
          </ListGroup>
        ) : conversas === null ? (
          <EmptyState loading size="sm" />
        ) : conversas.length === 0 ? (
          <EmptyState size="sm" icon={<MessagesSquare />} title="Nenhuma conversa ainda" description="Busque alguém da equipe pelo nome ou pelo setor." />
        ) : (
          <ListGroup plain>
            {conversas.map((c) => {
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
                  meta={c.ultima ? hora(c.ultima.criado_em) : undefined}
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
              <span>Mensagem direta</span>
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
          <EmptyState align="center" icon={<MessagesSquare />} title="Escolha uma conversa" description="Ou busque alguém da equipe pelo nome ou pelo setor." />
        </div>
      )}
    </div>
  );
}
