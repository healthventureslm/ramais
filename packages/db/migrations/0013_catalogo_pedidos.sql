-- =====================================================================
-- 0013 — catálogo do hotel e pedidos do hóspede
--
-- O hotel cadastra o que vende ou agenda: room service, frigobar, late checkout (compra) e
-- spa, passeios, transfer, mesa no restaurante (agendamento, com grade de horários e vagas).
-- O hóspede pede pelo chat do quarto; cada pedido vira um atendimento no setor que entrega,
-- e a equipe confirma, recusa, lança na conta do quarto e conclui.
-- =====================================================================

CREATE TABLE catalogo_item (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  unidade_id       uuid NOT NULL,
  -- Quem entrega ou atende o pedido.
  setor_id         uuid NOT NULL,
  tipo             text NOT NULL CHECK (tipo IN ('compra', 'agendamento')),
  categoria        text NOT NULL,
  nome             text NOT NULL,
  descricao        text NOT NULL DEFAULT '',
  -- Nome e descrição para o hóspede em ES e EN ({"es": "...", "en": "..."}); sem, vale o português.
  nomes            jsonb NOT NULL DEFAULT '{}',
  descricoes       jsonb NOT NULL DEFAULT '{}',
  -- Nulo: sem preço ("cortesia" ou "sob consulta", conforme a descrição).
  preco_centavos   integer CHECK (preco_centavos >= 0),
  -- Agendamento: o preço é por pessoa? (compra é sempre por unidade.)
  por_pessoa       boolean NOT NULL DEFAULT false,
  max_quantidade   integer NOT NULL DEFAULT 10 CHECK (max_quantidade BETWEEN 1 AND 100),
  -- Agendamento: duração, vagas por horário e grade semanal
  -- ([{"dias": [1,2,3,4,5], "inicio": "09:00", "fim": "18:00", "intervaloMin": 60}]).
  duracao_min      integer CHECK (duracao_min BETWEEN 5 AND 1440),
  capacidade       integer CHECK (capacidade >= 1),
  -- Uma vaga por pessoa (passeio, mesa) ou por pedido (sala de massagem, carro do transfer).
  vagas_por        text NOT NULL DEFAULT 'pessoa' CHECK (vagas_por IN ('pessoa', 'pedido')),
  horarios         jsonb NOT NULL DEFAULT '[]',
  antecedencia_min integer NOT NULL DEFAULT 60 CHECK (antecedencia_min >= 0),
  dias_a_frente    integer NOT NULL DEFAULT 14 CHECK (dias_a_frente BETWEEN 0 AND 120),
  ativo            boolean NOT NULL DEFAULT true,
  ordem            integer NOT NULL DEFAULT 0,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, setor_id) REFERENCES setor (org_id, id)
);
CREATE INDEX catalogo_item_unidade ON catalogo_item (unidade_id, ativo, categoria, ordem);

CREATE TABLE pedido (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  unidade_id          uuid NOT NULL,
  item_id             uuid NOT NULL,
  solicitacao_id      uuid NOT NULL,
  local_id            uuid,
  -- Cópia do item no momento do pedido: o histórico não muda se o catálogo mudar.
  item_nome           text NOT NULL,
  tipo                text NOT NULL CHECK (tipo IN ('compra', 'agendamento')),
  -- Compra: unidades. Agendamento: pessoas.
  quantidade          integer NOT NULL CHECK (quantidade >= 1),
  agendado_para       timestamptz,
  duracao_min         integer,
  -- Vagas que ocupa no horário (quantidade, ou 1 quando a vaga é por pedido).
  vagas               integer NOT NULL DEFAULT 1,
  observacao          text,
  preco_unit_centavos integer,
  total_centavos      integer,
  estado              text NOT NULL DEFAULT 'pendente'
                        CHECK (estado IN ('pendente', 'confirmado', 'recusado', 'cancelado', 'concluido')),
  motivo              text,
  lancado_em          timestamptz,
  respondido_por      uuid,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK ((tipo = 'agendamento') = (agendado_para IS NOT NULL)),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, item_id) REFERENCES catalogo_item (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id)
);
CREATE UNIQUE INDEX pedido_solicitacao ON pedido (solicitacao_id);
CREATE INDEX pedido_agenda ON pedido (item_id, agendado_para) WHERE estado IN ('pendente', 'confirmado');
CREATE INDEX pedido_unidade ON pedido (unidade_id, criado_em DESC);
CREATE INDEX pedido_local ON pedido (local_id, criado_em DESC);

ALTER TABLE catalogo_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_item FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON catalogo_item USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON catalogo_item TO ramais_app;
GRANT SELECT ON catalogo_item TO ramais_sistema;

ALTER TABLE pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON pedido USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE ON pedido TO ramais_app;
GRANT SELECT ON pedido TO ramais_sistema;
