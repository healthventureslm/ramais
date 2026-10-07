import {
  Accordion,
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  Tabs,
  Textarea,
  useConfirm,
} from '@healthventureslm/design-system';
import type { ConfigUnidade, SetorCatalogo } from '@ramais/contracts';
import { AlertTriangle, FlaskConical, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import { avisar } from '../componentes/Avisos';
import { Construtor } from '../componentes/Construtor';
import { Simulador } from '../componentes/Simulador';
import '../estilo/jornada.css';
import { TEXTOS } from './jornada-textos';
import { EscadaEditor } from './JornadaEscada';

/**
 * Jornada da unidade: tudo o que muda entre hotéis sem mexer no código.
 * Edita um rascunho local, valida enquanto você digita e publica como versão nova.
 * Conversas em andamento ficam na versão em que começaram.
 */
type Aba = 'fluxo' | 'setores' | 'escada' | 'textos' | 'tempos' | 'palavras' | 'versoes';

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'fluxo', nome: 'Fluxo' },
  { id: 'setores', nome: 'Setores' },
  { id: 'escada', nome: 'Escalonamento' },
  { id: 'textos', nome: 'Textos' },
  { id: 'tempos', nome: 'Tempos e limites' },
  { id: 'palavras', nome: 'Palavras-chave' },
  { id: 'versoes', nome: 'Versões' },
];

type Versao = Awaited<ReturnType<typeof api.admin.jornadas>>[number];
type Validacao = Awaited<ReturnType<typeof api.admin.validar>>;
type Confirmar = ReturnType<typeof useConfirm>[0];

const CHAVE_RASCUNHO = (u: string) => `ramais.rascunho.${u}`;

