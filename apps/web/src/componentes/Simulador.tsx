import { Badge, Button, Card, ChatBubble, Drawer, EmptyState, Input } from '@healthventureslm/design-system';
import type { ConfigUnidade } from '@ramais/contracts';
import { Bot, FlaskConical, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ESTADO, hora } from '../util';
import { avisar } from './Avisos';

/**
 * Simulador do construtor: você é o hóspede, usando o rascunho que está editando.
 * Para cada mensagem, mostra o que a IA decidiu e por quais blocos o fluxo passou.
 * A conversa de teste nunca vai para a equipe, para a Meta nem para as estatísticas.
 */

type Estado = Awaited<ReturnType<typeof api.admin.simulador>>;
type Evento = NonNullable<Estado['eventos']>[number];

const NOMES: Record<string, string> = {
  mensagem: 'Mensagem',
  coletar: 'Pedir um dado',
  base_conhecimento: 'Responder pela base',
  decidir_setor: 'Decidir o setor',
  encaminhar: 'Encaminhar',
  encerrar: 'Encerrar',
  pesquisa: 'Pesquisa',
};

const RESULTADO: Record<string, string> = {
  seguir: 'rodou',
  pulado: 'pulado (a condição não valeu)',
  aguardar: 'esperando a resposta do hóspede',
  fim: 'terminou a automação',
  respondido: 'resposta aceita',
  resposta_invalida: 'resposta não entendida, perguntou de novo',
  'sem_resposta:seguir': 'sem resposta válida, seguiu sem o dado',
  'sem_resposta:humano': 'sem resposta válida, passou para uma pessoa',
  seguranca: 'nenhum bloco encaminhou: rede de segurança',
};

export function Simulador({ unidadeId, cfg, aoFechar }: { unidadeId: string; cfg: ConfigUnidade; aoFechar: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [texto, setTexto] = useState('');
  const [quarto, setQuarto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recomecando, setRecomecando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    api.admin.simulador(unidadeId).then(setEstado).catch(() => undefined);
  }, [unidadeId]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 1000);
    return () => clearInterval(t);
  }, [carregar]);

  const nMensagens = estado?.mensagens?.length ?? 0;
  useEffect(() => {
    void fim.current?.scrollIntoView({ block: 'end' });
  }, [nMensagens]);

  const nomeBloco = (id: string, tipo: string) => {
    for (const etapa of Object.values(cfg.fluxo)) {
      const b = etapa.find((x) => x.id === id);
      if (b) return b.rotulo || NOMES[b.tipo] || b.tipo;
    }
    return NOMES[tipo] ?? id;
  };

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const primeira = !estado?.conversa || ['encerrada', 'cancelada'].includes(estado.conversa.estado);
      await api.admin.simular(unidadeId, cfg, texto.trim(), primeira && quarto ? quarto : null);
      setTexto('');
      setTimeout(carregar, 300);
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  async function recomecar() {
    setRecomecando(true);
    await api.admin.simuladorReiniciar(unidadeId).catch((e: Error) => avisar(e.message, 'error'));
    setRecomecando(false);
    carregar();
  }

  const conversa = estado?.conversa;
  const mensagens = estado?.mensagens ?? [];
  const eventos = estado?.eventos ?? [];
  // Cada evento vai para a última mensagem do hóspede antes dele.
  const doHospede = mensagens.filter((m) => m.autor === 'solicitante');
  const eventosDe = (id: string) => {
    const i = doHospede.findIndex((m) => m.id === id);
    const ini = new Date(doHospede[i]!.criadoEm).getTime();
    const prox = doHospede[i + 1] ? new Date(doHospede[i + 1]!.criadoEm).getTime() : Infinity;
    return eventos.filter((e) => {
      const t = new Date(e.criado_em).getTime();
      return t >= ini && t < prox;
    });
  };

  return (
    <Drawer
      open
      onClose={aoFechar}
      side="right"
      size="lg"
      icon={<FlaskConical />}
      title="Testar o rascunho"
      subtitle="Você é o hóspede. A conversa usa o rascunho (mesmo sem publicar) e não chega à equipe nem ao WhatsApp."
      footer={
        <div className="simulador__entrada">
          <div className="linha">
            <div className="simulador__quarto">
              <Input aria-label="Simular QR do quarto" placeholder="QR do quarto" inputMode="numeric" value={quarto} onChange={(e) => setQuarto(e.target.value)} />
            </div>
            <span className="pequeno mudo">Simula o QR do quarto, só na primeira mensagem. Ex.: 302</span>
          </div>
          <div className="simulador__envio">
            <Input
              aria-label="Mensagem do hóspede"
              placeholder="Mensagem do hóspede"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void enviar();
              }}
            />
            <Button iconLeft={<Send />} loading={enviando} disabled={!texto.trim()} onClick={enviar}>
              Enviar
            </Button>
          </div>
        </div>
      }
    >
      <div className="simulador">
        <div className="linha">
          <span className="pequeno mudo espaco">Mudou o fluxo? Recomece a conversa para testar do início.</span>
          <Button size="sm" variant="secondary" iconLeft={<RotateCcw />} loading={recomecando} onClick={recomecar}>
            Recomeçar
          </Button>
        </div>

        {conversa && (
          <Card flat padded>
            <div className="simulador__status">
              <Badge variant="neutral" outline>
                <span className="dado">{conversa.versao}</span>
              </Badge>
              <Badge variant="info">{ESTADO[conversa.estado] ?? conversa.estado}</Badge>
              {conversa.setor && <span>fila: {conversa.setor}</span>}
              {conversa.triagem && <span>triagem sugere {conversa.triagem}</span>}
              {Object.keys(conversa.dados).length > 0 && <span className="mudo">dados: {Object.keys(conversa.dados).join(', ')}</span>}
            </div>
          </Card>
        )}

        <div className="simulador__mensagens" aria-live="polite">
          {mensagens.length === 0 && (
            <EmptyState
              size="sm"
              icon={<Bot />}
              title="Nenhuma mensagem ainda"
              description='Escreva como se fosse um hóspede, por exemplo: "o chuveiro está sem água quente".'
            />
          )}
          {mensagens.map((m) => {
            if (m.interna) {
              return (
                <ChatBubble key={m.id} role="system">
                  Nota para a equipe ({hora(m.criadoEm)}): {m.texto}
                </ChatBubble>
              );
            }
            const hospede = m.autor === 'solicitante';
            return (
              <div key={m.id}>
                <ChatBubble
                  role={hospede ? 'user' : 'assistant'}
                  avatar={hospede ? undefined : <Bot />}
                  name={hospede ? 'Você (hóspede)' : m.autor === 'ia' ? 'IA' : 'Hotel'}
                  time={hora(m.criadoEm)}
                >
                  {m.texto}
                </ChatBubble>
                {hospede && <Trilha eventos={eventosDe(m.id)} nomeBloco={nomeBloco} />}
              </div>
            );
          })}
          <div ref={fim} />
        </div>
      </div>
    </Drawer>
  );
}

