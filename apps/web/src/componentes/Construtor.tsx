import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ChipGroup,
  Drawer,
  EmptyState,
  IconButton,
  Input,
  Menu,
  SegmentedControl,
  Select,
  Switch,
  Tag,
  Textarea,
  useConfirm,
} from '@healthventureslm/design-system';
import type { BlocoFluxo, Condicao, ConfigUnidade, ConteudoTexto, Etapa, TipoBloco, TipoCondicao } from '@ramais/contracts';
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { TEXTOS } from '../telas/jornada-textos';
import type { EditorProps } from '../telas/Jornada';

/**
 * Construtor de fluxo: o ciclo fixo de 5 etapas, com blocos em cada uma.
 * Não é um canvas livre; a ordem das etapas não muda, só o que vai dentro.
 */

const ETAPAS: { id: Etapa; nome: string; descricao: string; tipos: TipoBloco[] }[] = [
  {
    id: 'entrada',
    nome: 'Entrada',
    descricao: 'Primeira coisa que acontece quando o hóspede escreve: boas-vindas, avisos de horário.',
    tipos: ['mensagem', 'coletar', 'encaminhar', 'encerrar'],
  },
  {
    id: 'identificacao',
    nome: 'Identificação',
    descricao: 'Dados que você precisa antes de atender: quarto e sobrenome, reserva, CPF.',
    tipos: ['coletar', 'mensagem', 'encaminhar'],
  },
  {
    id: 'resolucao',
    nome: 'Resolução',
    descricao: 'A IA tenta resolver sozinha pela base de conhecimento e decide o setor.',
    tipos: ['base_conhecimento', 'decidir_setor', 'mensagem', 'coletar', 'encaminhar', 'encerrar'],
  },
  {
    id: 'atendimento',
    nome: 'Atendimento',
    descricao: 'Quando e para quem o pedido vai: é aqui que entra o atendente.',
    tipos: ['encaminhar', 'mensagem', 'coletar', 'encerrar'],
  },
  {
    id: 'encerramento',
    nome: 'Encerramento',
    descricao: 'Quando a equipe resolve: mensagem final e pesquisa de satisfação.',
    tipos: ['mensagem', 'pesquisa'],
  },
];

type Categoria = 'fala' | 'pergunta' | 'ia' | 'fila' | 'fim';

/** A categoria dá a cor da etiqueta do bloco: fala com o hóspede, pergunta, IA, fila ou fim. */
const NOME_BLOCO: Record<TipoBloco, { nome: string; categoria: Categoria; ajuda: string }> = {
  mensagem: { nome: 'Mensagem', categoria: 'fala', ajuda: 'Envia um texto e segue.' },
  coletar: { nome: 'Pedir um dado', categoria: 'pergunta', ajuda: 'Pergunta algo ao hóspede; pode esperar a resposta.' },
  base_conhecimento: { nome: 'Responder pela base', categoria: 'ia', ajuda: 'A IA responde sozinha se a base de conhecimento cobrir a pergunta.' },
  decidir_setor: { nome: 'Decidir o setor', categoria: 'ia', ajuda: 'A IA escolhe o setor; se o pedido for vago, pergunta uma vez.' },
  encaminhar: { nome: 'Encaminhar', categoria: 'fila', ajuda: 'Põe o pedido na fila de um setor: aqui entra o atendente.' },
  encerrar: { nome: 'Encerrar', categoria: 'fim', ajuda: 'Termina a conversa sem atendente (ex.: serviço fechado).' },
  pesquisa: { nome: 'Pesquisa de satisfação', categoria: 'fala', ajuda: 'Pergunta uma nota de 1 a 5.' },
};

/** Família da paleta por categoria (categoria, não semântica). IA fica neutra. */
const FAMILIA: Record<Categoria, 'petrol' | 'amber' | 'emerald' | 'crimson' | undefined> = {
  fala: 'petrol',
  pergunta: 'amber',
  ia: undefined,
  fila: 'emerald',
  fim: 'crimson',
};

