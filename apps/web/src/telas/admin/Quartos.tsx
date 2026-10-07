import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  Input,
  RadioGroup,
  Select,
  StatusDot,
  Table,
  useConfirm,
  useViewport,
} from '@healthventureslm/design-system';
import { ExternalLink, Plus, Printer, QrCode, RefreshCw, Search } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type DadosQuartos, type DestinoQr, type Quarto } from '../../api';
import { avisar } from '../../componentes/Avisos';
import { Chaveiro } from '../../componentes/ui';

/**
 * Quartos da unidade, cadastro em lote e a folha de QR para imprimir e colar nos quartos.
 * O QR leva ao WhatsApp do hotel ou ao chat do quarto no navegador (uma conversa por quarto, sem custo da Meta).
 */
export function Quartos({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome: string }) {
  const [dados, setDados] = useState<DadosQuartos | null>(null);
  const [lote, setLote] = useState('');
  const [tipo, setTipo] = useState('quarto');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState('');
  const [verQr, setVerQr] = useState<{ quarto: Quarto; img: string } | null>(null);
  const [renomeando, setRenomeando] = useState<{ quarto: Quarto; valor: string } | null>(null);
  const [folha, setFolha] = useState<{ identificador: string; img: string }[] | null>(null);
  const [confirmar, confirmacao] = useConfirm();
  const { isMobile } = useViewport();

  const carregar = () => api.admin.quartos(unidadeId).then(setDados).catch((e) => avisar(e.message, 'error'));
  useEffect(() => {
    void carregar();
    setSel(new Set());
  }, [unidadeId]);

  const quartos = dados?.quartos ?? [];
  const f = filtro.trim().toLowerCase();
  const visiveis = quartos.filter((q) => !f || q.identificador.toLowerCase().includes(f) || (q.hospede ?? '').toLowerCase().includes(f));
  const imprimiveis = visiveis.filter((q) => q.ativo && q.link);
  const todosMarcados = imprimiveis.length > 0 && imprimiveis.every((q) => sel.has(q.id));
  const marcarTodos = () => setSel(todosMarcados ? new Set() : new Set(imprimiveis.map((q) => q.id)));

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.admin.criarQuartos(unidadeId, lote, tipo);
      avisar(`${r.criados} cadastrados${r.existentes ? ` · ${r.existentes} já existiam` : ''}`, 'success');
      setLote('');
      void carregar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    }
  }

  async function imprimir() {
    const alvo = quartos.filter((q) => q.ativo && q.link && (sel.size === 0 || sel.has(q.id)));
    if (!alvo.length) return avisar('Nenhum quarto com QR para imprimir.', 'warning');
    const cartoes = await Promise.all(alvo.map(async (q) => ({ identificador: q.identificador, img: await QRCode.toDataURL(q.link!, { margin: 1, width: 360 }) })));
    setFolha(cartoes);
  }

  // A folha só existe enquanto imprime: renderiza, chama o diálogo, some.
  useEffect(() => {
    if (!folha) return;
    const fim = () => setFolha(null);
    window.addEventListener('afterprint', fim, { once: true });
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', fim);
    };
  }, [folha]);

  async function mudarDestino(d: DestinoQr) {
    if (!dados || d === dados.destino) return;
    const ok = await confirmar({
      title: d === 'web' ? 'Levar o QR para o chat do quarto?' : 'Levar o QR para o WhatsApp?',
      description: 'O QR muda: reimprima a folha e troque os QR dos quartos. Os QR antigos continuam abrindo o destino anterior.',
      confirmLabel: 'Mudar o destino',
    });
    if (!ok) return;
    try {
      await api.admin.destinoQr(unidadeId, d);
      avisar('Destino do QR atualizado. Reimprima a folha de QR.', 'success');
      void carregar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    }
  }

  async function acao(q: Quarto, o: 'codigo' | 'ativo') {
    try {
      if (o === 'codigo') {
        const ok = await confirmar({
          title: `Gerar um QR novo para ${q.identificador}?`,
          description: 'O QR impresso hoje deixa de funcionar: reimprima e troque no quarto.',
          confirmLabel: 'Gerar QR novo',
          danger: true,
        });
        if (!ok) return;
        await api.admin.novoCodigo(q.id);
        avisar('QR novo gerado. Imprima e troque o do quarto.', 'success');
        setVerQr(null);
      } else {
        await api.admin.salvarQuarto(q.id, q.identificador, !q.ativo);
      }
      void carregar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    }
  }

  async function renomear(e: React.FormEvent) {
    e.preventDefault();
    if (!renomeando) return;
    const q = renomeando.quarto;
    const novo = renomeando.valor.trim();
    if (!novo || novo === q.identificador) return setRenomeando(null);
    try {
      await api.admin.salvarQuarto(q.id, novo, q.ativo);
      setRenomeando(null);
      void carregar();
    } catch (err) {
      avisar((err as Error).message, 'error');
    }
  }

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <Card>
        <CardHeader title="Cadastrar quartos" subtitle="Intervalos com hífen, separados por vírgula. Os que já existem são ignorados." />
        <CardBody>
          <form onSubmit={cadastrar} className="linha">
            <div style={{ flex: '1 1 260px' }}>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="101-120, 201-220, Suíte Master" aria-label="Quartos a cadastrar" />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 140 }}>
              <Select
                value={tipo}
                onChange={setTipo}
                sheetTitle="Tipo"
                options={[
                  { value: 'quarto', label: 'Quartos' },
                  { value: 'leito', label: 'Leitos' },
                  { value: 'sala', label: 'Salas' },
                ]}
              />
            </div>
            <Button type="submit" iconLeft={<Plus />} disabled={!lote.trim()}>
              Cadastrar
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Para onde o QR leva" subtitle="Vale para todos os quartos da unidade. Os dois caminhos chegam na mesma fila da equipe." />
        <CardBody>
          <RadioGroup
            variant="cards"
            value={dados?.destino ?? 'whatsapp'}
            disabled={!dados}
            onChange={(v) => void mudarDestino(v as DestinoQr)}
            options={[
              {
                value: 'web',
                label: 'Chat do quarto, no navegador',
                description: 'Abre um chat sem instalar nada. Uma conversa por quarto, só da estadia atual, sem custo de mensagens da Meta.',
              },
              {
                value: 'whatsapp',
                label: 'WhatsApp do hotel',
                description: dados?.numeroWhatsapp
                  ? `Abre o WhatsApp no número ${dados.numeroWhatsapp}, já com o código do quarto.`
                  : 'Precisa de um número de WhatsApp conectado à unidade.',
              },
            ]}
          />
        </CardBody>
      </Card>

      {dados && dados.destino === 'whatsapp' && !dados.numeroWhatsapp && (
        <Banner variant="warning" title="A unidade ainda não tem número de WhatsApp ativo" description="Os QR só aparecem depois de conectar o número, ou escolha o chat do quarto." />
      )}

      <div className="admin-barra">
        <div className="admin-barra__busca">
          <Input
            type="search"
            iconLeft={<Search />}
            placeholder="Buscar quarto ou hóspede…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Buscar quarto"
          />
        </div>
        {isMobile && imprimiveis.length > 0 && <Checkbox label="Selecionar todos" checked={todosMarcados} onChange={marcarTodos} />}
        <span className="pequeno mudo espaco">
          {quartos.filter((q) => q.ativo).length} ativos{sel.size ? ` · ${sel.size} selecionados` : ''}
        </span>
        <Button variant="secondary" iconLeft={<Printer />} onClick={imprimir} disabled={!quartos.some((q) => q.link)}>
          Imprimir QR {sel.size ? `(${sel.size})` : 'de todos'}
        </Button>
      </div>

      <Card>
        <Table<Quarto>
          data={visiveis}
          emptyText={dados === null ? 'Carregando…' : quartos.length ? 'Nada encontrado.' : 'Nenhum quarto cadastrado ainda.'}
          columns={[
            {
              key: 'sel',
              header: isMobile ? 'Imprimir' : <Checkbox aria-label="Selecionar todos" checked={todosMarcados} onChange={marcarTodos} disabled={!imprimiveis.length} />,
              width: '48px',
              render: (q: Quarto) => (
                <Checkbox aria-label={`Selecionar ${q.identificador}`} disabled={!q.ativo || !q.link} checked={sel.has(q.id)} onChange={() => alternar(q.id)} />
              ),
            },
            {
              key: 'quarto',
              header: 'Quarto',
              primary: true,
              render: (q: Quarto) => (
                <span className="linha">
                  <Chaveiro numero={q.identificador} pendente={!q.ativo} />
                  {q.tipo !== 'quarto' && <span className="pequeno mudo">{q.tipo}</span>}
                </span>
              ),
            } as never,
            {
              key: 'hospede',
              header: 'Hóspede hoje',
              secondary: true,
              render: (q: Quarto) => q.hospede ?? <span className="mudo">—</span>,
            } as never,
            {
              key: 'situacao',
              header: 'Situação',
              render: (q) => (q.ativo ? <StatusDot status="positive">Ativo</StatusDot> : <StatusDot status="neutral">Desativado</StatusDot>),
            },
            {
              key: 'acoes',
              header: '',
              align: 'right',
              render: (q) => (
                <div className="linha" style={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconLeft={<QrCode />}
                    disabled={!q.link || !q.ativo}
                    onClick={async () => setVerQr({ quarto: q, img: await QRCode.toDataURL(q.link!, { margin: 1, width: 240 }) })}
                  >
                    Ver QR
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenomeando({ quarto: q, valor: q.identificador })}>
                    Renomear
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => acao(q, 'ativo')}>
                    {q.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {verQr && (
        <Dialog
          open
          onClose={() => setVerQr(null)}
          size="sm"
          title={`Quarto ${verQr.quarto.identificador}`}
          description={
            dados?.destino === 'web'
              ? 'Abre o chat deste quarto no navegador. O código é aleatório: não dá para adivinhar o de outro quarto.'
              : 'Abre o WhatsApp do hotel já com o código deste quarto. O código é aleatório: não dá para adivinhar o de outro quarto.'
          }
          footer={
            <>
              {dados?.destino === 'web' && (
                <Button variant="ghost" iconLeft={<ExternalLink />} onClick={() => window.open(verQr.quarto.link!, '_blank', 'noopener')}>
                  Abrir o chat
                </Button>
              )}
              <Button
                variant="danger"
                iconLeft={<RefreshCw />}
                onClick={() => acao(verQr.quarto, 'codigo')}
                title="Use se o QR vazou (foto em rede social, por exemplo)"
              >
                Gerar QR novo
              </Button>
              <Button onClick={() => setVerQr(null)}>Fechar</Button>
            </>
          }
        >
          <div className="admin-qr">
            <img src={verQr.img} alt={`QR do quarto ${verQr.quarto.identificador}`} width={240} height={240} />
          </div>
        </Dialog>
      )}

      {renomeando && (
        <Dialog
          open
          onClose={() => setRenomeando(null)}
          size="sm"
          title={`Renomear ${renomeando.quarto.identificador}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRenomeando(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="form-renomear" disabled={!renomeando.valor.trim()}>
                Salvar
              </Button>
            </>
          }
        >
          <form id="form-renomear" onSubmit={renomear}>
            <Input
              label="Novo número/nome do quarto"
              autoFocus
              value={renomeando.valor}
              onChange={(e) => setRenomeando({ ...renomeando, valor: e.target.value })}
            />
          </form>
        </Dialog>
      )}

      {confirmacao}

      {folha &&
        createPortal(
          <div className="folha-qr" aria-hidden="true">
            {folha.map((c) => (
              <div key={c.identificador} className="cartao-qr">
                <div className="cartao-qr-hotel">{unidadeNome}</div>
                <div className="cartao-qr-chamada">Precisa de algo? Fale com a gente</div>
                <div className="cartao-qr-idiomas">¿Necesita algo? · Need anything?</div>
                <img src={c.img} alt="" />
                <div className="cartao-qr-dica">{dados?.destino === 'web' ? 'Aponte a câmera · chat do hotel' : 'Aponte a câmera · WhatsApp'}</div>
                <div className="cartao-qr-quarto">{c.identificador}</div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
