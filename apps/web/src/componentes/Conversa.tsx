import { Banner, Button, ChatBubble, IconButton, SegmentedControl, Textarea, useConfirm } from '@healthventureslm/design-system';
import type { MensagemView, Sessao, SolicitacaoDetalhe } from '@ramais/contracts';
import { ArrowLeft, Bot, PanelRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { hora, nomeIdioma, telefone } from '../util';
import { avisar } from './Avisos';
import { AnexarMidia, MidiaMensagem } from './Midia';
import { Chaveiro, Recado } from './ui';

const iniciais = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/**
 * Conversa com o hóspede no chat do DS: o hóspede à esquerda, a equipe à direita.
 * A equipe lê em português; o original fica a um toque. Nota interna é o recado amarelo.
 * Foto e áudio em qualquer lado; o áudio aparece com a transcrição embaixo.
 */
export function Conversa({
  detalhe,
  sessao,
  aoVoltar,
  aoMudar,
  aoDetalhes,
}: {
  detalhe: SolicitacaoDetalhe;
  sessao: Sessao;
  aoVoltar: () => void;
  aoMudar: () => void;
  aoDetalhes: () => void;
}) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void fim.current?.scrollIntoView({ block: 'end' });
  }, [detalhe.mensagens.length]);

  const titulo = detalhe.origem === 'interna' ? `Pedido de apoio · ${detalhe.setor?.nome ?? ''}` : detalhe.solicitante?.nome ?? 'Hóspede';
  const subtitulo = [
    detalhe.origem === 'externa' && detalhe.solicitante ? telefone(detalhe.solicitante.telefone) : null,
    detalhe.idioma !== 'pt' ? `escreve em ${nomeIdioma(detalhe.idioma)}` : null,
    detalhe.setor?.nome ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="conversa" aria-label="Conversa">
      <header className="conversa__cabeca">
        <span className="so-celular">
          <IconButton label="Voltar para a lista" onClick={aoVoltar}>
            <ArrowLeft />
          </IconButton>
        </span>
        {detalhe.local && <Chaveiro numero={detalhe.local.identificador} pendente={!detalhe.local.confirmado} grande />}
        <div className="conversa__quem">
          <strong>{titulo}</strong>
          {subtitulo && <span className="dado">{subtitulo}</span>}
        </div>
        <span className="so-estreito">
          <Button variant="secondary" size="sm" iconLeft={<PanelRight />} onClick={aoDetalhes}>
            Detalhes
          </Button>
        </span>
      </header>
      <div className="conversa__mensagens">
        {detalhe.mensagens.map((m) => (
          <Mensagem key={m.id} m={m} nomeHospede={detalhe.solicitante?.nome ?? 'Hóspede'} idiomaHospede={detalhe.idioma} />
        ))}
        <div ref={fim} />
      </div>
      <Compositor detalhe={detalhe} sessao={sessao} aoEnviar={aoMudar} />
    </section>
  );
}

const STATUS: Record<string, string> = {
  pendente: 'enviando',
  enviada: 'enviada',
  entregue: 'entregue',
  lida: 'lida',
  falhou: 'não entregue',
};

function Mensagem({ m, nomeHospede, idiomaHospede }: { m: MensagemView; nomeHospede: string; idiomaHospede: string }) {
  const [verOriginal, setVerOriginal] = useState(false);
  const midia = (alt: string) => (
    <MidiaMensagem tipo={m.tipo} url={m.midiaUrl} transcricao={m.transcricao} criadoEm={m.criadoEm} alt={alt} carregar={api.midia} />
  );

  if (m.visibilidade === 'interna') {
    return (
      <Recado autor={m.autorNome ?? 'sistema'} hora={hora(m.criadoEm)}>
        {m.tipo !== 'texto' && midia('Foto da nota interna')}
        {m.texto}
      </Recado>
    );
  }

  const doHospede = m.autorTipo === 'solicitante';
  // Entrada: mostra a tradução em português; o original a um toque. Saída: o que a equipe escreveu.
  const principal = doHospede && m.traducao && !verOriginal ? m.traducao : m.texto;
  const automatica = m.autorTipo === 'ia' || m.autorTipo === 'sistema';
  const nome = doHospede ? nomeHospede : automatica ? (m.autorTipo === 'ia' ? 'Resposta automática' : 'Mensagem automática') : m.autorNome ?? 'Equipe';
  const status = !doHospede ? STATUS[m.statusEnvio] : null;

  return (
    <ChatBubble
      role={doHospede ? 'assistant' : 'user'}
      avatar={automatica ? <Bot /> : iniciais(nome)}
      name={nome}
      time={
        <span className="dado">
          {hora(m.criadoEm)}
          {status ? ` · ${status}` : ''}
        </span>
      }
    >
      {m.tipo !== 'texto' && midia(m.descricao ?? (doHospede ? 'Foto enviada pelo hóspede' : 'Foto enviada pela equipe'))}
      {principal && (
        <div style={{ whiteSpace: 'pre-wrap' }} className={m.tipo === 'audio' ? 'conversa__traducao' : undefined}>
          {m.tipo === 'audio' ? `Em português: ${principal}` : principal}
        </div>
      )}
      {m.descricao && <div className="conversa__traducao">Foto: {m.descricao}</div>}
      {doHospede && m.traducao && (
        <div className="conversa__traducao">
          {verOriginal ? 'Original. ' : `Traduzido do ${nomeIdioma(m.idioma)}. `}
          <Button variant="quiet" size="sm" onClick={() => setVerOriginal((v) => !v)}>
            {verOriginal ? 'Ver tradução' : 'Ver original'}
          </Button>
        </div>
      )}
      {!doHospede && m.traducao && <div className="conversa__traducao">Enviado em {nomeIdioma(idiomaHospede)}: {m.traducao}</div>}
      {m.statusEnvio === 'falhou' && <div className="conversa__traducao" style={{ color: 'var(--danger-fg)' }}>O WhatsApp não entregou esta mensagem.</div>}
    </ChatBubble>
  );
}