const CAMPOS: { id: string; nome: string }[] = [
  { id: 'quarto_sobrenome', nome: 'Quarto e sobrenome' },
  { id: 'reserva', nome: 'Código da reserva' },
  { id: 'nome', nome: 'Nome completo' },
  { id: 'email', nome: 'E-mail' },
  { id: 'cpf', nome: 'CPF' },
  { id: 'data', nome: 'Data' },
  { id: 'texto', nome: 'Resposta livre' },
];

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CONDICOES: { tipo: TipoCondicao; nome: string }[] = [
  { tipo: 'primeira_mensagem', nome: 'É a primeira mensagem' },
  { tipo: 'horario', nome: 'Horário' },
  { tipo: 'dia_semana', nome: 'Dia da semana' },
  { tipo: 'setor', nome: 'Setor decidido' },
  { tipo: 'setor_exige_identificacao', nome: 'Setor exige identificação' },
  { tipo: 'identificado', nome: 'Hóspede identificado' },
  { tipo: 'tem_quarto', nome: 'Quarto conhecido (QR)' },
  { tipo: 'idioma', nome: 'Idioma do hóspede' },
  { tipo: 'dado', nome: 'Dado já informado' },
  { tipo: 'urgencia', nome: 'Urgência' },
];

const IDIOMAS = [
  { id: 'pt', nome: 'Português' },
  { id: 'es', nome: 'Espanhol' },
  { id: 'en', nome: 'Inglês' },
] as const;

function novoId(tipo: string) {
  return `${tipo}-${Math.random().toString(36).slice(2, 6)}`;
}

function blocoNovo(tipo: TipoBloco): BlocoFluxo {
  const base = { id: novoId(tipo), quando: [] as Condicao[] };
  switch (tipo) {
    case 'mensagem':
      return { ...base, tipo, conteudo: { tipo: 'livre', texto: { pt: '', es: '', en: '' } } };
    case 'coletar':
      return {
        ...base,
        tipo,
        campo: 'reserva',
        pergunta: { tipo: 'livre', texto: { pt: 'Qual o código da sua reserva?', es: '¿Cuál es el código de su reserva?', en: 'What is your booking code?' } },
        bloqueia: true,
        conferir: true,
        tentativas: 2,
        seFalhar: 'seguir',
      };
    case 'base_conhecimento':
      return { ...base, tipo };
    case 'decidir_setor':
      return { ...base, tipo, perguntarSeVago: true };
    case 'encaminhar':
      return { ...base, tipo, destino: 'decidido', avisar: true };
    case 'encerrar':
      return { ...base, tipo, conteudo: { tipo: 'livre', texto: { pt: '', es: '', en: '' } } };
    case 'pesquisa':
      return {
        ...base,
        tipo,
        pergunta: { pt: 'De 1 a 5, como foi o atendimento?', es: 'Del 1 al 5, ¿cómo fue la atención?', en: 'From 1 to 5, how was the service?' },
        agradecimento: { pt: 'Obrigado pela avaliação!', es: '¡Gracias por su evaluación!', en: 'Thank you for your feedback!' },
      };
  }
}

function nomeSetor(cfg: ConfigUnidade, chave: string) {
  return cfg.setores.find((s) => s.chave === chave)?.nome ?? chave;
}

function textoCurto(c: ConteudoTexto | undefined) {
  if (!c) return '';
  if (c.tipo === 'fixo') return `texto "${TEXTOS.find((t) => t.chave === c.chave)?.nome ?? c.chave}"`;
  return c.texto.pt ? `"${c.texto.pt.slice(0, 60)}${c.texto.pt.length > 60 ? '…' : ''}"` : '(texto vazio)';
}

