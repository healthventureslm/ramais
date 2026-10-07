-- =====================================================================
-- 0008 — gerente, chat por quarto e mídia nas conversas internas
--
-- Gerente: vê e atende tudo da organização e o relatório, mas não mexe na
--   jornada nem na equipe (isso continua sendo do admin).
-- Chat por quarto: o QR do quarto pode abrir um chat web do próprio Ramais em vez
--   do WhatsApp. A mensagem entra pelo mesmo caminho (classificação, fila, escada),
--   por um canal do tipo 'web', sem custo de API da Meta. Cada leitura do QR abre
--   uma sessão presa à ESTADIA: o hóspede só vê a conversa a partir do check-in dele,
--   e a sessão expira no check-out.
-- Mídia: mensagem direta entre a equipe também leva áudio (com transcrição) e foto.
-- =====================================================================

ALTER TABLE pessoa ADD COLUMN gerente boolean NOT NULL DEFAULT false;

ALTER TABLE canal_whatsapp ADD COLUMN tipo text NOT NULL DEFAULT 'whatsapp' CHECK (tipo IN ('whatsapp', 'web'));

-- Para onde o QR do quarto leva o hóspede.
ALTER TABLE unidade ADD COLUMN qr_destino text NOT NULL DEFAULT 'whatsapp' CHECK (qr_destino IN ('whatsapp', 'web'));

ALTER TABLE mensagem_interna
  ALTER COLUMN texto DROP NOT NULL,
  ADD COLUMN tipo        text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio')),
  ADD COLUMN midia_chave text,
  ADD COLUMN midia_mime  text,
  ADD COLUMN transcricao text;

CREATE TABLE chat_sessao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  unidade_id     uuid NOT NULL,
  local_id       uuid NOT NULL,
  -- sha256 do segredo que fica no navegador do hóspede; o segredo nunca é guardado.
  token_hash     text NOT NULL UNIQUE,
  -- O hóspede só vê mensagens a partir daqui (check-in da estadia atual, ou a leitura do QR).
  estadia_desde  timestamptz NOT NULL,
  expira_em      timestamptz NOT NULL,
  idioma         text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, local_id) REFERENCES local (org_id, id)
);
CREATE INDEX chat_sessao_local ON chat_sessao (local_id, expira_em);

ALTER TABLE chat_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessao FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento ON chat_sessao USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_sessao TO ramais_app;
GRANT SELECT ON chat_sessao TO ramais_sistema;

-- O hóspede chega sem login: só o código do QR (ou o segredo da sessão) diz de qual org ele é.
CREATE FUNCTION sistema.resolver_quarto(p_codigo text)
  RETURNS TABLE (org_id uuid, unidade_id uuid, local_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT l.org_id, l.unidade_id, l.id FROM local l
     WHERE l.codigo_qr = p_codigo AND l.ativo
  $$;

CREATE FUNCTION sistema.resolver_chat(p_token_hash text)
  RETURNS TABLE (org_id uuid, sessao_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT c.org_id, c.id FROM chat_sessao c
     WHERE c.token_hash = p_token_hash AND c.expira_em > now()
  $$;

ALTER FUNCTION sistema.resolver_quarto(text) OWNER TO ramais_sistema;
ALTER FUNCTION sistema.resolver_chat(text) OWNER TO ramais_sistema;
REVOKE ALL ON FUNCTION sistema.resolver_quarto(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sistema.resolver_chat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.resolver_quarto(text) TO ramais_app;
GRANT EXECUTE ON FUNCTION sistema.resolver_chat(text) TO ramais_app;