function Trilha({ eventos, nomeBloco }: { eventos: Evento[]; nomeBloco: (id: string, tipo: string) => string }) {
  if (!eventos.length) {
    return (
      <div className="simulador__trilha">
        <ul className="simulador__trilha-lista">
          <li>processando…</li>
        </ul>
      </div>
    );
  }
  // Ordem de leitura: o que a IA leu, por onde o fluxo passou, e o resultado.
  const ordem = (t: string) => (t === 'decisao_ia' ? 0 : t === 'fluxo' ? 1 : 2);
  const ordenados = [...eventos].sort((a, b) => ordem(a.tipo) - ordem(b.tipo));
  return (
    <div className="simulador__trilha" aria-label="O que o fluxo fez com esta mensagem">
      <ul className="simulador__trilha-lista">
        {ordenados.map((e, i) => {
          switch (e.tipo) {
            case 'decisao_ia': {
              const d = e.dados;
              return (
                <li key={i}>
                  IA leu: <strong>{d.setor}</strong>
                  {typeof d.confianca === 'number' && <span className="dado"> ({Math.round(d.confianca * 100)}%)</span>}
                  {d.gatilho && (
                    <>
                      {' '}
                      · gatilho <strong>{d.gatilho}</strong>
                    </>
                  )}
                  <span> · {String(d.motor ?? '').split(':').slice(0, 2).join(':')}</span>
                </li>
              );
            }
            case 'fluxo':
              return (e.dados.trilha as { bloco: string; tipo: string; r: string }[]).map((t, k) => {
                const r =
                  t.tipo === 'base_conhecimento' && t.r === 'seguir'
                    ? 'a base não cobria, seguiu'
                    : t.tipo === 'decidir_setor' && t.r === 'seguir'
                      ? 'setor decidido'
                      : (RESULTADO[t.r] ?? t.r);
                return (
                  <li key={`${i}-${k}`} className={t.r === 'pulado' ? 'pulado' : undefined}>
                    <strong>{nomeBloco(t.bloco, t.tipo)}</strong>: {r}
                  </li>
                );
              });
            case 'encaminhada':
            case 'transferida':
            case 'reaberta':
              return <li key={i}>Foi para a fila ({String(e.dados.motivo ?? '').replace('sombra:', 'sombra · ')})</li>;
            case 'resposta_automatica':
              return <li key={i}>Respondido pela base de conhecimento</li>;
            case 'dado_coletado':
              return <li key={i}>Dado registrado: {e.dados.campo}</li>;
            case 'identificado':
              return <li key={i}>Hóspede identificado</li>;
            case 'vinculo_qr':
              return <li key={i}>Quarto reconhecido pelo QR</li>;
            case 'encerrada_pelo_fluxo':
              return <li key={i}>Encerrada pelo fluxo</li>;
            case 'pesquisa_respondida':
              return <li key={i}>Nota da pesquisa: {e.dados.nota}</li>;
            case 'resolvida':
              return <li key={i}>Resolvida</li>;
            case 'cancelada':
              return <li key={i}>Encerrada</li>;
            default:
              return null;
          }
        })}
      </ul>
    </div>
  );
}
