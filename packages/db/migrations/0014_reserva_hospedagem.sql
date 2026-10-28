-- =====================================================================
-- 0014 — reserva de hospedagem pela conversa (integração de parceiros da VOA)
--
-- O hóspede pede um quarto (ou mais noites) pelo WhatsApp ou pelo chat do quarto; a IA pergunta
-- o que falta, busca disponibilidade na VOA, mostra as opções e manda o link de pagamento do
-- checkout da VOA. O webhook da VOA avisa quando foi pago e a reserva confirmada.
-- =====================================================================

-- Hotel desta unidade na API da VOA (rms.voahoteis.io). Nulo = reserva automática desligada.
ALTER TABLE unidade ADD COLUMN voa_hotel_id integer;

CREATE TABLE reserva_hospedagem (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  unidade_id         uuid NOT NULL,
  solicitacao_id     uuid NOT NULL,
  voa_hotel_id       integer NOT NULL,
  -- coletando → opcoes → titular → aguardando_pagamento → paga | (recusada | expirada | cancelada | estornada | desistiu | erro)
  estado             text NOT NULL DEFAULT 'coletando'
                       CHECK (estado IN ('coletando', 'opcoes', 'titular', 'aguardando_pagamento', 'paga',
                                         'recusada', 'expirada', 'cancelada', 'estornada', 'desistiu', 'erro')),
  -- O pedido: datas, quartos, adultos, idades das crianças.
  pedido             jsonb NOT NULL DEFAULT '{}',
  -- Última busca: id e validade na VOA, e as opções mostradas (numeradas).
  busca              jsonb,
  escolha            jsonb,
  titular_nome       text,
  titular_email      text,
  oferta_id          integer,
  oferta_uuid        text UNIQUE,
  link               text,
  total              numeric(12, 2),
  expira_em          timestamptz,
  booking_id         text,
  status_pagamento   text,
  status_reserva     text,
  pago_em            timestamptz,
  ultima_pergunta    text,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id)
);
CREATE INDEX reserva_hospedagem_solicitacao ON reserva_hospedagem (solicitacao_id, criado_em DESC);
CREATE INDEX reserva_hospedagem_unidade ON reserva_hospedagem (unidade_id, criado_em DESC);

ALTER TABLE reserva_hospedagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserva_hospedagem FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON reserva_hospedagem USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE ON reserva_hospedagem TO ramais_app;
GRANT SELECT ON reserva_hospedagem TO ramais_sistema;

-- O webhook chega sem login: o uuid da oferta diz de qual org ela é (como o QR do quarto).
CREATE FUNCTION sistema.resolver_oferta_voa(p_uuid text)
  RETURNS TABLE (org_id uuid, reserva_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT r.org_id, r.id FROM reserva_hospedagem r WHERE r.oferta_uuid = p_uuid
  $$;
ALTER FUNCTION sistema.resolver_oferta_voa(text) OWNER TO ramais_sistema;
REVOKE ALL ON FUNCTION sistema.resolver_oferta_voa(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.resolver_oferta_voa(text) TO ramais_app;

-- Cada aviso da VOA, uma vez só (a VOA reenvia até 3 vezes; o mesmo evento pode chegar repetido).
CREATE TABLE sistema.voa_evento (
  chave        text PRIMARY KEY,
  recebido_em  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL
);
GRANT SELECT, INSERT ON sistema.voa_evento TO ramais_app;