/** Uma frase que diz o que o bloco faz. */
function resumo(b: BlocoFluxo, cfg: ConfigUnidade): string {
  switch (b.tipo) {
    case 'mensagem':
      return `Envia ${textoCurto(b.conteudo)}`;
    case 'coletar':
      return `Pede ${CAMPOS.find((x) => x.id === b.campo)?.nome.toLowerCase()} · ${b.bloqueia ? `espera a resposta (${b.tentativas} tentativa${b.tentativas > 1 ? 's' : ''}, depois ${b.seFalhar === 'humano' ? 'passa para uma pessoa' : 'segue'})` : 'não espera'}`;
    case 'base_conhecimento':
      return 'Se a base de conhecimento responder, resolve sem atendente';
    case 'decidir_setor':
      return `A IA escolhe o setor${b.perguntarSeVago ? ' · se vago, pergunta uma vez' : ''}`;
    case 'encaminhar':
      return `Fila de ${b.destino === 'decidido' ? 'setor decidido pela IA' : nomeSetor(cfg, b.destino.slice(6))}${b.avisar ? ' · avisa o hóspede' : ''}${b.urgencia ? ` · urgência ${b.urgencia}` : ''}`;
    case 'encerrar':
      return `Encerra a conversa${b.conteudo ? ` com ${textoCurto(b.conteudo)}` : ''}`;
    case 'pesquisa':
      return `Pergunta "${b.pergunta.pt.slice(0, 50)}"`;
  }
}

