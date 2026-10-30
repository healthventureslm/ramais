import { Badge, Button, Card } from '@healthventureslm/design-system';
import type { CartaoMensagem, CartaoTarifa } from '@ramais/contracts';
import { BedDouble, CalendarDays, CircleCheck, CircleX, Clock3, Coffee, CreditCard, Users } from 'lucide-react';
import '../estilo/cartao-reserva.css';

/** Textos dos cartões (vêm do chat, já no idioma da tela). `{0}` é trocado pelo valor. */
export interface TextosCartao {
  cartaoQuartosTitulo: string;
  cartaoQuartosDica: string;
  cartaoNoite: string;
  cartaoNoites: string;
  cartaoAdulto: string;
  cartaoAdultos: string;
  cartaoCrianca: string;
  cartaoCriancas: string;
  cartaoQuartos: string;
  cartaoAPartirDe: string;
  cartaoTarifa: string;
  cartaoTarifas: string;
  cartaoCafe: string;
  cartaoSemCafe: string;
  cartaoCancelGratis: string;
  cartaoCancelAte: string;
  cartaoNaoReembolsavel: string;
  cartaoVerTarifas: string;
  cartaoEscolher: string;
  cartaoTarifasPergunta: string;
  cartaoResumo: string;
  cartaoDiarias: string;
  cartaoImpostos: string;
  cartaoTotal: string;
  cartaoComImpostos: string;
  cartaoTrocarTarifa: string;
  cartaoTrocarQuarto: string;
  cartaoPagamento: string;
  cartaoPagamentoDica: string;
  cartaoPagamentoDicaExtensao: string;
  cartaoNoitesAMais: string;
  cartaoValidoAte: string;
  cartaoVencido: string;
  cartaoPagar: string;
}

interface Props {
  cartao: CartaoMensagem;
  t: TextosCartao;
  idioma: string;
  /** Só o último cartão da conversa aceita escolha; os anteriores ficam de consulta. */
  ativo: boolean;
  /** Manda a resposta como se o hóspede tivesse digitado ("2. Standard Casal"). */
  responder: (texto: string) => void;
  hora: string;
}

const f = (modelo: string, ...v: (string | number)[]) => v.reduce<string>((s, x, i) => s.replace(`{${i}}`, String(x)), modelo);

/**
 * Cartões da reserva no chat, inspirados no bot de reservas da VOA: os quartos lado a lado com
 * foto, as tarifas do quarto escolhido, o resumo com diárias e impostos e o pagamento com botão.
 * O botão responde com o número e o nome, que a reserva entende como se fosse digitado.
 */
