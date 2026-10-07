import { Badge, Banner, Button, Card, CardBody, CardHeader, Drawer, EmptyState, Input, Switch, Tag, Textarea } from '@healthventureslm/design-system';
import { BookOpen, MessageCircleQuestion, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type ItemConhecimento, type TesteConhecimento } from '../../api';
import { avisar } from '../../componentes/Avisos';

interface Rascunho {
  id: string | null;
  pergunta: string;
  resposta: string;
  tags: string;
  ativo: boolean;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const novoItem = (): Rascunho => ({ id: null, pergunta: '', resposta: '', tags: '', ativo: true });

/** O que a IA responde sozinha. Escrito em português; sai traduzido para o idioma do hóspede. */
export function Conhecimento({ unidadeId }: { unidadeId: string }) {
  const [itens, setItens] = useState<ItemConhecimento[] | null>(null);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [filtro, setFiltro] = useState('');

  const carregar = () => api.admin.conhecimento(unidadeId).then(setItens).catch((e) => avisar(e.message, 'error'));
  useEffect(() => {
    void carregar();
  }, [unidadeId]);

  const f = filtro.trim().toLowerCase();
  const lista = (itens ?? []).filter((i) => !f || `${i.pergunta} ${i.resposta} ${i.tags.join(' ')}`.toLowerCase().includes(f));

  return (
    <>
      <Testar unidadeId={unidadeId} itens={itens ?? []} />

      <div className="admin-barra">
        <div className="admin-barra__busca">
          <Input type="search" iconLeft={<Search />} placeholder="Buscar na base…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar na base" />
        </div>
        <span className="pequeno mudo espaco">{itens ? `${itens.filter((i) => i.ativo).length} itens ativos` : ''}</span>
        <Button iconLeft={<Plus />} onClick={() => setEditando(novoItem())}>
          Novo item
        </Button>
      </div>

      {itens === null ? (
        <EmptyState loading size="sm" />
      ) : itens.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={<BookOpen />}
          title="A base está vazia"
          description="Comece pelo que a recepção mais ouve: senha do Wi-Fi, horário do café, check-out, estacionamento."
        />
      ) : lista.length === 0 ? (
        <EmptyState size="sm" icon={<Search />} title="Nada encontrado" description="Tente outra palavra ou limpe a busca." />
      ) : (
        <div className="pilha pilha--larga">
          {lista.map((i) => (
            <Card key={i.id} flat={!i.ativo}>
              <CardHeader
                title={i.pergunta}
                subtitle={
                  <span className="linha" title="Respostas automáticas nos últimos 30 dias">
                    {!i.ativo && <Badge variant="neutral">Desativado</Badge>}
                    {i.usos ? `Usado ${i.usos} ${i.usos === 1 ? 'vez' : 'vezes'} em 30 dias` : 'Não usado em 30 dias'}
                  </span>
                }
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditando({ id: i.id, pergunta: i.pergunta, resposta: i.resposta, tags: i.tags.join(', '), ativo: i.ativo })}
                  >
                    Editar
                  </Button>
                }
              />
              <CardBody>
                <div className="pilha">
                  <p className="admin-texto" style={{ color: i.ativo ? undefined : 'var(--text-muted)' }}>
                    {i.resposta}
                  </p>
                  {i.tags.length > 0 && (
                    <div className="linha">
                      {i.tags.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {editando && (
        <FormItem
          key={editando.id ?? 'novo'}
          r={editando}
          unidadeId={unidadeId}
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

/** Pergunta como um hóspede faria, sem mandar nada para ninguém. */
function Testar({ unidadeId, itens }: { unidadeId: string; itens: ItemConhecimento[] }) {
  const [pergunta, setPergunta] = useState('');
  const [r, setR] = useState<(TesteConhecimento & { pergunta: string }) | null>(null);
  const [testando, setTestando] = useState(false);

  async function testar(e: React.FormEvent) {
    e.preventDefault();
    if (pergunta.trim().length < 2) return;
    setTestando(true);
    try {
      setR({ ...(await api.admin.testarConhecimento(unidadeId, pergunta.trim())), pergunta: pergunta.trim() });
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setTestando(false);
    }
  }

  const fonte = (chave: string) => itens.find((i) => i.chave === chave)?.pergunta ?? chave;

  return (
    <Card>
      <CardHeader title="Testar uma pergunta" subtitle="Pergunte como um hóspede faria. Nada é enviado para ninguém." />
      <CardBody>
        <div className="pilha pilha--larga">
          <form onSubmit={testar} className="linha" style={{ flexWrap: 'nowrap' }}>
            <div className="espaco" style={{ minWidth: 0 }}>
              <Input
                iconLeft={<MessageCircleQuestion />}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                placeholder="Ex.: que horas fecha a piscina? / what's the wifi password?"
                aria-label="Pergunta de teste"
              />
            </div>
            <Button type="submit" variant="secondary" loading={testando} disabled={testando || pergunta.trim().length < 2}>
              Testar
            </Button>
          </form>
          {r && (
            <div aria-live="polite">
              <Banner
                variant={r.responderia ? 'positive' : 'warning'}
                title={r.responderia ? 'A IA responderia sozinha' : 'A IA não responderia: vai para a equipe'}
                meta={
                  r.motor ? (
                    <span className="pequeno dado" title={`limite para responder: ${pct(r.limite)}`}>
                      certeza {pct(r.confianca)} · precisa de {pct(r.limite)}
                    </span>
                  ) : undefined
                }
                description={
                  r.resposta ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>
                      {r.responderia ? '' : 'Resposta que daria (abaixo do limite): '}
                      {r.resposta}
                    </span>
                  ) : undefined
                }
              >
                {(r.motivo || r.fontes.length > 0 || (!r.responderia && !r.resposta && !r.motivo)) && (
                  <div className="pilha" style={{ gap: 'var(--space-1)' }}>
                    {r.motivo && <span className="pequeno mudo">{r.motivo}</span>}
                    {r.fontes.length > 0 && <span className="pequeno mudo">Com base em: {r.fontes.map(fonte).join(' · ')}</span>}
                    {!r.responderia && !r.resposta && !r.motivo && (
                      <span className="pequeno mudo">Nada na base responde isso. Se for pergunta comum, cadastre um item.</span>
                    )}
                  </div>
                )}
              </Banner>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function FormItem({ r: inicial, unidadeId, aoFechar, aoSalvar }: { r: Rascunho; unidadeId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [r, setR] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const novo = r.id === null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const corpo = {
      pergunta: r.pergunta.trim(),
      resposta: r.resposta.trim(),
      tags: r.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      ativo: r.ativo,
    };
    try {
      if (novo) await api.admin.criarConhecimento(unidadeId, corpo);
      else await api.admin.salvarConhecimento(r.id!, corpo);
      avisar('Salvo. Já vale para as próximas mensagens.', 'success');
      aoSalvar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      open
      onClose={aoFechar}
      size="md"
      title={novo ? 'Novo item' : 'Editar item'}
      subtitle="Escrito em português; sai traduzido para o idioma do hóspede."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-conhecimento" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-conhecimento" onSubmit={salvar} className="pilha pilha--larga">
        <Input
          label="Pergunta"
          required
          minLength={3}
          maxLength={300}
          value={r.pergunta}
          onChange={(e) => setR({ ...r, pergunta: e.target.value })}
          autoFocus
          placeholder="Qual a senha do Wi-Fi?"
          hint="Como um hóspede perguntaria. A IA entende outras formas e outros idiomas."
        />
        <Textarea
          label="Resposta"
          required
          minLength={2}
          maxLength={2000}
          rows={6}
          value={r.resposta}
          onChange={(e) => setR({ ...r, resposta: e.target.value })}
          hint="Em português. Vai traduzida para o idioma do hóspede."
        />
        <Input
          label="Palavras-chave"
          value={r.tags}
          onChange={(e) => setR({ ...r, tags: e.target.value })}
          placeholder="wifi, internet, senha"
          hint="Separadas por vírgula. Usadas se a IA estiver fora do ar."
        />
        <Switch label="Ativo (a IA usa este item)" checked={r.ativo} onChange={(e) => setR({ ...r, ativo: e.target.checked })} />
      </form>
    </Drawer>
  );
}