export function Jornada({ unidadeId, abaExtra }: { unidadeId: string; abaExtra?: { id: string; nome: string; render: (p: EditorProps) => ReactNode } }) {
  const [aba, setAba] = useState<string>(abaExtra?.id ?? 'fluxo');
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [rascunho, setRascunho] = useState<ConfigUnidade | null>(null);
  const [base, setBase] = useState<string>('');
  const [validacao, setValidacao] = useState<Validacao | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [confirmar, elementoConfirmar] = useConfirm();

  const carregar = useCallback(async () => {
    const vs = await api.admin.jornadas(unidadeId);
    setVersoes(vs);
    const vigente = vs.find((v) => v.vigente) ?? vs[0];
    if (!vigente) return;
    setBase(JSON.stringify(vigente.config));
    // Rascunho não publicado sobrevive a recarregar a página (só neste navegador).
    let salvo: ConfigUnidade | null = null;
    try {
      const s = localStorage.getItem(CHAVE_RASCUNHO(unidadeId));
      salvo = s ? (JSON.parse(s) as ConfigUnidade) : null;
    } catch {
      salvo = null;
    }
    setRascunho(salvo ?? vigente.config);
  }, [unidadeId]);

  useEffect(() => {
    carregar().catch((e) => avisar((e as Error).message, 'error'));
  }, [carregar]);

  const alterado = useMemo(() => rascunho !== null && JSON.stringify(rascunho) !== base, [rascunho, base]);

  // Guarda o rascunho e valida no servidor (com folga, para não chamar a cada tecla).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!rascunho) return;
    try {
      if (alterado) localStorage.setItem(CHAVE_RASCUNHO(unidadeId), JSON.stringify(rascunho));
      else localStorage.removeItem(CHAVE_RASCUNHO(unidadeId));
    } catch {
      // sem armazenamento: o rascunho vale só nesta aba
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.admin.validar(unidadeId, rascunho).then(setValidacao).catch(() => undefined);
    }, 500);
  }, [rascunho, alterado, unidadeId]);

  // Carregando: a mesma casca da tela pronta, com o título no lugar definitivo.
  if (!rascunho) {
    return (
      <div className="jornada">
        <div className="jornada__faixa">
          <div className="jornada__topo">
            <PageHeader title="Jornada" subtitle="Carregando…" />
          </div>
        </div>
        <div className="rolagem">
          <div className="pagina">
            <EmptyState loading title="Carregando a jornada" />
          </div>
        </div>
      </div>
    );
  }

  const mudar = (fn: (c: ConfigUnidade) => ConfigUnidade) => setRascunho((c) => (c ? fn(structuredClone(c)) : c));
  const erroDe = (prefixo: string) => validacao?.erros.filter((e) => e.campo === prefixo || e.campo.startsWith(`${prefixo}.`)) ?? [];
  const vigente = versoes.find((v) => v.vigente);
  const props: EditorProps = { cfg: rascunho, mudar, erroDe, unidadeId };
  const erros = validacao?.erros ?? [];

  const subtitulo = [
    vigente ? `Versão publicada ${vigente.numero}` : 'Nenhuma versão publicada',
    alterado ? 'rascunho com alterações não publicadas' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="jornada">
      <div className="jornada__faixa">
        <div className="jornada__topo">
          <PageHeader
            title="Jornada"
            subtitle={subtitulo}
            actions={
              <div className="linha">
                {validacao && !validacao.valido && <Badge variant="danger">{validacao.erros.length} erro(s)</Badge>}
                {validacao?.valido && alterado && <Badge variant="positive">pronto para publicar</Badge>}
                <Button
                  variant="secondary"
                  iconLeft={testando ? <X /> : <FlaskConical />}
                  aria-pressed={testando}
                  disabled={!validacao?.valido && alterado}
                  onClick={() => setTestando((t) => !t)}
                >
                  {testando ? 'Fechar teste' : 'Testar como hóspede'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!alterado}
                  onClick={async () => {
                    const ok = await confirmar({
                      title: 'Descartar as alterações do rascunho?',
                      description: 'O rascunho volta a ser igual à versão publicada.',
                      confirmLabel: 'Descartar',
                      danger: true,
                    });
                    if (ok) setRascunho(JSON.parse(base) as ConfigUnidade);
                  }}
                >
                  Descartar
                </Button>
                <Button disabled={!alterado || !validacao?.valido} onClick={() => setPublicando(true)}>
                  Publicar
                </Button>
              </div>
            }
          />
          <div className="jornada__abas">
            <Tabs
              value={aba}
              onChange={setAba}
              items={[...(abaExtra ? [abaExtra] : []), ...ABAS].map((a) => ({ value: a.id, label: a.nome }))}
            />
          </div>
        </div>
      </div>

      <div className="rolagem">
        <div className="pagina">
          {erros.length > 0 && (
            <Banner variant="danger" title={`${erros.length} erro(s) no rascunho`} description="Corrija antes de publicar.">
              <ul className="jornada__erros">
                {erros.map((e, i) => (
                  <li key={i}>
                    <span className="dado">{e.campo || 'geral'}</span>
                    {e.erro}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
          {abaExtra && aba === abaExtra.id && abaExtra.render(props)}
          {aba === 'fluxo' && <Construtor {...props} />}
          {aba === 'setores' && <Setores {...props} />}
          {aba === 'escada' && <EscadaEditor {...props} />}
          {aba === 'textos' && <Textos {...props} />}
          {aba === 'tempos' && <Tempos {...props} />}
          {aba === 'palavras' && <Palavras {...props} />}
          {aba === 'versoes' && (
            <Versoes
              versoes={versoes}
              aoAbrir={async (v) => {
                if (alterado) {
                  const ok = await confirmar({
                    title: 'Substituir o rascunho atual por esta versão?',
                    description: 'As alterações que você ainda não publicou serão perdidas.',
                    confirmLabel: 'Substituir',
                    danger: true,
                  });
                  if (!ok) return;
                }
                setRascunho(structuredClone(v.config));
                setAba('setores');
                avisar(`Versão ${v.numero} aberta no rascunho. Publique para voltar a ela.`, 'success');
              }}
            />
          )}
        </div>
      </div>

      {testando && <Simulador unidadeId={unidadeId} cfg={rascunho} aoFechar={() => setTestando(false)} />}
      <Publicar
        open={publicando}
        avisos={validacao?.avisos ?? []}
        aoFechar={() => setPublicando(false)}
        aoConfirmar={async (nota) => {
          try {
            const r = await api.admin.publicar(unidadeId, rascunho, nota);
            try {
              localStorage.removeItem(CHAVE_RASCUNHO(unidadeId));
            } catch {
              // ok
            }
            avisar(`Versão ${r.numero} publicada. Conversas novas já usam esta versão.`, 'success');
            setPublicando(false);
            await carregar();
          } catch (e) {
            avisar((e as Error).message, 'error');
          }
        }}
      />
      {elementoConfirmar}
    </div>
  );
}

export interface EditorProps {
  cfg: ConfigUnidade;
  mudar: (fn: (c: ConfigUnidade) => ConfigUnidade) => void;
  erroDe: (prefixo: string) => { campo: string; erro: string }[];
  unidadeId: string;
}

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

const linhas = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
const virgulas = (t: string) => t.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Erros em texto pequeno, na cor de perigo. */
function Erros({ erros }: { erros: { erro: string }[] }) {
  if (!erros.length) return null;
  return (
    <div className="pilha" style={{ gap: 'var(--space-1)' }}>
      {erros.map((e, i) => (
        <p key={i} className="jornada__erro">
          {e.erro}
        </p>
      ))}
    </div>
  );
}

/** Aviso de uma linha em tom de atenção. */
function AlertaLinha({ children }: { children: ReactNode }) {
  return (
    <p className="jornada__alerta">
      <AlertTriangle aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------

function Setores({ cfg, mudar, erroDe }: EditorProps) {
  const [confirmar, elementoConfirmar] = useConfirm();
  // Setor recém-criado: o acordeão remonta já com ele aberto.
  const [novo, setNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <div className="pilha pilha--larga">
      <Card>
        <CardHeader
          title="Setor de triagem e de reserva"
          subtitle="Recebe o que a IA não sabe rotear e, em modo sombra, as sugestões para confirmar."
        />
        <CardBody>
          <div style={{ maxWidth: 360 }}>
            <Select
              value={cfg.setorFallback}
              onChange={(v) => mudar((c) => ({ ...c, setorFallback: v }))}
              sheetTitle="Setor de triagem e de reserva"
              options={cfg.setores.map((s) => ({ value: s.chave, label: s.nome }))}
            />
          </div>
        </CardBody>
      </Card>

      <Accordion
        key={novo ?? ''}
        defaultOpen={novo ?? undefined}
        items={cfg.setores.map((s, i) => {
          const erros = erroDe(`setores.${i}`);
          return {
            id: s.chave,
            title: s.nome || '(sem nome)',
            subtitle: <span className="dado">{s.chave}</span>,
            meta: (
              <span className="linha">
                {erros.length > 0 && <Badge variant="danger">erro</Badge>}
                <span className="pequeno mudo">
                  {s.palavrasChave.length} palavras · {s.exemplos.length} exemplos
                </span>
              </span>
            ),
            content: (
              <EditorSetor
                s={s}
                i={i}
                mudar={mudar}
                erros={erros}
                confirmar={confirmar}
                podeRemover={cfg.setores.length > 1 && cfg.setorFallback !== s.chave}
              />
            ),
          };
        })}
      />

      <div>
        <Button variant="secondary" iconLeft={<Plus />} onClick={() => setCriando(true)}>
          Novo setor
        </Button>
      </div>

      <NovoSetor
        open={criando}
        existentes={cfg.setores.map((s) => s.chave)}
        aoFechar={() => setCriando(false)}
        aoCriar={(chave) => {
          mudar((c) => ({
            ...c,
            setores: [
              ...c.setores,
              { chave, nome: chave, nomes: {}, descricao: '', exemplos: [], palavrasChave: [], casosDeBorda: [], exigeIdentificacao: false },
            ],
          }));
          setNovo(chave);
          setCriando(false);
        }}
      />
      {elementoConfirmar}
    </div>
  );
}

function NovoSetor({
  open,
  existentes,
  aoFechar,
  aoCriar,
}: {
  open: boolean;
  existentes: string[];
  aoFechar: () => void;
  aoCriar: (chave: string) => void;
}) {
  const [chave, setChave] = useState('');
  useEffect(() => {
    if (open) setChave('');
  }, [open]);
  const limpa = chave.trim();
  const repetida = existentes.includes(limpa);
  const criar = () => {
    if (!limpa) return;
    if (repetida) return avisar('Já existe um setor com esse identificador.', 'warning');
    aoCriar(limpa);
  };
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      size="sm"
      title="Novo setor"
      description="O identificador não muda depois. O nome que aparece para a equipe e para o hóspede você edita em seguida."
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button disabled={!limpa || repetida} onClick={criar}>
            Criar setor
          </Button>
        </>
      }
    >
      <Input
        label="Identificador"
        hint="Minúsculas, sem espaço. Ex.: spa"
        error={repetida ? 'Já existe um setor com esse identificador.' : undefined}
        autoFocus
        value={chave}
        onChange={(e) => setChave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') criar();
        }}
      />
    </Dialog>
  );
}

function EditorSetor({
  s,
  i,
  mudar,
  erros,
  confirmar,
  podeRemover,
}: {
  s: SetorCatalogo;
  i: number;
  mudar: EditorProps['mudar'];
  erros: { campo: string; erro: string }[];
  confirmar: Confirmar;
  podeRemover: boolean;
}) {
  const set = (fn: (x: SetorCatalogo) => SetorCatalogo) =>
    mudar((c) => ({ ...c, setores: c.setores.map((x, j) => (j === i ? fn(x) : x)) }));
  const erro = (campo: string) => erros.find((e) => e.campo === `setores.${i}.${campo}`)?.erro;
  return (
    <div className="pilha pilha--larga">
      <Input label="Nome (para a equipe e para o hóspede)" error={erro('nome')} value={s.nome} onChange={(e) => set((x) => ({ ...x, nome: e.target.value }))} />
      <div className="jornada__duas">
        <Input
          label="Nome em espanhol"
          value={s.nomes.es ?? ''}
          onChange={(e) => set((x) => ({ ...x, nomes: { ...x.nomes, es: e.target.value || undefined } }))}
        />
        <Input
          label="Nome em inglês"
          value={s.nomes.en ?? ''}
          onChange={(e) => set((x) => ({ ...x, nomes: { ...x.nomes, en: e.target.value || undefined } }))}
        />
      </div>
      <Textarea
        label="Descrição para a IA (em inglês)"
        hint="Descreva o que o hóspede pede, na linguagem dele, não o organograma. É o que a IA lê para decidir."
        error={erro('descricao')}
        rows={4}
        value={s.descricao}
        onChange={(e) => set((x) => ({ ...x, descricao: e.target.value }))}
      />
      <Textarea
        label="Exemplos de pedidos (um por linha)"
        rows={4}
        value={s.exemplos.join('\n')}
        onChange={(e) => set((x) => ({ ...x, exemplos: linhas(e.target.value) }))}
      />
      <Textarea
        label="Casos de borda (um por linha)"
        hint='Ex.: "Barulho de outros hóspedes é recepção, não manutenção."'
        rows={2}
        value={s.casosDeBorda.join('\n')}
        onChange={(e) => set((x) => ({ ...x, casosDeBorda: linhas(e.target.value) }))}
      />
      <Input
        key={s.palavrasChave.join(',')}
        label="Palavras-chave (separadas por vírgula)"
        hint="Usadas quando a IA está fora do ar. Em PT, ES e EN, sem acento."
        defaultValue={s.palavrasChave.join(', ')}
        onBlur={(e) => set((x) => ({ ...x, palavrasChave: virgulas(e.target.value) }))}
      />
      <Checkbox
        label="Pedidos deste setor exigem quarto e sobrenome confirmados"
        checked={s.exigeIdentificacao}
        onChange={(e) => set((x) => ({ ...x, exigeIdentificacao: e.target.checked }))}
      />
      {podeRemover && (
        <div>
          <Button
            variant="danger"
            iconLeft={<Trash2 />}
            onClick={async () => {
              const ok = await confirmar({
                title: `Remover ${s.nome}?`,
                description: 'Na publicação, o setor é desativado (se não tiver pedidos abertos).',
                confirmLabel: 'Remover setor',
                danger: true,
              });
              if (ok) mudar((c) => ({ ...c, setores: c.setores.filter((_, j) => j !== i) }));
            }}
          >
            Remover setor
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const IDIOMAS = [
  { id: 'pt', nome: 'Português' },
  { id: 'es', nome: 'Espanhol' },
  { id: 'en', nome: 'Inglês' },
] as const;

function Textos({ cfg, mudar, erroDe }: EditorProps) {
  const [filtro, setFiltro] = useState('');
  const visiveis = TEXTOS.filter((t) => !filtro || `${t.nome} ${t.quando}`.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <div className="pilha pilha--larga">
      <div style={{ maxWidth: 420 }}>
        <Input iconLeft={<Search />} placeholder="Filtrar textos" aria-label="Filtrar textos" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      {visiveis.length === 0 && <EmptyState size="sm" title="Nenhum texto com esse filtro" description="Tente outra palavra." />}
      {visiveis.map((t) => {
        const erros = erroDe(`textos.${t.chave}`);
        return (
          <Card key={t.chave}>
            <CardHeader title={t.nome} subtitle={t.quando} action={erros.length > 0 ? <Badge variant="danger">erro</Badge> : undefined} />
            <CardBody>
              <div className="pilha">
                <div className="jornada__idiomas">
                  {IDIOMAS.map((l) => (
                    <Textarea
                      key={l.id}
                      label={l.nome}
                      rows={3}
                      value={cfg.textos[t.chave]?.[l.id] ?? ''}
                      onChange={(e) =>
                        mudar((c) => ({ ...c, textos: { ...c.textos, [t.chave]: { ...c.textos[t.chave], [l.id]: e.target.value } } }))
                      }
                    />
                  ))}
                </div>
                <VariaveisDivergentes t={cfg.textos[t.chave]} />
                <Erros erros={erros} />
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/** Avisa quando um idioma usa variáveis que os outros não usam ({setor} esquecido no ES, por exemplo). */
function VariaveisDivergentes({ t }: { t?: { pt: string; es: string; en: string } }) {
  if (!t) return null;
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(', ');
  const pt = vars(t.pt);
  const dif = (['es', 'en'] as const).filter((l) => vars(t[l]) !== pt);
  if (!dif.length) return null;
  return (
    <AlertaLinha>
      As variáveis em {dif.join(' e ').toUpperCase()} não batem com o português ({pt || 'nenhuma'}).
    </AlertaLinha>
  );
}

// ---------------------------------------------------------------------------
// Tempos e limites
// ---------------------------------------------------------------------------

function Numero({
  rotulo,
  valor,
  aoMudar,
  unidade,
  min,
  max,
  passo = 1,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (n: number) => void;
  unidade: string;
  min?: number;
  max?: number;
  passo?: number;
}) {
  return (
    <div className="jornada__numero">
      <div className="jornada__numero-campo">
        <Input type="number" inputMode="decimal" aria-label={rotulo} value={valor} min={min} max={max} step={passo} onChange={(e) => aoMudar(Number(e.target.value))} />
      </div>
      <span className="pequeno mudo">{unidade}</span>
    </div>
  );
}

/** Linha de configuração: rótulo e ajuda à esquerda, controle à direita. */
function Linha({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <div className="jornada__config">
      <div className="jornada__config-texto">
        <span className="jornada__config-rotulo">{rotulo}</span>
        {ajuda && <span className="pequeno mudo">{ajuda}</span>}
      </div>
      {children}
    </div>
  );
}

function Tempos({ cfg, mudar, erroDe }: EditorProps) {
  const t = cfg.tempos;
  const l = cfg.limites;
  const setT = (k: keyof typeof t, v: number) => mudar((c) => ({ ...c, tempos: { ...c.tempos, [k]: v } }));
  const setL = (k: keyof typeof l, v: number) => mudar((c) => ({ ...c, limites: { ...c.limites, [k]: v } }));
  const pct = (x: number) => Math.round(x * 100);
  const linhaT = (rotulo: string, k: keyof typeof t, unidade: string, extra: { ajuda?: string; min?: number; max?: number }) => (
    <Linha rotulo={rotulo} ajuda={extra.ajuda}>
      <Numero rotulo={rotulo} valor={t[k]} min={extra.min} max={extra.max} unidade={unidade} aoMudar={(n) => setT(k, n)} />
    </Linha>
  );
  const linhaL = (rotulo: string, k: keyof typeof l, ajuda?: string) => (
    <Linha rotulo={rotulo} ajuda={ajuda}>
      <Numero rotulo={rotulo} valor={pct(l[k])} min={0} max={100} unidade="%" aoMudar={(n) => setL(k, n / 100)} />
    </Linha>
  );
  return (
    <div className="pilha pilha--larga">
      <Card>
        <CardHeader title="Tempos" subtitle="Prazo de aceite, lembretes e quem é chamado quando um pedido fica parado: aba Escalonamento." />
        <CardBody>
          <Erros erros={erroDe('tempos')} />
          {linhaT('Aviso de inatividade do hóspede', 'inatividadeAvisoMin', 'minutos', { ajuda: 'Depois da última resposta da equipe.', min: 1 })}
          {linhaT('Encerrar por inatividade', 'inatividadeEncerraMin', 'minutos', { ajuda: 'Precisa caber na janela de 24 h do WhatsApp.', min: 2 })}
          {linhaT('Reabrir o pedido resolvido se o hóspede escrever em até', 'reaberturaHoras', 'horas', { min: 0, max: 24 })}
          {linhaT('Tirar do turno quem fica sem usar o app por', 'presencaInatividadeMin', 'minutos', { min: 10 })}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Confiança da IA" subtitle="Quanto de certeza a IA precisa ter para cada decisão." />
        <CardBody>
          <Erros erros={erroDe('limites')} />
          {linhaL('Encaminhar direto a partir de', 'encaminha', 'Acima disso o hóspede recebe o nome do setor.')}
          {linhaL("Encaminhar marcado como 'IA sem certeza' a partir de", 'baixaCerteza', 'Abaixo disso vai para a triagem.')}
          {linhaL('Tratar como emergência a partir de', 'emergencia', 'Baixo de propósito: melhor um falso alarme que uma emergência perdida.')}
          {linhaL('Demais gatilhos (pede atendente, setor errado, demora)', 'gatilho')}
          {linhaL('Responder sozinho pela base de conhecimento a partir de', 'respostaAutomatica')}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palavras-chave
// ---------------------------------------------------------------------------

function Palavras({ cfg, mudar }: EditorProps) {
  const p = cfg.palavrasChave;
  const lista = (rotulo: string, ajuda: string, k: keyof typeof p) => (
    <Textarea
      key={`${k}:${p[k].join(',')}`}
      label={rotulo}
      hint={ajuda}
      rows={2}
      defaultValue={p[k].join(', ')}
      onBlur={(e) => mudar((c) => ({ ...c, palavrasChave: { ...c.palavrasChave, [k]: virgulas(e.target.value) } }))}
    />
  );
  return (
    <div className="pilha pilha--larga">
      <Card>
        <CardHeader title="Gatilhos por palavra exata" subtitle="Valem quando a mensagem inteira é a palavra. Frases mais longas a IA entende sozinha." />
        <CardBody>
          <div className="pilha pilha--larga">
            {lista('Encerrar a conversa', 'Ex.: sair, tchau, salir, bye', 'encerrar')}
            {lista('Pedir uma pessoa', 'Ex.: atendente, humano, persona, human', 'humano')}
            {lista('Emergência', 'Ex.: socorro, emergencia, fire', 'emergencia')}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Glossário" />
        <CardBody>
          <Textarea
            key={cfg.glossario.join(',')}
            label="Termos que nunca são traduzidos"
            hint="Nomes de lugares do hotel, marcas, termos que o hóspede conhece assim."
            rows={2}
            defaultValue={cfg.glossario.join(', ')}
            onBlur={(e) => mudar((c) => ({ ...c, glossario: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Versões e publicação
// ---------------------------------------------------------------------------

function Versoes({ versoes, aoAbrir }: { versoes: Versao[]; aoAbrir: (v: Versao) => void }) {
  return (
    <Card>
      <CardHeader title="Versões publicadas" subtitle="Abrir uma versão só troca o rascunho. Nada muda para os hóspedes até você publicar." />
      <Table<Versao>
        data={versoes}
        emptyText="Nenhuma versão publicada ainda."
        columns={[
          {
            key: 'numero',
            header: 'Versão',
            width: '140px',
            primary: true,
            render: (v: Versao) => (
              <span className="linha">
                <span className="dado">{v.numero}</span>
                {v.vigente && <Badge variant="positive">vigente</Badge>}
              </span>
            ),
          } as never,
          {
            key: 'publicada_em',
            header: 'Publicada em',
            mono: true,
            secondary: true,
            render: (v: Versao) => new Date(v.publicada_em).toLocaleString('pt-BR'),
          } as never,
          {
            key: 'setores',
            header: 'Setores',
            render: (v: Versao) => <span className="pequeno">{v.config.setores.map((s) => s.nome).join(', ')}</span>,
          } as never,
          {
            key: 'acao',
            header: '',
            align: 'right',
            render: (v: Versao) => (
              <Button size="sm" variant="secondary" onClick={() => aoAbrir(v)}>
                Abrir no rascunho
              </Button>
            ),
          } as never,
        ]}
      />
    </Card>
  );
}

function Publicar({
  open,
  avisos,
  aoFechar,
  aoConfirmar,
}: {
  open: boolean;
  avisos: string[];
  aoFechar: () => void;
  aoConfirmar: (nota: string) => Promise<void>;
}) {
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (open) setNota('');
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      title="Publicar nova versão"
      description="Conversas novas passam a usar esta versão. As que estão em andamento continuam na versão em que começaram."
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            loading={enviando}
            onClick={async () => {
              setEnviando(true);
              await aoConfirmar(nota);
              setEnviando(false);
            }}
          >
            Publicar
          </Button>
        </>
      }
    >
      <div className="pilha pilha--larga">
        {avisos.length > 0 && (
          <div className="pilha">
            {avisos.map((a, i) => (
              <AlertaLinha key={i}>{a}</AlertaLinha>
            ))}
          </div>
        )}
        <Input label="O que mudou?" hint="Opcional. Fica no histórico de versões." value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
    </Dialog>
  );
}
