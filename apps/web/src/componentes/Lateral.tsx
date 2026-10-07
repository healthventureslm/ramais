import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, Input, ListGroup, ListItem, Select, StatusDot, Textarea, useConfirm } from '@healthventureslm/design-system';
import type { Sessao, SolicitacaoDetalhe } from '@ramais/contracts';
import { ArrowLeft, ArrowRightLeft, CheckCircle2, Hand, LifeBuoy, Sparkles, UserRoundCheck, XCircle } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { api, type LocalBusca, type Setor } from '../api';
import { desde, ESTADO, supervisiona } from '../util';
import { avisar } from './Avisos';
import { Chaveiro, Estado, situacao } from './ui';

/** Detalhes e ações do atendimento, em cartões do DS. Coluna à direita no computador, gaveta no celular. */
export function Lateral({
  detalhe: d,
  sessao,
  unidadeId,
  aoMudar,
  aoAbrir,
}: {
  detalhe: SolicitacaoDetalhe;
  sessao: Sessao;
  unidadeId: string;
  aoMudar: () => void;
  aoAbrir: (id: string | null) => void;
}) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [modal, setModal] = useState<'transferir' | 'apoio' | 'local' | null>(null);
  const [confirmar, confirmacao] = useConfirm();
  useEffect(() => {
    api.setores(unidadeId).then(setSetores).catch(() => undefined);
  }, [unidadeId]);

  const souResponsavel = d.responsavel?.id === sessao.pessoa.id;
  const supervisor = supervisiona(sessao, d.setor?.id);
  const naFila = d.estado === 'na_fila' || d.estado === 'oferecida';
  const aberta = ['em_atendimento', 'aguardando_solicitante'].includes(d.estado);

  const acao = (fn: () => Promise<unknown>, ok?: string) => async () => {
    try {
      await fn();
      if (ok) avisar(ok, 'success');
      aoMudar();
    } catch (e) {
      avisar((e as Error).message, 'error');
    }
  };

  return (
    <>
      {d.triagem && (
        <Triagem
          detalhe={d}
          setores={setores}
          aoMudar={aoMudar}
          aoEncaminhar={(setorId) => {
            // Saiu do meu setor: fecha o atendimento em vez de tentar recarregar.
            if (setorId !== d.setor?.id) aoAbrir(null);
          }}
        />
      )}

      <Card>
        <CardHeader title="Situação" action={<Estado estado={d.estado} />} />
        <CardBody>
          <dl className="pares">
            <dt>Setor</dt>
            <dd className="linha">
              {d.setor?.nome ?? '—'}
              {d.baixaCerteza && (
                <Badge variant="warning" outline>
                  IA em dúvida
                </Badge>
              )}
            </dd>
            <dt>Com</dt>
            <dd>{d.responsavel?.nome ?? 'ninguém ainda'}</dd>
            <dt>Urgência</dt>
            <dd>
              {d.urgencia === 'agora' ? <Badge variant="danger">Agora</Badge> : d.urgencia === 'hoje' ? <Badge variant="warning">Hoje</Badge> : 'Rotina'}
            </dd>
            {d.entrouFilaEm && naFila && (
              <>
                <dt>Esperando</dt>
                <dd className="dado">{desde(d.entrouFilaEm)}</dd>
              </>
            )}
            {d.ultimaDecisao && (
              <>
                <dt>IA</dt>
                <dd>
                  {d.ultimaDecisao.setorPrevisto}
                  {d.ultimaDecisao.confianca !== null && <span className="dado"> · {Math.round(d.ultimaDecisao.confianca * 100)}%</span>}
                  <div className="pequeno mudo">{d.ultimaDecisao.motor}</div>
                </dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ações" />
        <CardBody>
          <div className="pilha">
            {naFila && (supervisor || sessao.setores.some((s) => s.id === d.setor?.id)) && (
              <Button block iconLeft={<Hand />} onClick={acao(() => api.pegar(d.id), 'Atendimento é seu.')}>
                Pegar atendimento
              </Button>
            )}
            {aberta && supervisor && !souResponsavel && d.responsavel && (
              <Button
                block
                iconLeft={<UserRoundCheck />}
                onClick={async () => {
                  const ok = await confirmar({
                    title: `Assumir o atendimento de ${d.responsavel!.nome}?`,
                    description: 'A conversa passa para você agora. A pessoa é avisada e a troca fica registrada no histórico.',
                    confirmLabel: 'Assumir',
                  });
                  if (ok) await acao(() => api.assumir(d.id), 'Atendimento é seu.')();
                }}
              >
                Assumir atendimento
              </Button>
            )}
            {aberta && (souResponsavel || supervisor) && (
              <Button block variant={souResponsavel ? 'primary' : 'secondary'} iconLeft={<CheckCircle2 />} onClick={acao(() => api.resolver(d.id), 'Marcado como resolvido.')}>
                Resolver
              </Button>
            )}
            <Button
              block
              variant="secondary"
              iconLeft={<ArrowRightLeft />}
              onClick={() => setModal('transferir')}
              disabled={!(souResponsavel || supervisor || naFila || d.estado === 'automacao')}
            >
              Transferir de setor
            </Button>
            {d.origem === 'externa' && (
              <Button block variant="secondary" iconLeft={<LifeBuoy />} onClick={() => setModal('apoio')} disabled={!aberta && !naFila}>
                Pedir apoio a outro setor
              </Button>
            )}
            {(aberta || d.estado === 'resolvida') && (souResponsavel || supervisor) && (
              <Button block variant="ghost" iconLeft={<XCircle />} onClick={acao(() => api.encerrar(d.id))}>
                Encerrar
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {d.origem === 'externa' && (
        <Card>
          <CardHeader
            title="Hóspede"
            action={
              !d.local?.confirmado && (
                <Button size="sm" variant="secondary" onClick={() => setModal('local')}>
                  Confirmar quarto
                </Button>
              )
            }
          />
          <CardBody>
            <dl className="pares">
              <dt>Quarto</dt>
              <dd className="linha">
                {d.local ? (
                  <>
                    <Chaveiro numero={d.local.identificador} pendente={!d.local.confirmado} />
                    <span className="pequeno mudo">{d.local.confirmado ? 'confirmado' : 'pelo QR, falta confirmar'}</span>
                  </>
                ) : (
                  'não identificado'
                )}
              </dd>
              {d.dadosColetados.map((x) => (
                <Fragment key={x.campo}>
                  <dt>{x.rotulo}</dt>
                  <dd className="dado">{x.valor}</dd>
                </Fragment>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}

      {d.filhos.length > 0 && (
        <ListGroup label="Pedidos de apoio">
          {d.filhos.map((f) => (
            <ListItem
              key={f.id}
              onClick={() => aoAbrir(f.id)}
              title={f.setor?.nome}
              subtitle={f.resumo}
              meta={<StatusDot status={situacao(f.estado)}>{ESTADO[f.estado]}</StatusDot>}
            />
          ))}
        </ListGroup>
      )}
      {d.paiId && (
        <Button variant="ghost" iconLeft={<ArrowLeft />} onClick={() => aoAbrir(d.paiId!)}>
          Abrir o atendimento de origem
        </Button>
      )}

      <ModalTransferir
        open={modal === 'transferir'}
        setores={setores.filter((s) => s.id !== d.setor?.id)}
        sugerirCorrecao={Boolean(d.ultimaDecisao)}
        aoFechar={() => setModal(null)}
        aoConfirmar={async (setorId, motivo, correcao) => {
          await acao(() => api.transferir(d.id, { setorId, motivo: motivo || undefined, correcao }), 'Transferido.')();
          setModal(null);
        }}
      />
      <ModalApoio
        open={modal === 'apoio'}
        setores={setores.filter((s) => s.id !== d.setor?.id)}
        quarto={d.local?.identificador ?? null}
        aoFechar={() => setModal(null)}
        aoConfirmar={async (setorId, texto, urgente) => {
          await acao(() => api.apoio(d.id, { setorId, texto, urgencia: urgente ? 'agora' : 'rotina' }), 'Pedido de apoio criado.')();
          setModal(null);
        }}
      />
      <ModalLocal
        open={modal === 'local'}
        unidadeId={unidadeId}
        aoFechar={() => setModal(null)}
        aoConfirmar={async (localId) => {
          await acao(() => api.confirmarLocal(d.id, localId), 'Quarto confirmado.')();
          setModal(null);
        }}
      />
      {confirmacao}
    </>
  );
}

/**
 * Modo sombra: a IA sugeriu um setor que ainda não está liberado para o automático.
 * Confirmar manda o pedido para lá; escolher outro registra a correção (calibra a IA).
 */
function Triagem({
  detalhe: d,
  setores,
  aoMudar,
  aoEncaminhar,
}: {
  detalhe: SolicitacaoDetalhe;
  setores: Setor[];
  aoMudar: () => void;
  aoEncaminhar: (setorId: string) => void;
}) {
  const t = d.triagem!;
  const [outro, setOutro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const mover = async (setorId: string, msg: string) => {
    setEnviando(true);
    try {
      await api.triar(d.id, setorId);
      avisar(msg, 'success');
      aoEncaminhar(setorId);
      aoMudar();
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Card accent>
      <CardHeader
        title={`A IA sugere ${t.setorSugerido.nome}`}
        subtitle={t.confianca !== null ? `${Math.round(t.confianca * 100)}% de certeza` : undefined}
        action={<Sparkles />}
      />
      <CardBody>
        <div className="pilha">
          <Button block loading={enviando} onClick={() => mover(t.setorSugerido.id, `Encaminhado para ${t.setorSugerido.nome}.`)}>
            Confirmar e encaminhar
          </Button>
          <div className="linha" style={{ flexWrap: 'nowrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                value={outro}
                onChange={setOutro}
                placeholder="Outro setor…"
                sheetTitle="Mover para"
                options={setores
                  .filter((s) => s.id !== t.setorSugerido.id)
                  .map((s) => ({ value: s.id, label: `${s.nome}${s.id === d.setor?.id ? ' (fica aqui)' : ''}` }))}
              />
            </div>
            <Button variant="secondary" disabled={!outro || enviando} onClick={() => mover(outro, 'Corrigido. A IA vai aprender com isso.')}>
              Mover
            </Button>
          </div>
          <span className="pequeno mudo">Cada confirmação ou correção conta para liberar o setor no automático.</span>
        </div>
      </CardBody>
    </Card>
  );
}

function ModalTransferir({
  open,
  setores,
  sugerirCorrecao,
  aoFechar,
  aoConfirmar,
}: {
  open: boolean;
  setores: Setor[];
  sugerirCorrecao: boolean;
  aoFechar: () => void;
  aoConfirmar: (setorId: string, motivo: string, correcao: boolean) => void;
}) {
  const [setorId, setSetorId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [correcao, setCorrecao] = useState(sugerirCorrecao);
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      title="Transferir de setor"
      description="O pedido sai da sua fila e vai para a do outro setor."
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button disabled={!setorId} onClick={() => aoConfirmar(setorId, motivo, correcao)}>
            Transferir
          </Button>
        </>
      }
    >
      <div className="pilha pilha--larga">
        <div className="pilha" style={{ gap: 'var(--space-1)' }}>
          <span className="pequeno" style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
            Setor de destino
          </span>
          <Select value={setorId} onChange={setSetorId} sheetTitle="Setor de destino" options={setores.map((s) => ({ value: s.id, label: `${s.nome} · ${s.emTurno} no turno` }))} />
        </div>
        <Input label="Motivo" hint="Opcional. Vira nota interna." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {sugerirCorrecao && <Checkbox label="A IA errou o setor" description="Usado para calibrar a IA." checked={correcao} onChange={(e) => setCorrecao(e.target.checked)} />}
      </div>
    </Dialog>
  );
}

function ModalApoio({
  open,
  setores,
  quarto,
  aoFechar,
  aoConfirmar,
}: {
  open: boolean;
  setores: Setor[];
  quarto: string | null;
  aoFechar: () => void;
  aoConfirmar: (setorId: string, texto: string, urgente: boolean) => void;
}) {
  const [setorId, setSetorId] = useState('');
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      title="Pedir apoio sem transferir"
      description={`Você continua com o atendimento. O outro setor recebe só o necessário${quarto ? ` (quarto ${quarto})` : ''}, sem o nome do hóspede nem a conversa.`}
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button disabled={!setorId || texto.trim().length < 3} onClick={() => aoConfirmar(setorId, texto.trim(), urgente)}>
            Criar pedido
          </Button>
        </>
      }
    >
      <div className="pilha pilha--larga">
        <Select value={setorId} onChange={setSetorId} placeholder="Para qual setor?" sheetTitle="Setor" options={setores.map((s) => ({ value: s.id, label: s.nome }))} />
        <Textarea label="O que precisa" rows={3} placeholder="Ex.: ar pingando, secar o chão" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Checkbox label="Urgente" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
      </div>
    </Dialog>
  );
}

function ModalLocal({ open, unidadeId, aoFechar, aoConfirmar }: { open: boolean; unidadeId: string; aoFechar: () => void; aoConfirmar: (localId: string) => void }) {
  const [busca, setBusca] = useState('');
  const [locais, setLocais] = useState<LocalBusca[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => api.locais(unidadeId, busca).then(setLocais).catch(() => undefined), 200);
    return () => clearTimeout(t);
  }, [busca, unidadeId, open]);
  return (
    <Dialog open={open} onClose={aoFechar} title="Confirmar quarto do hóspede" size="sm">
      <div className="pilha pilha--larga">
        <Input label="Número do quarto" inputMode="numeric" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} />
        <ListGroup plain>
          {locais.map((l) => (
            <ListItem
              key={l.id}
              onClick={() => aoConfirmar(l.id)}
              media={<Chaveiro numero={l.identificador} />}
              title={`Quarto ${l.identificador}`}
              subtitle={l.hospede ? `Hóspede: ${l.hospede}` : 'Sem hóspede ativo'}
            />
          ))}
        </ListGroup>
      </div>
    </Dialog>
  );
}
