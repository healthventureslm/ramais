import {
  Accordion,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  Timeline,
} from '@healthventureslm/design-system';
import { Escada as EscadaSchema, type AlvoAviso, type ConfigUnidade, type DegrauAviso, type Escada } from '@ramais/contracts';
import { Plus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, type PessoaEquipe } from '../api';
import type { EditorProps } from './Jornada';

const PADRAO: Escada = EscadaSchema.parse({});

/** Minutos com vírgula e sem casas inúteis: 2 vira "2", 0.5 vira "0,5". */
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * Escada de escalonamento: o que acontece enquanto o hóspede espera a equipe.
 * Uma escada padrão para a unidade e, se quiser, uma própria por setor.
 */
export function EscadaEditor({ cfg, mudar, erroDe, unidadeId }: EditorProps) {
  const [pessoas, setPessoas] = useState<PessoaEquipe[]>([]);
  useEffect(() => {
    api.admin
      .pessoas(unidadeId)
      .then((l) => setPessoas(l.filter((p) => p.ativo)))
      .catch(() => undefined);
  }, [unidadeId]);
  const padrao = cfg.escalonamento ?? PADRAO;

  return (
    <div className="pilha pilha--larga">
      <Card>
        <CardHeader title="Como funciona" />
        <CardBody>
          <p className="mudo" style={{ margin: 0 }}>
            A <strong>espera</strong> começa quando o pedido entra na fila de um setor, ou quando o hóspede escreve e a conversa já tem
            responsável. Termina quando alguém da equipe responde. Passar a conversa para outra pessoa do mesmo setor não zera a espera: os
            avisos continuam contando.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Escada padrão da unidade" subtitle="Vale para todos os setores sem escada própria." />
        <CardBody>
          <EditorDeEscada
            escada={padrao}
            setorDoPedido={null}
            cfg={cfg}
            pessoas={pessoas}
            erros={erroDe('escalonamento')}
            aoMudar={(e) => mudar((c) => ({ ...c, escalonamento: e }))}
          />
        </CardBody>
      </Card>

      <div className="pilha">
        <span className="jornada__rotulo">Por setor</span>
        <Accordion
          items={cfg.setores.map((s, i) => {
            const propria = Boolean(s.escalonamento);
            const erros = erroDe(`setores.${i}.escalonamento`);
            return {
              id: s.chave,
              title: s.nome,
              subtitle: resumo(s.escalonamento ?? padrao, cfg, s.chave),
              meta: (
                <span className="linha">
                  {erros.length > 0 && <Badge variant="danger">{erros.length} erro(s)</Badge>}
                  <Badge variant={propria ? 'brand' : 'neutral'}>{propria ? 'Própria' : 'Padrão'}</Badge>
                </span>
              ),
              content: (
                <div className="pilha pilha--larga">
                  <div>
                    <SegmentedControl
                      value={propria ? 'propria' : 'padrao'}
                      options={[
                        { value: 'padrao', label: 'Usa o padrão' },
                        { value: 'propria', label: 'Própria' },
                      ]}
                      onChange={(v) => {
                        if (v === 'padrao') {
                          mudar((c) => ({ ...c, setores: c.setores.map((x, j) => (j === i ? { ...x, escalonamento: undefined } : x)) }));
                        } else if (!propria) {
                          mudar((c) => ({
                            ...c,
                            setores: c.setores.map((x, j) => (j === i ? { ...x, escalonamento: structuredClone(c.escalonamento ?? PADRAO) } : x)),
                          }));
                        }
                      }}
                    />
                  </div>
                  {propria ? (
                    <EditorDeEscada
                      escada={s.escalonamento!}
                      setorDoPedido={s.chave}
                      cfg={cfg}
                      pessoas={pessoas}
                      erros={erros}
                      aoMudar={(e) => mudar((c) => ({ ...c, setores: c.setores.map((x, j) => (j === i ? { ...x, escalonamento: e } : x)) }))}
                    />
                  ) : (
                    <span className="pequeno mudo">Este setor segue a escada padrão da unidade. Escolha Própria para mudar só aqui.</span>
                  )}
                </div>
              ),
            };
          })}
        />
      </div>
    </div>
  );
}

function nomeDoAlvo(a: AlvoAviso, cfg: ConfigUnidade, setorDoPedido: string | null): string {
  const setor = (ch?: string) => cfg.setores.find((s) => s.chave === ch)?.nome ?? ch;
  if (a.tipo === 'pessoa') return a.nome ?? 'pessoa';
  if (a.tipo === 'gerentes') return 'gerentes';
  if (a.tipo === 'turno') return `quem está no turno da ${setor(a.setor)}`;
  return a.setor ? `supervisores da ${setor(a.setor)}` : setorDoPedido ? `supervisores da ${setor(setorDoPedido)}` : 'supervisores do setor';
}

