-- =====================================================================
-- 0012 — notificação no navegador (Web Push)
--
-- A equipe recebe aviso de pedido novo, mensagem do hóspede, nota interna e mensagem direta
-- mesmo com a aba fechada; o hóspede do chat do quarto recebe aviso quando a equipe responde.
-- Cada linha é a inscrição de um navegador: ou de uma pessoa da equipe, ou de uma sessão do
-- chat do quarto. O mesmo navegador pode ter as duas (quem testa os dois lados na mesma máquina).
-- =====================================================================

CREATE TABLE push_web (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  pessoa_id       uuid,
  chat_sessao_id  uuid,
  endpoint        text NOT NULL,
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  CHECK ((pessoa_id IS NULL) <> (chat_sessao_id IS NULL)),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, chat_sessao_id) REFERENCES chat_sessao (org_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX push_web_pessoa ON push_web (endpoint, pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE UNIQUE INDEX push_web_chat ON push_web (endpoint, chat_sessao_id) WHERE chat_sessao_id IS NOT NULL;
CREATE INDEX push_web_por_pessoa ON push_web (pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE INDEX push_web_por_chat ON push_web (chat_sessao_id) WHERE chat_sessao_id IS NOT NULL;

ALTER TABLE push_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_web FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON push_web USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON push_web TO ramais_app;
GRANT SELECT ON push_web TO ramais_sistema;