function textoCondicao(q: Condicao, cfg: ConfigUnidade): string {
  const n = q.nao ? 'não ' : '';
  switch (q.tipo) {
    case 'primeira_mensagem':
      return `${n}é a primeira mensagem`;
    case 'horario':
      return `${q.nao ? 'fora' : 'entre'} ${q.de} e ${q.ate}`;
    case 'dia_semana':
      return `${n}${q.dias.map((d) => DIAS[d]).join(', ')}`;
    case 'setor':
      return `setor ${n}${q.setores.map((s) => nomeSetor(cfg, s)).join(' ou ')}`;
    case 'setor_exige_identificacao':
      return `setor ${n}exige identificação`;
    case 'identificado':
      return `hóspede ${n}identificado`;
    case 'tem_quarto':
      return `quarto ${n}conhecido`;
    case 'idioma':
      return `idioma ${n}${q.idiomas.join('/').toUpperCase()}`;
    case 'dado':
      return `${CAMPOS.find((x) => x.id === q.campo)?.nome ?? q.campo} ${n}informado`;
    case 'urgencia':
      return `urgência ${n}${q.niveis.join('/')}`;
  }
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

/** Rótulo acima de um controle que não tem `label` próprio (Select, grupos). */
function Campo({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="pilha" style={{ gap: 'var(--space-1)' }}>
      <span className="jornada__rotulo">{nome}</span>
      {children}
    </div>
  );
}

export function Construtor({ cfg, mudar, erroDe }: EditorProps) {
  const [editando, setEditando] = useState<{ etapa: Etapa; i: number } | null>(null);
  const [confirmar, elementoConfirmar] = useConfirm();

  const setEtapa = (etapa: Etapa, fn: (bs: BlocoFluxo[]) => BlocoFluxo[]) =>
    mudar((c) => ({ ...c, fluxo: { ...c.fluxo, [etapa]: fn(c.fluxo[etapa]) } }));

  const mover = (etapa: Etapa, i: number, d: -1 | 1) =>
    setEtapa(etapa, (bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const novo = [...bs];
      [novo[i], novo[j]] = [novo[j]!, novo[i]!];
      return novo;
    });

  const temEncaminharSempre = cfg.fluxo.atendimento.some((b) => b.tipo === 'encaminhar' && b.quando.length === 0);
  const blocoEditado = editando ? cfg.fluxo[editando.etapa][editando.i] : undefined;

  return (
    <div className="pilha pilha--larga">
      <p className="mudo" style={{ margin: 0, maxWidth: 820 }}>
        A cada mensagem, os blocos rodam de cima para baixo, etapa por etapa, até um bloco esperar a resposta do hóspede, encaminhar para um
        setor ou encerrar. Blocos com condição só rodam quando todas as condições valem. O encerramento roda quando a equipe resolve o
        pedido.
      </p>
      {!temEncaminharSempre && (
        <Banner
          variant="warning"
          title='O atendimento não tem um "Encaminhar" sem condição'
          description="Se nenhum bloco encaminhar, o sistema encaminha ao setor decidido pela IA (rede de segurança)."
        />
      )}
      {ETAPAS.map((e, ie) => {
        const blocos = cfg.fluxo[e.id];
        return (
          <section key={e.id} className="fluxo__etapa" aria-label={`Etapa ${e.nome}`}>
            <header className="fluxo__etapa-cabeca">
              <span className="fluxo__etapa-num" aria-hidden="true">
                {ie + 1}
              </span>
              <div className="fluxo__etapa-titulo">
                <span className="fluxo__etapa-nome">{e.nome}</span>
                <span className="pequeno mudo">{e.descricao}</span>
              </div>
              {erroDe(`fluxo.${e.id}`).length > 0 && <Badge variant="danger">erro</Badge>}
            </header>
            <div className="fluxo__blocos">
              {blocos.length === 0 && <EmptyState size="sm" variant="dashed" title="Nenhum bloco" description="Esta etapa passa direto." />}
              {blocos.map((b, i) => {
                const info = NOME_BLOCO[b.tipo];
                const erros = erroDe(`fluxo.${e.id}.${i}`);
                const nome = b.rotulo || info.nome;
                return (
                  <Card key={b.id} flat>
                    <CardHeader
                      title={nome}
                      subtitle={resumo(b, cfg)}
                      action={
                        <span className="linha">
                          {erros.length > 0 && <Badge variant="danger">erro</Badge>}
                          <Tag family={FAMILIA[info.categoria]}>{info.nome}</Tag>
                        </span>
                      }
                    />
                    <CardBody>
                      <div className="fluxo__bloco-corpo">
                        {b.quando.length > 0 && (
                          <div className="linha">
                            <span className="pequeno mudo">se</span>
                            {b.quando.map((q, k) => (
                              <Tag key={k}>{textoCondicao(q, cfg)}</Tag>
                            ))}
                          </div>
                        )}
                        {erros.map((x, k) => (
                          <p key={k} className="jornada__erro">
                            {x.erro}
                          </p>
                        ))}
                        <div className="fluxo__acoes">
                          <IconButton label="Subir" size="sm" disabled={i === 0} onClick={() => mover(e.id, i, -1)}>
                            <ChevronUp />
                          </IconButton>
                          <IconButton label="Descer" size="sm" disabled={i === blocos.length - 1} onClick={() => mover(e.id, i, 1)}>
                            <ChevronDown />
                          </IconButton>
                          <span className="espaco" />
                          <Button size="sm" variant="secondary" onClick={() => setEditando({ etapa: e.id, i })}>
                            Editar
                          </Button>
                          <IconButton
                            label="Remover"
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              const ok = await confirmar({
                                title: `Remover o bloco "${nome}"?`,
                                description: 'O bloco sai do rascunho. Nada muda para os hóspedes até você publicar.',
                                confirmLabel: 'Remover',
                                danger: true,
                              });
                              if (ok) setEtapa(e.id, (bs) => bs.filter((_, j) => j !== i));
                            }}
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
              <div>
                <Menu
                  align="start"
                  sheetTitle={`Adicionar bloco em ${e.nome}`}
                  trigger={
                    <Button size="sm" variant="secondary" iconLeft={<Plus />}>
                      Adicionar bloco
                    </Button>
                  }
                  items={e.tipos.map((t) => ({
                    id: t,
                    label: (
                      <span className="fluxo__menu-item">
                        <span>{NOME_BLOCO[t].nome}</span>
                        <span className="fluxo__menu-ajuda">{NOME_BLOCO[t].ajuda}</span>
                      </span>
                    ),
                    onSelect: () => {
                      setEtapa(e.id, (bs) => [...bs, blocoNovo(t)]);
                      setEditando({ etapa: e.id, i: blocos.length });
                    },
                  }))}
                />
              </div>
            </div>
          </section>
        );
      })}
      {editando && blocoEditado && (
        <EditorBloco
          bloco={blocoEditado}
          cfg={cfg}
          aoFechar={() => setEditando(null)}
          aoMudar={(nb) => setEtapa(editando.etapa, (bs) => bs.map((x, j) => (j === editando.i ? nb : x)))}
        />
      )}
      {elementoConfirmar}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edição de um bloco
// ---------------------------------------------------------------------------

function EditorBloco({ bloco, cfg, aoMudar, aoFechar }: { bloco: BlocoFluxo; cfg: ConfigUnidade; aoMudar: (b: BlocoFluxo) => void; aoFechar: () => void }) {
  const set = (patch: Partial<BlocoFluxo>) => aoMudar({ ...bloco, ...patch } as BlocoFluxo);
  const info = NOME_BLOCO[bloco.tipo];
  return (
    <Drawer
      open
      onClose={aoFechar}
      side="right"
      size="md"
      title={info.nome}
      subtitle={info.ajuda}
      footer={<Button onClick={aoFechar}>Pronto</Button>}
    >
      <div className="pilha pilha--larga">
        <Input
          label="Nome do bloco (só aparece aqui)"
          value={bloco.rotulo ?? ''}
          placeholder={info.nome}
          onChange={(e) => set({ rotulo: e.target.value || undefined })}
        />

        {bloco.tipo === 'mensagem' && <EditorConteudo valor={bloco.conteudo} aoMudar={(conteudo) => set({ conteudo })} />}

        {bloco.tipo === 'coletar' && (
          <>
            <Campo nome="Dado">
              <Select
                value={bloco.campo}
                sheetTitle="Dado"
                onChange={(v) => set({ campo: v as typeof bloco.campo })}
                options={CAMPOS.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </Campo>
            <EditorConteudo rotulo="Pergunta" valor={bloco.pergunta} aoMudar={(pergunta) => set({ pergunta })} />
            <Switch label="Esperar a resposta antes de seguir" checked={bloco.bloqueia} onChange={(e) => set({ bloqueia: e.target.checked })} />
            {bloco.bloqueia && (
              <div className="jornada__duas">
                <Input
                  type="number"
                  label="Tentativas"
                  min={1}
                  max={5}
                  value={bloco.tentativas}
                  onChange={(e) => set({ tentativas: Number(e.target.value) })}
                />
                <Campo nome="Se não responder direito">
                  <Select
                    value={bloco.seFalhar}
                    sheetTitle="Se não responder direito"
                    onChange={(v) => set({ seFalhar: v as 'seguir' | 'humano' })}
                    options={[
                      { value: 'seguir', label: 'Seguir sem o dado' },
                      { value: 'humano', label: 'Passar para uma pessoa' },
                    ]}
                  />
                </Campo>
              </div>
            )}
            {bloco.campo === 'quarto_sobrenome' && (
              <Checkbox label="Conferir na lista de hóspedes ativos" checked={bloco.conferir} onChange={(e) => set({ conferir: e.target.checked })} />
            )}
            {bloco.campo === 'cpf' && <AlertaLinha>CPF é dado pessoal: só peça se precisar. A equipe vê mascarado.</AlertaLinha>}
          </>
        )}

        {bloco.tipo === 'decidir_setor' && (
          <Checkbox
            label='Se o pedido for vago ("oi", "preciso de ajuda"), perguntar uma vez antes de encaminhar'
            checked={bloco.perguntarSeVago}
            onChange={(e) => set({ perguntarSeVago: e.target.checked })}
          />
        )}

        {bloco.tipo === 'encaminhar' && (
          <>
            <Campo nome="Para qual fila">
              <Select
                value={bloco.destino}
                sheetTitle="Para qual fila"
                onChange={(v) => set({ destino: v as typeof bloco.destino })}
                options={[
                  { value: 'decidido', label: 'O setor que a IA decidiu (respeita o modo sombra)' },
                  ...cfg.setores.map((s) => ({ value: `setor:${s.chave}`, label: `${s.nome} (sempre)` })),
                ]}
              />
            </Campo>
            <Campo nome="Urgência">
              <Select
                value={bloco.urgencia ?? 'ia'}
                sheetTitle="Urgência"
                onChange={(v) => set({ urgencia: (v === 'ia' ? undefined : v) as typeof bloco.urgencia })}
                options={[
                  { value: 'ia', label: 'A que a IA leu no pedido' },
                  { value: 'rotina', label: 'Rotina' },
                  { value: 'hoje', label: 'Hoje' },
                  { value: 'agora', label: 'Agora' },
                ]}
              />
            </Campo>
            <Checkbox label='Avisar o hóspede ("encaminhado para...")' checked={bloco.avisar} onChange={(e) => set({ avisar: e.target.checked })} />
          </>
        )}

        {bloco.tipo === 'encerrar' && (
          <EditorConteudo
            rotulo="Mensagem antes de encerrar"
            valor={bloco.conteudo ?? { tipo: 'livre', texto: { pt: '', es: '', en: '' } }}
            aoMudar={(conteudo) => set({ conteudo })}
          />
        )}

        {bloco.tipo === 'pesquisa' && (
          <>
            <TresIdiomas rotulo="Pergunta" valor={bloco.pergunta} aoMudar={(pergunta) => set({ pergunta })} />
            <TresIdiomas rotulo="Agradecimento" valor={bloco.agradecimento} aoMudar={(agradecimento) => set({ agradecimento })} />
          </>
        )}

        <EditorCondicoes quando={bloco.quando} cfg={cfg} aoMudar={(quando) => set({ quando })} />
      </div>
    </Drawer>
  );
}

function EditorConteudo({ valor, aoMudar, rotulo = 'Texto' }: { valor: ConteudoTexto; aoMudar: (c: ConteudoTexto) => void; rotulo?: string }) {
  return (
    <Campo nome={rotulo}>
      <div className="pilha">
        <SegmentedControl
          block
          value={valor.tipo}
          onChange={(v) => {
            if (v === valor.tipo) return;
            aoMudar(v === 'fixo' ? { tipo: 'fixo', chave: 'boas_vindas' } : { tipo: 'livre', texto: { pt: '', es: '', en: '' } });
          }}
          options={[
            { value: 'fixo', label: 'Um texto da aba Textos' },
            { value: 'livre', label: 'Escrever aqui' },
          ]}
        />
        {valor.tipo === 'fixo' ? (
          <Select
            value={valor.chave}
            sheetTitle="Texto"
            onChange={(v) => aoMudar({ tipo: 'fixo', chave: v })}
            options={TEXTOS.map((t) => ({ value: t.chave, label: t.nome }))}
          />
        ) : (
          <TresIdiomas valor={valor.texto} aoMudar={(texto) => aoMudar({ tipo: 'livre', texto })} />
        )}
      </div>
    </Campo>
  );
}

function TresIdiomas({
  valor,
  aoMudar,
  rotulo,
}: {
  valor: { pt: string; es: string; en: string };
  aoMudar: (v: { pt: string; es: string; en: string }) => void;
  rotulo?: string;
}) {
  const campos = (
    <div className="pilha">
      {IDIOMAS.map((l) => (
        <Textarea key={l.id} label={l.nome} rows={2} value={valor[l.id]} onChange={(e) => aoMudar({ ...valor, [l.id]: e.target.value })} />
      ))}
    </div>
  );
  return rotulo ? <Campo nome={rotulo}>{campos}</Campo> : campos;
}

function condicaoNova(tipo: TipoCondicao, cfg: ConfigUnidade): Condicao {
  switch (tipo) {
    case 'horario':
      return { tipo, de: '23:00', ate: '07:00', nao: false };
    case 'dia_semana':
      return { tipo, dias: [0, 6], nao: false };
    case 'setor':
      return { tipo, setores: [cfg.setores[0]?.chave ?? 'recepcao'], nao: false };
    case 'idioma':
      return { tipo, idiomas: ['en'], nao: false };
    case 'dado':
      return { tipo, campo: 'reserva', nao: false };
    case 'urgencia':
      return { tipo, niveis: ['agora'], nao: false };
    default:
      return { tipo, nao: false } as Condicao;
  }
}

function EditorCondicoes({ quando, cfg, aoMudar }: { quando: Condicao[]; cfg: ConfigUnidade; aoMudar: (q: Condicao[]) => void }) {
  const set = (i: number, q: Condicao) => aoMudar(quando.map((x, j) => (j === i ? q : x)));
  return (
    <Campo nome="Rodar só quando">
      <div className="pilha">
        {quando.length === 0 && <span className="pequeno mudo">Sem condição: roda sempre.</span>}
        {quando.map((q, i) => (
          <div key={i} className="fluxo__condicao">
            <div className="fluxo__condicao-topo">
              <div>
                <Select
                  value={q.tipo}
                  sheetTitle="Tipo de condição"
                  onChange={(v) => set(i, condicaoNova(v as TipoCondicao, cfg))}
                  options={CONDICOES.map((c) => ({ value: c.tipo, label: c.nome }))}
                />
              </div>
              <Checkbox label="não" title="Inverte a condição" checked={q.nao} onChange={(e) => set(i, { ...q, nao: e.target.checked })} />
              <IconButton label="Remover condição" size="sm" onClick={() => aoMudar(quando.filter((_, j) => j !== i))}>
                <X />
              </IconButton>
            </div>
            <ParametrosCondicao q={q} cfg={cfg} aoMudar={(nq) => set(i, nq)} />
          </div>
        ))}
        <div className="linha">
          <Button size="sm" variant="secondary" iconLeft={<Plus />} onClick={() => aoMudar([...quando, condicaoNova('horario', cfg)])}>
            Condição
          </Button>
          {quando.length > 1 && <span className="pequeno mudo">Todas precisam valer.</span>}
        </div>
      </div>
    </Campo>
  );
}

function Chips<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: { v: T; nome: string }[];
  valor: T[];
  aoMudar: (v: T[]) => void;
}) {
  return (
    <ChipGroup label={rotulo}>
      {opcoes.map((o) => {
        const ativo = valor.includes(o.v);
        return (
          <Tag key={String(o.v)} pressed={ativo} onToggle={() => aoMudar(ativo ? valor.filter((x) => x !== o.v) : [...valor, o.v])}>
            {o.nome}
          </Tag>
        );
      })}
    </ChipGroup>
  );
}

function ParametrosCondicao({ q, cfg, aoMudar }: { q: Condicao; cfg: ConfigUnidade; aoMudar: (q: Condicao) => void }): ReactNode {
  switch (q.tipo) {
    case 'horario':
      return (
        <div className="fluxo__horario">
          <div>
            <Input type="time" aria-label="De" value={q.de} onChange={(e) => aoMudar({ ...q, de: e.target.value })} />
          </div>
          <span className="pequeno mudo">até</span>
          <div>
            <Input type="time" aria-label="Até" value={q.ate} onChange={(e) => aoMudar({ ...q, ate: e.target.value })} />
          </div>
        </div>
      );
    case 'dia_semana':
      return <Chips rotulo="Dias da semana" opcoes={DIAS.map((nome, v) => ({ v, nome }))} valor={q.dias} aoMudar={(dias) => aoMudar({ ...q, dias })} />;
    case 'setor':
      return (
        <Chips
          rotulo="Setores"
          opcoes={cfg.setores.map((s) => ({ v: s.chave, nome: s.nome }))}
          valor={q.setores}
          aoMudar={(setores) => aoMudar({ ...q, setores })}
        />
      );
    case 'idioma':
      return (
        <Chips
          rotulo="Idiomas"
          opcoes={IDIOMAS.map((l) => ({ v: l.id as 'pt' | 'es' | 'en', nome: l.nome }))}
          valor={q.idiomas}
          aoMudar={(idiomas) => aoMudar({ ...q, idiomas })}
        />
      );
    case 'dado':
      return (
        <Select
          value={q.campo}
          sheetTitle="Dado"
          onChange={(v) => aoMudar({ ...q, campo: v })}
          options={CAMPOS.map((c) => ({ value: c.id, label: c.nome }))}
        />
      );
    case 'urgencia':
      return (
        <Chips
          rotulo="Urgência"
          opcoes={[
            { v: 'rotina' as const, nome: 'Rotina' },
            { v: 'hoje' as const, nome: 'Hoje' },
            { v: 'agora' as const, nome: 'Agora' },
          ]}
          valor={q.niveis}
          aoMudar={(niveis) => aoMudar({ ...q, niveis })}
        />
      );
    default:
      return null;
  }
}
