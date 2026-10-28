-- =====================================================================
-- 0016 — pagamento por link, mais noites na estadia e o chat do hotel
--
-- 1. Cobrança: link de pagamento do Salabim Pay (Pix ou cartão) para o pedido do catálogo pago
--    na hora, para o consumo que a equipe cobra por link e para as noites a mais da estadia.
-- 2. Mais noites: a reserva de hospedagem ganha o tipo "extensao" (o hóspede no quarto pede
--    para ficar mais); a VOA ainda não tem a rota, a confirmação é simulada.
-- 3. Chat do hotel: um QR (ou link no site) por unidade abre um chat de quem ainda não está
--    hospedado: tira dúvidas e reserva. A sessão não tem quarto.
-- =====================================================================

-- ---------- Cobrança ----------

CREATE TABLE cobranca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  unidade_id      uuid NOT NULL,
  -- A conversa (ou o atendimento do pedido) onde o link foi mandado; o aviso de pago vai para lá.
  solicitacao_id  uuid NOT NULL,
  -- pedido: itens do catálogo (pedido.cobranca_id); extensao: noites a mais (reserva_hospedagem.cobranca_id).
  tipo            text NOT NULL CHECK (tipo IN ('pedido', 'extensao')),
  descricao       text NOT NULL,
  valor_centavos  integer NOT NULL CHECK (valor_centavos > 0),
  provedor        text NOT NULL DEFAULT 'salabim',
  -- pl_… do Salabim Pay e o endereço do checkout.
  link_id         text UNIQUE,
  link            text,
  -- aguardando → paga | expirada | cancelada | estornada
  estado          text NOT NULL DEFAULT 'aguardando'
                    CHECK (estado IN ('aguardando', 'paga', 'expirada', 'cancelada', 'estornada')),
  expira_em       timestamptz,
  pago_em         timestamptz,
  -- Quem pediu o link: null = a IA na conversa.
  criado_por      uuid,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id)
);
CREATE INDEX cobranca_unidade ON cobranca (unidade_id, criado_em DESC);
CREATE INDEX cobranca_aguardando ON cobranca (expira_em) WHERE estado = 'aguardando';

ALTER TABLE cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON cobranca USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE ON cobranca TO ramais_app;
GRANT SELECT ON cobranca TO ramais_sistema;

-- O pedido pago por link (sem: vai para a conta do quarto).
ALTER TABLE pedido ADD COLUMN cobranca_id uuid;
ALTER TABLE pedido ADD FOREIGN KEY (org_id, cobranca_id) REFERENCES cobranca (org_id, id);

-- O aviso do Salabim chega sem login: o id do link diz de qual org é a cobrança.
CREATE FUNCTION sistema.resolver_cobranca(p_link_id text)
  RETURNS TABLE (org_id uuid, cobranca_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT c.org_id, c.id FROM cobranca c WHERE c.link_id = p_link_id
  $$;
ALTER FUNCTION sistema.resolver_cobranca(text) OWNER TO ramais_sistema;
REVOKE ALL ON FUNCTION sistema.resolver_cobranca(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.resolver_cobranca(text) TO ramais_app;

-- ---------- Mais noites na estadia ----------

ALTER TABLE reserva_hospedagem ADD COLUMN tipo text NOT NULL DEFAULT 'nova' CHECK (tipo IN ('nova', 'extensao'));
-- Extensão: a cotação (quarto, noites, preço) e a confirmação devolvidas pela VOA.
ALTER TABLE reserva_hospedagem ADD COLUMN extensao jsonb;
ALTER TABLE reserva_hospedagem ADD COLUMN cobranca_id uuid;
ALTER TABLE reserva_hospedagem ADD FOREIGN KEY (org_id, cobranca_id) REFERENCES cobranca (org_id, id);
ALTER TABLE reserva_hospedagem DROP CONSTRAINT reserva_hospedagem_estado_check;
ALTER TABLE reserva_hospedagem ADD CONSTRAINT reserva_hospedagem_estado_check
  CHECK (estado IN ('coletando', 'opcoes', 'titular', 'cotada', 'aguardando_pagamento', 'paga',
                    'recusada', 'expirada', 'cancelada', 'estornada', 'desistiu', 'erro'));

-- ---------- Chat do hotel ----------

-- Token aleatório do QR do hotel (não é o nome). Toda unidade ganha um: o padrão volátil é
-- calculado linha a linha também para as unidades que já existem (e não passa pelo RLS).
ALTER TABLE unidade ADD COLUMN codigo_publico text NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 18);

-- Sessão do chat do hotel: sem quarto (cada visitante é uma conversa).
ALTER TABLE chat_sessao ALTER COLUMN local_id DROP NOT NULL;

CREATE FUNCTION sistema.resolver_hotel(p_codigo text)
  RETURNS TABLE (org_id uuid, unidade_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT u.org_id, u.id FROM unidade u WHERE u.codigo_publico = p_codigo
  $$;
ALTER FUNCTION sistema.resolver_hotel(text) OWNER TO ramais_sistema;
REVOKE ALL ON FUNCTION sistema.resolver_hotel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.resolver_hotel(text) TO ramais_app;
