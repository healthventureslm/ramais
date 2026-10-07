import { Button, LiveActivity } from '@healthventureslm/design-system';
import { useCallback, useEffect, useState } from 'react';
import { api, type Oferta } from '../api';
import { useEvento } from '../tempo-real';
import { avisar } from './Avisos';

/**
 * O ramal tocando: um pedido oferecido a você, com prazo para aceitar.
 * É o processo "ao vivo" da tela, então usa o LiveActivity do DS, a única peça que pulsa.
 * Uma oferta por vez; as outras esperam na fila (o contador avisa quantas).
 */
export function Ofertas({ emTurno, aoAceitar }: { emTurno: boolean; aoAceitar: (solicitacaoId: string) => void }) {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [, setTique] = useState(0);
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(() => {
    if (!emTurno) {
      setOfertas([]);
      return;
    }
    api
      .ofertas()
      .then(setOfertas)
      .catch(() => undefined);
  }, [emTurno]);

  useEffect(carregar, [carregar]);
  useEffect(() => {
    const t = setInterval(() => setTique((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEvento('oferta:nova', () => {
    carregar();
    tocar();
  });
  useEvento('oferta:encerrada', (p) => {
    setOfertas((l) => l.filter((o) => o.ofertaId !== p.ofertaId));
    if (p.motivo === 'pega') avisar('Um supervisor pegou um pedido que estava com você.', 'info');
  });

  const vivas = ofertas.filter((o) => new Date(o.expiraEm).getTime() > Date.now());
  const o = vivas[0];
  if (!o) return null;
  const resta = Math.max(0, Math.ceil((new Date(o.expiraEm).getTime() - Date.now()) / 1000));

  return (
    <LiveActivity
      open
      tone={o.urgencia === 'agora' ? 'warning' : 'live'}
      label={`${o.urgencia === 'agora' ? 'Urgente: ' : ''}${o.resumo ?? 'Pedido novo'}`}
      meta={[`${resta}s para aceitar`, o.setor, vivas.length > 1 ? `+${vivas.length - 1} na fila` : null].filter(Boolean).join(' · ')}
      ariaLabel={`Pedido novo para ${o.setor ?? 'o seu setor'}: ${o.resumo ?? ''}. ${resta} segundos para aceitar.`}
      actions={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await api.recusar(o.ofertaId).catch(() => undefined);
              setOfertas((l) => l.filter((x) => x.ofertaId !== o.ofertaId));
            }}
          >
            Agora não
          </Button>
          <Button
            size="sm"
            loading={aceitando}
            onClick={async () => {
              setAceitando(true);
              try {
                const r = await api.aceitar(o.ofertaId);
                setOfertas((l) => l.filter((x) => x.ofertaId !== o.ofertaId));
                aoAceitar(r.solicitacaoId);
              } catch (e) {
                avisar((e as Error).message, 'error');
                carregar();
              } finally {
                setAceitando(false);
              }
            }}
          >
            Aceitar
          </Button>
        </>
      }
    />
  );
}

function tocar() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 880;
    g.gain.value = 0.08;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // sem áudio (aba sem interação): a pílula visual basta
  }
}