function Compositor({ detalhe, sessao, aoEnviar }: { detalhe: SolicitacaoDetalhe; sessao: Sessao; aoEnviar: () => void }) {
  const podeExterna =
    detalhe.origem === 'externa' &&
    ['em_atendimento', 'aguardando_solicitante'].includes(detalhe.estado) &&
    (detalhe.responsavel?.id === sessao.pessoa.id || sessao.pessoa.admin || sessao.setores.some((s) => s.id === detalhe.setor?.id && s.papel === 'supervisor'));
  const [modo, setModo] = useState<'externa' | 'interna'>(podeExterna ? 'externa' : 'interna');
  const [texto, setTexto] = useState('');
  const [previa, setPrevia] = useState<{ texto: string; alerta: string | null } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, confirmacao] = useConfirm();

  useEffect(() => {
    setModo(podeExterna ? 'externa' : 'interna');
    setPrevia(null);
  }, [detalhe.id, podeExterna]);

  const traduzir = detalhe.idioma !== 'pt' && modo === 'externa';
  const idiomaHospede = nomeIdioma(detalhe.idioma);

  async function enviar() {
    if (!texto.trim()) return;
    // Menção em modo externo pede confirmação: interno nunca vaza para fora.
    if (
      modo === 'externa' &&
      /@\p{L}/u.test(texto) &&
      !(await confirmar({
        title: 'Enviar com menção para o hóspede?',
        description: 'A mensagem tem um @nome e vai para o hóspede. Para avisar alguém da equipe, use a nota interna.',
        confirmLabel: 'Enviar mesmo assim',
      }))
    )
      return;
    setEnviando(true);
    try {
      await api.responder(detalhe.id, texto.trim(), modo);
      setTexto('');
      setPrevia(null);
      aoEnviar();
    } catch (e) {
      avisar((e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  if (['encerrada', 'cancelada'].includes(detalhe.estado)) {
    return (
      <div className="conversa__compositor">
        <span className="pequeno mudo">Atendimento encerrado.</span>
      </div>
    );
  }

  return (
    <div className="conversa__compositor">
      {confirmacao}
      <div className="linha">
        <SegmentedControl
          value={modo}
          onChange={(v) => setModo(v as 'externa' | 'interna')}
          options={[
            { value: 'externa', label: 'Para o hóspede', disabled: !podeExterna },
            { value: 'interna', label: 'Nota interna' },
          ]}
        />
        <span className="espaco" />
        {traduzir && (
          <Button
            variant="quiet"
            size="sm"
            disabled={!texto.trim()}
            onClick={async () => {
              try {
                const r = await api.previa(detalhe.id, texto.trim());
                setPrevia({ texto: r.texto, alerta: r.alerta });
              } catch (e) {
                avisar((e as Error).message, 'error');
              }
            }}
          >
            Ver tradução
          </Button>
        )}
      </div>
      {!podeExterna && detalhe.origem === 'externa' && modo === 'interna' && (
        <span className="pequeno mudo">Para responder ao hóspede, aceite ou pegue o atendimento.</span>
      )}
      {previa && (
        <Banner variant={previa.alerta ? 'warning' : 'info'} title={`Vai chegar assim, em ${idiomaHospede}`} description={previa.texto} onClose={() => setPrevia(null)}>
          {previa.alerta && <div className="pequeno">{previa.alerta}</div>}
        </Banner>
      )}
      <Textarea
        rows={2}
        value={texto}
        placeholder={
          modo === 'externa'
            ? traduzir
              ? `Escreva em português; o hóspede recebe em ${idiomaHospede}.`
              : 'Mensagem para o hóspede'
            : 'Só a equipe vê. Use @nome para avisar alguém.'
        }
        onChange={(e) => {
          setTexto(e.target.value);
          setPrevia(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void enviar();
          }
        }}
        aria-label={modo === 'externa' ? 'Mensagem para o hóspede' : 'Nota interna'}
        style={modo === 'interna' ? { background: 'var(--recado)', borderColor: 'var(--recado-borda)' } : undefined}
      />
      <AnexarMidia
        destino={modo === 'externa' ? 'para o hóspede' : 'como nota interna, só a equipe vê'}
        aoErro={(msg) => avisar(msg, 'error')}
        aoEnviar={async (a, legenda) => {
          await api.enviarMidia(detalhe.id, a, legenda, modo);
          aoEnviar();
        }}
      >
        <span className="pequeno mudo so-largo">{modo === 'externa' ? 'Ctrl+Enter envia' : 'Fica só na equipe · Ctrl+Enter salva'}</span>
        <span className="espaco" />
        <Button onClick={enviar} loading={enviando} disabled={!texto.trim()}>
          {modo === 'externa' ? 'Enviar ao hóspede' : 'Salvar nota'}
        </Button>
      </AnexarMidia>
    </div>
  );
}