/** Uma linha: "oferta 60 s · lembra em 2 min · passa adiante em 5 min · 3 min: supervisores…". */
function resumo(e: Escada, cfg: ConfigUnidade, setor: string): string {
  const partes = [`oferta de ${e.ofertaSegundos} s`];
  if (e.lembrarMin > 0) partes.push(`lembra o responsável em ${fmt(e.lembrarMin)} min`);
  if (e.repassarMin > 0) partes.push(`passa adiante em ${fmt(e.repassarMin)} min`);
  for (const a of [...e.avisos].sort((x, y) => x.aposMin - y.aposMin)) {
    partes.push(`${fmt(a.aposMin)} min: ${nomeDoAlvo(a.alvo, cfg, setor)}${a.foraDoTurno ? ' (mesmo fora do turno)' : ''}`);
  }
  return partes.join(' · ');
}

function EditorDeEscada({
  escada,
  setorDoPedido,
  cfg,
  pessoas,
  erros,
  aoMudar,
}: {
  escada: Escada;
  setorDoPedido: string | null;
  cfg: ConfigUnidade;
  pessoas: PessoaEquipe[];
  erros: { campo: string; erro: string }[];
  aoMudar: (e: Escada) => void;
}) {
  const set = <K extends keyof Escada>(k: K, v: Escada[K]) => aoMudar({ ...escada, [k]: v });
  const setAviso = (i: number, a: DegrauAviso) => set('avisos', escada.avisos.map((x, j) => (j === i ? a : x)));
  const ordenar = () => set('avisos', [...escada.avisos].sort((a, b) => a.aposMin - b.aposMin));

  // Linha do tempo para conferir de olho.
  const eventos = [
    ...escada.avisos.map((a) => ({
      min: a.aposMin,
      texto: `Avisa ${nomeDoAlvo(a.alvo, cfg, setorDoPedido)}`,
      detalhe: a.foraDoTurno ? 'Mesmo fora do turno' : undefined,
      status: 'warning' as const,
    })),
    ...(escada.avisoSolicitanteMin > 0
      ? [{ min: escada.avisoSolicitanteMin, texto: 'Avisa o hóspede que está demorando', detalhe: undefined, status: 'info' as const }]
      : []),
  ].sort((a, b) => a.min - b.min);

  return (
    <div className="pilha pilha--larga">
      {erros.length > 0 && (
        <div className="pilha" style={{ gap: 'var(--space-1)' }}>
          {erros.map((e, i) => (
            <p key={i} className="jornada__erro">
              {e.erro}
            </p>
          ))}
        </div>
      )}

      <div>
        <h3 className="escada__secao">Ninguém aceitou</h3>
        <LinhaNum rotulo="Cada oferta dura" ajuda="Sem aceite, vai para a próxima pessoa do setor, em rodízio." unidade="segundos">
          <Num rotulo="Cada oferta dura" valor={escada.ofertaSegundos} min={10} passo={5} aoMudar={(n) => set('ofertaSegundos', n)} />
        </LinhaNum>
      </div>

      <div>
        <h3 className="escada__secao">Aceitou e não respondeu o hóspede</h3>
        <LinhaNum rotulo="Lembrar quem está com a conversa depois de" ajuda="0 = não lembra. Conta de quando a pessoa pegou a conversa." unidade="min">
          <Num rotulo="Lembrar depois de" valor={escada.lembrarMin} min={0} passo={0.5} aoMudar={(n) => set('lembrarMin', n)} />
        </LinhaNum>
        <LinhaNum
          rotulo="Passar para a próxima pessoa do setor depois de"
          ajuda="0 = nunca. Quem não respondeu não recebe essa conversa de novo; a próxima pessoa tem o próprio prazo."
          unidade="min"
        >
          <Num rotulo="Passar adiante depois de" valor={escada.repassarMin} min={0} passo={0.5} aoMudar={(n) => set('repassarMin', n)} />
        </LinhaNum>
      </div>

      <div className="pilha">
        <h3 className="escada__secao">Avisos enquanto o hóspede espera</h3>
        <span className="pequeno mudo">
          Contam do início da espera, com ou sem alguém aceitar. Use para chamar supervisor, depois outro, depois a gerência.
        </span>
        {escada.avisos.map((a, i) => (
          <div key={i} className="escada__degrau">
            <div className="escada__degrau-linha">
              <Badge>{i + 1}</Badge>
              <span className="pequeno">Depois de</span>
              <Num rotulo={`Minutos do aviso ${i + 1}`} valor={a.aposMin} min={0.5} passo={0.5} aoMudar={(n) => setAviso(i, { ...a, aposMin: n })} aoSair={ordenar} />
              <span className="pequeno">min, avisar</span>
              <span className="espaco" />
              <IconButton label={`Remover aviso ${i + 1}`} size="sm" onClick={() => set('avisos', escada.avisos.filter((_, j) => j !== i))}>
                <X />
              </IconButton>
            </div>
            <div className="escada__degrau-linha">
              <div className="escada__degrau-alvo">
                <SeletorAlvo alvo={a.alvo} cfg={cfg} pessoas={pessoas} aoMudar={(alvo) => setAviso(i, { ...a, alvo })} />
              </div>
              <Checkbox
                label="mesmo fora do turno"
                title="Chega no celular em que a pessoa entrou por último, mesmo fora do turno"
                checked={a.foraDoTurno}
                onChange={(e) => setAviso(i, { ...a, foraDoTurno: e.target.checked })}
              />
            </div>
          </div>
        ))}
        {escada.avisos.length < 10 && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Plus />}
              onClick={() => {
                const ultimo = escada.avisos.at(-1)?.aposMin ?? 0;
                set('avisos', [...escada.avisos, { aposMin: ultimo + 5, alvo: { tipo: 'supervisores' }, foraDoTurno: false }]);
              }}
            >
              Adicionar aviso
            </Button>
          </div>
        )}
        <LinhaNum rotulo="Avisar o hóspede que está demorando depois de" ajuda="0 = não avisa. Uma vez por espera." unidade="min">
          <Num rotulo="Avisar o hóspede depois de" valor={escada.avisoSolicitanteMin} min={0} passo={0.5} aoMudar={(n) => set('avisoSolicitanteMin', n)} />
        </LinhaNum>
      </div>

      {eventos.length > 0 && (
        <div className="pilha" aria-label="Linha do tempo da espera">
          <h3 className="escada__secao">Linha do tempo</h3>
          <Timeline
            size="sm"
            items={[
              {
                id: 'inicio',
                time: '0 min',
                title: 'Pedido na fila',
                description: `Oferece a uma pessoa do setor (${escada.ofertaSegundos} s cada)`,
                status: 'primary',
              },
              ...eventos.map((e, i) => ({ id: i, time: `${fmt(e.min)} min`, title: e.texto, description: e.detalhe, status: e.status })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

function SeletorAlvo({ alvo, cfg, pessoas, aoMudar }: { alvo: AlvoAviso; cfg: ConfigUnidade; pessoas: PessoaEquipe[]; aoMudar: (a: AlvoAviso) => void }) {
  // Um select só, com rótulos claros: mais rápido que escolher tipo e depois o alvo.
  const valor =
    alvo.tipo === 'pessoa' ? `p:${alvo.pessoaId}` : alvo.tipo === 'turno' ? `t:${alvo.setor}` : alvo.tipo === 'gerentes' ? 'g:' : `s:${alvo.setor ?? ''}`;
  const pessoaSumiu = alvo.tipo === 'pessoa' && !pessoas.some((p) => p.id === alvo.pessoaId);
  const opcoes = [
    { value: 's:', label: 'Supervisores do setor do pedido' },
    { value: 'g:', label: 'Gerentes' },
    ...cfg.setores.map((s) => ({ value: `s:${s.chave}`, label: `Supervisores de ${s.nome}` })),
    ...cfg.setores.map((s) => ({ value: `t:${s.chave}`, label: `Todos no turno de ${s.nome}` })),
    ...(pessoaSumiu ? [{ value: valor, label: `Pessoa: ${(alvo as { nome?: string }).nome ?? 'pessoa'} (desativada)` }] : []),
    ...pessoas.map((p) => ({ value: `p:${p.id}`, label: `Pessoa: ${p.nome}` })),
  ];
  return (
    <Select
      value={valor}
      sheetTitle="Quem avisar"
      options={opcoes}
      onChange={(v) => {
        const [t, id] = [v.slice(0, 1), v.slice(2)];
        if (t === 'p') aoMudar({ tipo: 'pessoa', pessoaId: id, nome: pessoas.find((p) => p.id === id)?.nome });
        else if (t === 't') aoMudar({ tipo: 'turno', setor: id });
        else if (t === 'g') aoMudar({ tipo: 'gerentes' });
        else aoMudar(id ? { tipo: 'supervisores', setor: id } : { tipo: 'supervisores' });
      }}
    />
  );
}

function LinhaNum({ rotulo, ajuda, unidade, children }: { rotulo: string; ajuda?: string; unidade: string; children: ReactNode }) {
  return (
    <div className="jornada__config">
      <div className="jornada__config-texto">
        <span className="jornada__config-rotulo">{rotulo}</span>
        {ajuda && <span className="pequeno mudo">{ajuda}</span>}
      </div>
      <div className="jornada__numero">
        {children}
        <span className="pequeno mudo">{unidade}</span>
      </div>
    </div>
  );
}

function Num({
  rotulo,
  valor,
  aoMudar,
  aoSair,
  min,
  passo,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (n: number) => void;
  aoSair?: () => void;
  min: number;
  passo: number;
}) {
  return (
    <div className="jornada__numero-campo">
      <Input
        type="number"
        inputMode="decimal"
        aria-label={rotulo}
        value={valor}
        min={min}
        step={passo}
        onChange={(e) => aoMudar(Math.max(min, Number(e.target.value) || 0))}
        onBlur={aoSair}
      />
    </div>
  );
}