export function CartaoReserva({ cartao, t, idioma, ativo, responder, hora }: Props) {
  const moeda = (v: number) => v.toLocaleString(idioma, { style: 'currency', currency: 'BRL' });
  const data = (iso: string, ano = false) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(idioma, { day: '2-digit', month: '2-digit', ...(ano ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  if (cartao.tipo === 'pagamento') {
    const vencido = Date.parse(cartao.expiraEm) < Date.now();
    const ate = new Date(cartao.expiraEm).toLocaleTimeString(idioma, { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="zap__bolha zap__bolha--deles zap__bolha--rabo cartao-res cartao-res--pagamento">
        <div className="cartao-res__titulo">
          <CreditCard aria-hidden="true" />
          <strong>{t.cartaoPagamento}</strong>
        </div>
        <p className="cartao-res__dica">{cartao.motivo === 'extensao' ? t.cartaoPagamentoDicaExtensao : t.cartaoPagamentoDica}</p>
        <dl className="cartao-res__linhas">
          {cartao.quarto && (
            <div>
              <dt>
                <BedDouble aria-hidden="true" />
              </dt>
              <dd>{cartao.quarto}</dd>
            </div>
          )}
          <div>
            <dt>
              <CalendarDays aria-hidden="true" />
            </dt>
            <dd>{cartao.motivo === 'extensao' ? `${cartao.noites} ${t.cartaoNoitesAMais}` : contar(cartao.noites, t.cartaoNoite, t.cartaoNoites)}</dd>
          </div>
          <div>
            <dt>
              <Clock3 aria-hidden="true" />
            </dt>
            <dd>{vencido ? <Badge variant="neutral">{t.cartaoVencido}</Badge> : f(t.cartaoValidoAte, ate)}</dd>
          </div>
        </dl>
        <div className="cartao-res__total">
          <span>{t.cartaoTotal}</span>
          <strong>{moeda(cartao.total)}</strong>
        </div>
        <Button variant="primary" iconLeft={<CreditCard />} disabled={vencido} onClick={() => window.open(cartao.link, '_blank', 'noopener')}>
          {t.cartaoPagar}
        </Button>
        <span className="zap__meta">{hora}</span>
      </div>
    );
  }

  const pessoas = [
    contar(cartao.adultos, t.cartaoAdulto, t.cartaoAdultos),
    ...(cartao.criancas ? [contar(cartao.criancas, t.cartaoCrianca, t.cartaoCriancas)] : []),
    ...(cartao.quartos > 1 ? [`${cartao.quartos} ${t.cartaoQuartos}`] : []),
  ].join(', ');
  const estadia = `${data(cartao.checkIn)} – ${data(cartao.checkOut)} · ${contar(cartao.noites, t.cartaoNoite, t.cartaoNoites)} · ${pessoas}`;
  const cancelamento = (x: CartaoTarifa) =>
    x.cancelavel ? (x.cancelamentoAte ? f(t.cartaoCancelAte, data(x.cancelamentoAte)) : t.cartaoCancelGratis) : t.cartaoNaoReembolsavel;

  if (cartao.tipo === 'quartos') {
    return (
      <div className="cartao-res__bloco">
        <div className="zap__bolha zap__bolha--deles zap__bolha--rabo cartao-res">
          <strong className="cartao-res__cabeca">{f(t.cartaoQuartosTitulo, cartao.opcoes.length)}</strong>
          <span className="cartao-res__sub">{estadia}</span>
          <p className="cartao-res__dica">{t.cartaoQuartosDica}</p>
          <span className="zap__meta">{hora}</span>
        </div>
        <ul className="cartao-res__carrossel" aria-label={f(t.cartaoQuartosTitulo, cartao.opcoes.length)}>
          {cartao.opcoes.map((o) => (
            <li key={o.n}>
              <Card flat className="cartao-res__quarto">
                <Foto url={o.foto} nome={o.nome} />
                <div className="cartao-res__quarto-corpo">
                  <strong className="cartao-res__nome">{o.nome}</strong>
                  <span className="cartao-res__preco">
                    <small>{t.cartaoAPartirDe}</small> {moeda(o.aPartirDe)}
                  </span>
                  <ul className="cartao-res__fatos">
                    {o.cafe && (
                      <li>
                        <Coffee aria-hidden="true" />
                        {t.cartaoCafe}
                      </li>
                    )}
                    {o.cancelamentoGratis && (
                      <li className="cartao-res__fato--bom">
                        <CircleCheck aria-hidden="true" />
                        {t.cartaoCancelGratis}
                      </li>
                    )}
                    <li>{contar(o.tarifas, t.cartaoTarifa, t.cartaoTarifas)}</li>
                  </ul>
                  <Button variant="secondary" size="sm" disabled={!ativo} onClick={() => responder(`${o.n}. ${o.nome}`)}>
                    {o.tarifas > 1 ? t.cartaoVerTarifas : t.cartaoEscolher}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (cartao.tipo === 'tarifas') {
    const menor = Math.min(...cartao.tarifas.map((x) => x.total));
    return (
      <div className="zap__bolha zap__bolha--deles zap__bolha--rabo cartao-res cartao-res--largo">
        <div className="cartao-res__topo">
          <Foto url={cartao.foto} nome={cartao.quarto} pequena />
          <div>
            <strong className="cartao-res__cabeca">{cartao.quarto}</strong>
            <span className="cartao-res__sub">{estadia}</span>
          </div>
        </div>
        <ol className="cartao-res__tarifas">
          {cartao.tarifas.map((x) => (
            <li key={x.n}>
              <strong className="cartao-res__nome">{x.nome}</strong>
              <span className="cartao-res__fato">
                <Coffee aria-hidden="true" />
                {x.cafe ? t.cartaoCafe : t.cartaoSemCafe}
              </span>
              <span className={`cartao-res__fato ${x.cancelavel ? 'cartao-res__fato--bom' : ''}`}>
                {x.cancelavel ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                {cancelamento(x)}
              </span>
              <div className="cartao-res__escolha">
                <span className="cartao-res__preco">
                  {moeda(x.total)}
                  {x.total > menor && <small> +{moeda(x.total - menor)}</small>}
                </span>
                <Button variant="secondary" size="sm" disabled={!ativo} onClick={() => responder(`${x.n}. ${x.nome}`)}>
                  {t.cartaoEscolher}
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="cartao-res__dica">
          {t.cartaoTarifasPergunta} {t.cartaoComImpostos}
        </p>
        <span className="zap__meta">{hora}</span>
      </div>
    );
  }

  // Resumo.
  const x = cartao.tarifa;
  // O botão manda o rótulo da tela; num idioma traduzido pela IA ele pode não bater com o que a
  // reserva entende, e aí vai o inglês.
  const trocaTarifa = /^(trocar|change|cambiar)\b/i.test(t.cartaoTrocarTarifa) ? t.cartaoTrocarTarifa : 'Change rate';
  const trocaQuarto = /^(trocar|change|cambiar)\b/i.test(t.cartaoTrocarQuarto) ? t.cartaoTrocarQuarto : 'Change room';
  return (
    <div className="zap__bolha zap__bolha--deles zap__bolha--rabo cartao-res cartao-res--largo">
      <strong className="cartao-res__cabeca">{t.cartaoResumo}</strong>
      <dl className="cartao-res__linhas">
        <div>
          <dt>
            <CalendarDays aria-hidden="true" />
          </dt>
          <dd>
            {data(cartao.checkIn, true)} – {data(cartao.checkOut, true)} ({contar(cartao.noites, t.cartaoNoite, t.cartaoNoites)})
          </dd>
        </div>
        <div>
          <dt>
            <BedDouble aria-hidden="true" />
          </dt>
          <dd>
            <strong>{cartao.quarto}</strong>
            <br />
            {x.nome}
          </dd>
        </div>
        <div>
          <dt>
            <Coffee aria-hidden="true" />
          </dt>
          <dd>{x.cafe ? t.cartaoCafe : t.cartaoSemCafe}</dd>
        </div>
        <div className={x.cancelavel ? 'cartao-res__fato--bom' : ''}>
          <dt>{x.cancelavel ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}</dt>
          <dd>{cancelamento(x)}</dd>
        </div>
        <div>
          <dt>
            <Users aria-hidden="true" />
          </dt>
          <dd>{pessoas}</dd>
        </div>
      </dl>
      <dl className="cartao-res__valores">
        <div>
          <dt>{t.cartaoDiarias}</dt>
          <dd>{moeda(cartao.diarias)}</dd>
        </div>
        {cartao.impostos > 0 && (
          <div>
            <dt>{t.cartaoImpostos}</dt>
            <dd>{moeda(cartao.impostos)}</dd>
          </div>
        )}
        <div className="cartao-res__valores-total">
          <dt>{t.cartaoTotal}</dt>
          <dd>{moeda(cartao.total)}</dd>
        </div>
      </dl>
      {(cartao.trocarTarifa || cartao.trocarQuarto) && (
        <div className="cartao-res__acoes">
          {cartao.trocarTarifa && (
            <Button variant="secondary" size="sm" disabled={!ativo} onClick={() => responder(trocaTarifa)}>
              {t.cartaoTrocarTarifa}
            </Button>
          )}
          {cartao.trocarQuarto && (
            <Button variant="secondary" size="sm" disabled={!ativo} onClick={() => responder(trocaQuarto)}>
              {t.cartaoTrocarQuarto}
            </Button>
          )}
        </div>
      )}
      <span className="zap__meta">{hora}</span>
    </div>
  );
}

/** Foto do quarto (servidor de imagens da VOA); sem foto, o ícone da cama. */
function Foto({ url, nome, pequena = false }: { url: string | null; nome: string; pequena?: boolean }) {
  const classe = `cartao-res__foto ${pequena ? 'cartao-res__foto--pequena' : ''}`;
  if (!url) {
    return (
      <div className={`${classe} cartao-res__foto--vazia`} aria-hidden="true">
        <BedDouble />
      </div>
    );
  }
  return <img className={classe} src={url} alt={nome} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}
