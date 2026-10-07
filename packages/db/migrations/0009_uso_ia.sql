-- =====================================================================
-- 0009 — gasto com IA
--
-- Cada chamada à OpenRouter (roteamento, tradução, transcrição, descrição de foto,
-- resposta pela base) vira uma linha, com o custo em dólares que a OpenRouter informa.
-- Serve ao dashboard (custo por pedido, por tarefa, por dia) e a testes de carga.
-- =====================================================================

CREATE TABLE uso_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizacao (id),
  unidade_id      uuid,
  solicitacao_id  uuid,
  -- roteamento, decisoes, traducao, traducoes (lote), transcricao, descricao, resposta…
  tarefa          text NOT NULL,
  modelo          text NOT NULL,
  tokens_entrada  int NOT NULL DEFAULT 0,
  tokens_saida    int NOT NULL DEFAULT 0,
  custo_usd       numeric(14, 8),
  latencia_ms     int NOT NULL,
  ok              boolean NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX uso_ia_unidade ON uso_ia (unidade_id, criado_em);
CREATE INDEX uso_ia_solicitacao ON uso_ia (solicitacao_id);

ALTER TABLE uso_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE uso_ia FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON uso_ia USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT ON uso_ia TO ramais_app;
