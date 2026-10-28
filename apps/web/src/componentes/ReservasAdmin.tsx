import { Badge, Banner, Button, Card, CardBody, CardHeader, CopyField, EmptyState, Input, ListGroup, ListItem } from '@healthventureslm/design-system';
import { useCallback, useEffect, useState } from 'react';
import { api, type ConfigReservas } from '../api';
import { avisar } from './Avisos';

const NOME_ESTADO: Record<string, string> = {
  coletando: 'Em conversa',
  opcoes: 'Escolhendo a opção',
  titular: 'Informando o titular',
  aguardando_pagamento: 'Link enviado, aguardando pagamento',
  paga: 'Pagas',
  recusada: 'Pagamento recusado',
  expirada: 'Link expirado',
  cancelada: 'Canceladas',
  estornada: 'Estornadas',
  desistiu: 'Hóspede desistiu',
  erro: 'Erro na VOA (foram para a recepção)',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Reserva de hospedagem automática pela VOA: o hóspede pede um quarto pelo WhatsApp ou pelo chat
 * do quarto e a IA busca, mostra as opções e manda o link de pagamento do checkout da VOA.
 * Aqui o admin liga a integração para a unidade com o ID do hotel na VOA.
 */
export function ReservasAdmin({ unidadeId }: { unidadeId: string }) {
  const [cfg, setCfg] = useState<ConfigReservas | null>(null);
  const [id, setId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api.admin
      .reservas(unidadeId)
      .then((c) => {
        setCfg(c);
        setId(c.voaHotelId ? String(c.voaHotelId) : '');
      })
      .catch((e: Error) => avisar(e.message, 'error'));
  }, [unidadeId]);
  useEffect(carregar, [carregar]);

  async function salvar(valor: number | null) {
    setErro(null);
    setSalvando(true);
    try {
      const r = await api.admin.salvarReservas(unidadeId, valor);
      avisar(valor ? `Reserva automática ligada: ${r.hotel ?? `hotel ${valor}`}.` : 'Reserva automática desligada.', 'success');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (!cfg) return <EmptyState loading size="sm" />;
  const numero = Number(id);
  const valido = /^\d+$/.test(id.trim()) && numero > 0;
  const pagas = cfg.ultimos30d.find((x) => x.estado === 'paga');

  return (
    <>
      <Card>
        <CardHeader
          title="Reserva de hospedagem automática"
          subtitle="O hóspede pede um quarto ou mais noites; a IA busca na VOA, mostra as opções com o preço final e manda o link de pagamento. A equipe só entra se ele pedir uma pessoa."
          action={cfg.voaHotelId ? <Badge variant="positive">Ligada</Badge> : <Badge variant="neutral">Desligada</Badge>}
        />
        <CardBody>
          <div className="pilha">
            {!cfg.integracao && (
              <Banner variant="warning" title="Falta o token da VOA no servidor" description="Configure VOA_API_TOKEN no ramais-api (Coolify) e faça o Redeploy." />
            )}
            {cfg.integracao && !cfg.webhook && (
              <Banner
                variant="warning"
                title="Falta o segredo do webhook"
                description="Sem VOA_WEBHOOK_SEGREDO, o Ramais não fica sabendo quando a reserva é paga: o hóspede recebe o link, mas não a confirmação."
              />
            )}
            {erro && <Banner variant="danger" title={erro} />}
            <Input
              label="ID do hotel na VOA"
              hint="O número que a VOA passou para este hotel (hotelId). Antes de salvar, conferimos com a VOA."
              inputMode="numeric"
              value={id}
              onChange={(e) => setId(e.target.value.replace(/\D/g, ''))}
              disabled={!cfg.integracao}
            />
            <div className="linha">
              <Button onClick={() => void salvar(numero)} loading={salvando} disabled={!cfg.integracao || !valido || numero === cfg.voaHotelId}>
                {cfg.voaHotelId ? 'Trocar hotel' : 'Ligar'}
              </Button>
              {cfg.voaHotelId !== null && (
                <Button variant="ghost" onClick={() => void salvar(null)} disabled={salvando}>
                  Desligar
                </Button>
              )}
            </div>
            {cfg.urlWebhook && (
              <CopyField
                label="Endereço do webhook (passar para a VOA)"
                hint="A VOA avisa aqui quando o pagamento muda. Junto, informe o valor de VOA_WEBHOOK_SEGREDO como o cabeçalho Authorization."
                value={cfg.urlWebhook}
              />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Últimos 30 dias"
          subtitle={pagas ? `${pagas.quantidade} ${pagas.quantidade === 1 ? 'reserva paga' : 'reservas pagas'} · ${brl(pagas.total)}` : 'Reservas feitas pela conversa.'}
        />
        <CardBody>
          {cfg.ultimos30d.length === 0 ? (
            <EmptyState size="sm" title="Nenhuma reserva pela conversa ainda" />
          ) : (
            <ListGroup plain>
              {cfg.ultimos30d.map((x) => (
                <ListItem key={x.estado} title={NOME_ESTADO[x.estado] ?? x.estado} meta={x.estado === 'paga' ? `${x.quantidade} · ${brl(x.total)}` : String(x.quantidade)} />
              ))}
            </ListGroup>
          )}
        </CardBody>
      </Card>
    </>
  );
}
