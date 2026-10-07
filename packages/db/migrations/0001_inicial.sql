-- =====================================================================
-- 0001 — esquema inicial
--
-- Papéis (criados por `pnpm db:setup`):
--   ramais_owner   dono das tabelas; roda migrações e seed. Sujeito a RLS (FORCE).
--   ramais_app     usado pela api e pelo worker. Sem BYPASSRLS, não é dono.
--   ramais_sistema NOLOGIN, BYPASSRLS. Dono só das funções SECURITY DEFINER que
--                  precisam olhar entre organizações (resolver o número que recebeu
--                  a mensagem, login, varredura). Nada mais roda com ele.
--
-- Isolamento: toda tabela de negócio tem org_id e a política
--   org_id = app_org()
-- onde app_org() lê `app.org_id` da transação (set_config(..., true)).
-- Sem org definido, app_org() é NULL e nenhuma linha passa: falha fechada.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS sistema;

CREATE OR REPLACE FUNCTION app_org() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

-- ---------------------------------------------------------------------
-- Organização e unidade
-- ---------------------------------------------------------------------

CREATE TABLE organizacao (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Coluna redundante para a política ser igual em todas as tabelas.
  org_id     uuid GENERATED ALWAYS AS (id) STORED,
  nome       text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE TABLE unidade (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizacao (id),
  nome               text NOT NULL,
  fuso               text NOT NULL DEFAULT 'America/Sao_Paulo',
  jornada_versao_id  uuid,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

-- Imutável: conversas em andamento ficam na versão em que começaram.
CREATE TABLE jornada_versao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  unidade_id   uuid NOT NULL,
  numero       int  NOT NULL,
  config       jsonb NOT NULL,
  publicada_em timestamptz NOT NULL DEFAULT now(),
  publicada_por uuid,
  UNIQUE (org_id, id),
  UNIQUE (unidade_id, numero),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id)
);

ALTER TABLE unidade
  ADD FOREIGN KEY (org_id, jornada_versao_id) REFERENCES jornada_versao (org_id, id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE canal_whatsapp (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  unidade_id       uuid NOT NULL,
  phone_number_id  text NOT NULL UNIQUE,
  waba_id          text NOT NULL,
  numero_exibicao  text NOT NULL,
  -- propria: WABA do cliente (Tech Provider). gerenciada: número na nossa conta.
  modo_credencial  text NOT NULL CHECK (modo_credencial IN ('propria', 'gerenciada')),
  -- Referência ao segredo (nome no gerenciador de segredos). Nunca o token em si.
  credencial_ref   text NOT NULL,
  ativo            boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id)
);

CREATE TABLE politica_escalonamento (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id   uuid NOT NULL REFERENCES organizacao (id),
  nome     text NOT NULL,
  degraus  jsonb NOT NULL,
  UNIQUE (org_id, id)
);

CREATE TABLE setor (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     uuid NOT NULL,
  unidade_id                 uuid NOT NULL,
  chave                      text NOT NULL,
  nome                       text NOT NULL,
  ativo                      boolean NOT NULL DEFAULT true,
  politica_distribuicao      text NOT NULL DEFAULT 'menor_carga'
                               CHECK (politica_distribuicao IN ('menor_carga', 'rodizio', 'fila_aberta')),
  politica_escalonamento_id  uuid,
  criado_em                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (unidade_id, chave),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, politica_escalonamento_id) REFERENCES politica_escalonamento (org_id, id)
);

-- Quarto, leito ou sala: o mesmo conceito em verticais diferentes.
CREATE TABLE local (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  unidade_id     uuid NOT NULL,
  tipo           text NOT NULL DEFAULT 'quarto' CHECK (tipo IN ('quarto', 'leito', 'sala')),
  identificador  text NOT NULL,
  -- Token aleatório do QR. Não é o número do quarto.
  codigo_qr      text NOT NULL UNIQUE,
  ativo          boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, id),
  UNIQUE (unidade_id, identificador),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id)
);

-- ---------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------

CREATE TABLE pessoa (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizacao (id),
  nome         text NOT NULL,
  email        text NOT NULL,
  senha_hash   text,
  pin_hash     text,
  pin_falhas   int NOT NULL DEFAULT 0,
  pin_bloqueado_ate timestamptz,
  idiomas      text[] NOT NULL DEFAULT '{pt}',
  admin        boolean NOT NULL DEFAULT false,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);
-- E-mail único no sistema todo: o login precisa achar a organização pelo e-mail.
CREATE UNIQUE INDEX pessoa_email_unico ON pessoa (lower(email));

CREATE TABLE lotacao (
  org_id       uuid NOT NULL,
  pessoa_id    uuid NOT NULL,
  setor_id     uuid NOT NULL,
  papel        text NOT NULL DEFAULT 'membro' CHECK (papel IN ('membro', 'supervisor')),
  recebe       text NOT NULL DEFAULT 'sempre' CHECK (recebe IN ('sempre', 'ultimo_recurso', 'nunca')),
  limite_carga int  NOT NULL DEFAULT 5 CHECK (limite_carga > 0),
  PRIMARY KEY (pessoa_id, setor_id),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id),
  FOREIGN KEY (org_id, setor_id) REFERENCES setor (org_id, id)
);

CREATE TABLE dispositivo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL,
  unidade_id            uuid NOT NULL,
  nome                  text NOT NULL,
  plataforma            text CHECK (plataforma IN ('android', 'ios')),
  -- sha256 do código de cadastro de uso único (mostrado como QR pelo administrador).
  codigo_cadastro_hash  text UNIQUE,
  codigo_expira_em      timestamptz,
  cadastrado_em         timestamptz,
  push_token            text,
  pessoa_id             uuid,
  ativo                 boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id)
);

-- Presença: entrar no app é entrar no turno. Não é controle de jornada (não é "ponto").
CREATE TABLE presenca (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  unidade_id        uuid NOT NULL,
  pessoa_id         uuid NOT NULL,
  dispositivo_id    uuid,
  inicio            timestamptz NOT NULL DEFAULT now(),
  fim               timestamptz,
  ultima_atividade  timestamptz NOT NULL DEFAULT now(),
  motivo_fim        text,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id),
  FOREIGN KEY (org_id, dispositivo_id) REFERENCES dispositivo (org_id, id)
);
-- Uma presença aberta por pessoa.
CREATE UNIQUE INDEX presenca_aberta ON presenca (pessoa_id) WHERE fim IS NULL;

-- ---------------------------------------------------------------------
-- Solicitantes
-- ---------------------------------------------------------------------

-- Identidade por organização e telefone, nunca telefone global.
CREATE TABLE solicitante (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizacao (id),
  telefone   text NOT NULL,
  nome       text,
  idioma     text,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, telefone)
);

-- Lista de hóspedes ativos (no MVP: planilha importada ou cadastro pela recepção).
CREATE TABLE hospede_ativo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  unidade_id  uuid NOT NULL,
  local_id    uuid NOT NULL,
  sobrenome   text NOT NULL,
  checkin     date NOT NULL,
  checkout    date NOT NULL,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, local_id) REFERENCES local (org_id, id)
);

CREATE TABLE vinculo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  unidade_id      uuid NOT NULL,
  solicitante_id  uuid NOT NULL,
  local_id        uuid NOT NULL,
  -- qr: só vale para pedido de baixo risco. sobrenome/recepcao: confirmado.
  origem          text NOT NULL CHECK (origem IN ('qr', 'sobrenome', 'recepcao')),
  confirmado      boolean NOT NULL DEFAULT false,
  inicio          timestamptz NOT NULL DEFAULT now(),
  -- Expira no checkout.
  fim             timestamptz NOT NULL,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, solicitante_id) REFERENCES solicitante (org_id, id),
  FOREIGN KEY (org_id, local_id) REFERENCES local (org_id, id)
);
CREATE INDEX vinculo_solicitante ON vinculo (solicitante_id, unidade_id, fim);

-- ---------------------------------------------------------------------
-- Solicitação e mensagens
-- ---------------------------------------------------------------------

CREATE TABLE solicitacao (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL,
  unidade_id                uuid NOT NULL,
  solicitante_id            uuid,
  canal_id                  uuid,
  origem                    text NOT NULL CHECK (origem IN ('externa', 'interna')),
  pai_id                    uuid,
  criado_por                uuid,
  setor_id                  uuid,
  responsavel_id            uuid,
  responsavel_anterior_id   uuid,
  local_id                  uuid,
  identificado              boolean NOT NULL DEFAULT false,
  estado                    text NOT NULL CHECK (estado IN ('automacao', 'na_fila', 'oferecida', 'em_atendimento',
                                                           'aguardando_solicitante', 'resolvida', 'encerrada', 'cancelada')),
  etapa                     text NOT NULL DEFAULT 'entrada',
  idioma                    text NOT NULL DEFAULT 'pt',
  urgencia                  text NOT NULL DEFAULT 'rotina' CHECK (urgencia IN ('rotina', 'hoje', 'agora')),
  baixa_certeza             boolean NOT NULL DEFAULT false,
  jornada_versao_id         uuid NOT NULL,
  contexto                  jsonb NOT NULL DEFAULT '{}',
  -- Contador otimista: temporizadores carregam a versão que esperam.
  versao                    int NOT NULL DEFAULT 0,
  expiracoes                int NOT NULL DEFAULT 0,
  supervisor_notificado_em  timestamptz,
  resumo                    text,
  entrou_fila_em            timestamptz,
  primeira_resposta_em      timestamptz,
  ultima_msg_solicitante_em timestamptz,
  ultima_msg_equipe_em      timestamptz,
  resolvida_em              timestamptz,
  encerrada_em              timestamptz,
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK (origem = 'interna' OR solicitante_id IS NOT NULL),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, solicitante_id) REFERENCES solicitante (org_id, id),
  FOREIGN KEY (org_id, canal_id) REFERENCES canal_whatsapp (org_id, id),
  FOREIGN KEY (org_id, pai_id) REFERENCES solicitacao (org_id, id),
  FOREIGN KEY (org_id, criado_por) REFERENCES pessoa (org_id, id),
  FOREIGN KEY (org_id, setor_id) REFERENCES setor (org_id, id),
  FOREIGN KEY (org_id, responsavel_id) REFERENCES pessoa (org_id, id),
  FOREIGN KEY (org_id, local_id) REFERENCES local (org_id, id),
  FOREIGN KEY (org_id, jornada_versao_id) REFERENCES jornada_versao (org_id, id)
);
CREATE INDEX solicitacao_fila ON solicitacao (setor_id, estado, entrou_fila_em) WHERE estado IN ('na_fila', 'oferecida');
CREATE INDEX solicitacao_responsavel ON solicitacao (responsavel_id) WHERE estado IN ('em_atendimento', 'aguardando_solicitante');
CREATE INDEX solicitacao_solicitante ON solicitacao (solicitante_id, unidade_id, criado_em DESC);
CREATE INDEX solicitacao_unidade ON solicitacao (unidade_id, estado, atualizado_em DESC);
CREATE INDEX solicitacao_pai ON solicitacao (pai_id) WHERE pai_id IS NOT NULL;

CREATE TABLE mensagem (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  solicitacao_id    uuid NOT NULL,
  autor_tipo        text NOT NULL CHECK (autor_tipo IN ('solicitante', 'pessoa', 'ia', 'sistema')),
  autor_pessoa_id   uuid,
  -- Nota interna é mensagem interna: nunca traduzida, nunca enviada.
  visibilidade      text NOT NULL CHECK (visibilidade IN ('externa', 'interna')),
  tipo              text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio', 'documento')),
  -- Original imutável.
  texto             text,
  midia_chave       text,
  midia_mime        text,
  idioma            text,
  wa_message_id     text UNIQUE,
  status_envio      text NOT NULL DEFAULT 'recebida'
                      CHECK (status_envio IN ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou', 'nao_enviar')),
  tentativas_envio  int NOT NULL DEFAULT 0,
  erro_envio        text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK (visibilidade = 'externa' OR autor_tipo IN ('pessoa', 'sistema', 'ia')),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id),
  FOREIGN KEY (org_id, autor_pessoa_id) REFERENCES pessoa (org_id, id)
);
CREATE INDEX mensagem_solicitacao ON mensagem (solicitacao_id, criado_em);

-- Derivados: transcrição, tradução, descrição. Refazer uma tradução não destrói nada.
CREATE TABLE mensagem_derivado (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  mensagem_id  uuid NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('transcricao', 'traducao', 'descricao')),
  idioma       text NOT NULL,
  texto        text NOT NULL,
  modelo       text NOT NULL,
  -- Cadeia explícita: áudio → transcrição → tradução.
  origem_id    uuid,
  -- Números/horários do original que não apareceram na tradução.
  alerta       text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, mensagem_id) REFERENCES mensagem (org_id, id),
  FOREIGN KEY (org_id, origem_id) REFERENCES mensagem_derivado (org_id, id)
);
CREATE INDEX mensagem_derivado_mensagem ON mensagem_derivado (mensagem_id);

CREATE TABLE oferta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  solicitacao_id  uuid NOT NULL,
  pessoa_id       uuid NOT NULL,
  ofertada_em     timestamptz NOT NULL DEFAULT now(),
  expira_em       timestamptz NOT NULL,
  resultado       text NOT NULL DEFAULT 'pendente'
                    CHECK (resultado IN ('pendente', 'aceita', 'expirada', 'recusada', 'cancelada')),
  respondida_em   timestamptz,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id)
);
-- No máximo uma oferta pendente por solicitação.
CREATE UNIQUE INDEX oferta_pendente ON oferta (solicitacao_id) WHERE resultado = 'pendente';
CREATE INDEX oferta_pessoa ON oferta (pessoa_id, ofertada_em DESC);

CREATE TABLE decisao_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  solicitacao_id  uuid NOT NULL,
  mensagem_id     uuid,
  motor           text NOT NULL,
  metodo_confianca text NOT NULL,
  entrada         jsonb NOT NULL,
  opcoes          jsonb NOT NULL,
  saida           jsonb NOT NULL,
  setor_escolhido text,
  confianca       real,
  latencia_ms     int NOT NULL,
  acao            text NOT NULL,
  -- Motores rodando em sombra registram a decisão sem agir.
  sombra          boolean NOT NULL DEFAULT false,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id),
  FOREIGN KEY (org_id, mensagem_id) REFERENCES mensagem (org_id, id)
);
CREATE INDEX decisao_ia_solicitacao ON decisao_ia (solicitacao_id, criado_em DESC);

CREATE TABLE correcao (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  decisao_id         uuid NOT NULL,
  setor_previsto_id  uuid,
  setor_correto_id   uuid NOT NULL,
  pessoa_id          uuid NOT NULL,
  texto              text NOT NULL,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, decisao_id) REFERENCES decisao_ia (org_id, id),
  FOREIGN KEY (org_id, setor_previsto_id) REFERENCES setor (org_id, id),
  FOREIGN KEY (org_id, setor_correto_id) REFERENCES setor (org_id, id),
  FOREIGN KEY (org_id, pessoa_id) REFERENCES pessoa (org_id, id)
);

-- Log imutável de tudo, inclusive o que a IA fez e quem viu o quê.
CREATE TABLE evento (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES organizacao (id),
  solicitacao_id  uuid,
  tipo            text NOT NULL,
  ator_tipo       text NOT NULL CHECK (ator_tipo IN ('solicitante', 'pessoa', 'ia', 'sistema')),
  ator_id         uuid,
  dados           jsonb NOT NULL DEFAULT '{}',
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evento_solicitacao ON evento (solicitacao_id, id) WHERE solicitacao_id IS NOT NULL;
CREATE INDEX evento_org_tempo ON evento (org_id, criado_em DESC);

-- ---------------------------------------------------------------------
-- Comunicação interna e base de conhecimento
-- ---------------------------------------------------------------------

CREATE TABLE conversa_interna (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  unidade_id      uuid NOT NULL,
  participantes   uuid[] NOT NULL,
  solicitacao_id  uuid,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id),
  FOREIGN KEY (org_id, solicitacao_id) REFERENCES solicitacao (org_id, id)
);
CREATE INDEX conversa_interna_participantes ON conversa_interna USING gin (participantes);

CREATE TABLE mensagem_interna (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  conversa_id  uuid NOT NULL,
  autor_id     uuid NOT NULL,
  texto        text NOT NULL,
  urgente      boolean NOT NULL DEFAULT false,
  ciente_em    timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, conversa_id) REFERENCES conversa_interna (org_id, id),
  FOREIGN KEY (org_id, autor_id) REFERENCES pessoa (org_id, id)
);
CREATE INDEX mensagem_interna_conversa ON mensagem_interna (conversa_id, criado_em);

CREATE TABLE base_conhecimento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  unidade_id  uuid NOT NULL,
  chave       text NOT NULL,
  pergunta    text NOT NULL,
  resposta    text NOT NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  ativo       boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, id),
  UNIQUE (unidade_id, chave),
  FOREIGN KEY (org_id, unidade_id) REFERENCES unidade (org_id, id)
);

-- ---------------------------------------------------------------------
-- Tabelas de sistema (fora da RLS, acesso restrito)
-- ---------------------------------------------------------------------

-- O webhook grava o payload bruto e responde 200 na hora. Processamento idempotente.
CREATE TABLE sistema.webhook_bruto (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recebido_em    timestamptz NOT NULL DEFAULT now(),
  payload        jsonb NOT NULL,
  processado_em  timestamptz,
  erro           text
);

-- Usada pelo adaptador Postgres do Socket.IO para mensagens grandes.
CREATE TABLE sistema.socket_io_attachments (
  id          bigserial UNIQUE,
  created_at  timestamptz DEFAULT now(),
  payload     bytea
);

-- ---------------------------------------------------------------------
-- Imutabilidade
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION proibir_alteracao() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% é imutável', TG_TABLE_NAME;
END $$;

CREATE TRIGGER evento_imutavel BEFORE UPDATE OR DELETE ON evento
  FOR EACH ROW EXECUTE FUNCTION proibir_alteracao();
CREATE TRIGGER jornada_versao_imutavel BEFORE UPDATE OR DELETE ON jornada_versao
  FOR EACH ROW EXECUTE FUNCTION proibir_alteracao();

CREATE OR REPLACE FUNCTION mensagem_original_imutavel() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.texto IS DISTINCT FROM OLD.texto
     OR NEW.midia_chave IS DISTINCT FROM OLD.midia_chave
     OR NEW.visibilidade IS DISTINCT FROM OLD.visibilidade
     OR NEW.autor_tipo IS DISTINCT FROM OLD.autor_tipo
     OR NEW.solicitacao_id IS DISTINCT FROM OLD.solicitacao_id THEN
    RAISE EXCEPTION 'o original da mensagem é imutável';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER mensagem_imutavel BEFORE UPDATE ON mensagem
  FOR EACH ROW EXECUTE FUNCTION mensagem_original_imutavel();

CREATE OR REPLACE FUNCTION tocar_atualizado_em() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;

CREATE TRIGGER solicitacao_atualizada BEFORE UPDATE ON solicitacao
  FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- Row Level Security em todas as tabelas de negócio
-- ---------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizacao', 'unidade', 'jornada_versao', 'canal_whatsapp', 'politica_escalonamento', 'setor', 'local',
    'pessoa', 'lotacao', 'dispositivo', 'presenca', 'solicitante', 'hospede_ativo', 'vinculo', 'solicitacao',
    'mensagem', 'mensagem_derivado', 'oferta', 'decisao_ia', 'correcao', 'evento', 'conversa_interna',
    'mensagem_interna', 'base_conhecimento'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY isolamento ON %I USING (org_id = app_org()) WITH CHECK (org_id = app_org())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO ramais_app', t);
    EXECUTE format('GRANT SELECT ON %I TO ramais_sistema', t);
  END LOOP;
END $$;

-- O log de eventos é só de inserção para a aplicação.
REVOKE UPDATE, DELETE ON evento FROM ramais_app;
REVOKE UPDATE, DELETE ON jornada_versao FROM ramais_app;

GRANT USAGE ON SCHEMA sistema TO ramais_app, ramais_sistema;
GRANT SELECT, INSERT, UPDATE ON sistema.webhook_bruto TO ramais_app;
GRANT SELECT, INSERT, DELETE ON sistema.socket_io_attachments TO ramais_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sistema TO ramais_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ramais_app;
GRANT EXECUTE ON FUNCTION app_org() TO ramais_app, ramais_sistema;
-- Necessário para transferir a posse das funções abaixo.
GRANT CREATE ON SCHEMA sistema TO ramais_sistema;

-- ---------------------------------------------------------------------
-- Funções entre organizações (SECURITY DEFINER, donas: ramais_sistema)
-- Cada uma devolve só o mínimo para a aplicação abrir a transação com o org certo.
-- ---------------------------------------------------------------------

CREATE FUNCTION sistema.resolver_canal(p_phone_number_id text)
  RETURNS TABLE (org_id uuid, unidade_id uuid, canal_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT c.org_id, c.unidade_id, c.id FROM canal_whatsapp c
     WHERE c.phone_number_id = p_phone_number_id AND c.ativo
  $$;

CREATE FUNCTION sistema.resolver_login(p_email text)
  RETURNS TABLE (org_id uuid, pessoa_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT p.org_id, p.id FROM pessoa p WHERE lower(p.email) = lower(p_email) AND p.ativo
  $$;

CREATE FUNCTION sistema.resolver_codigo_dispositivo(p_hash text)
  RETURNS TABLE (org_id uuid, unidade_id uuid, dispositivo_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT d.org_id, d.unidade_id, d.id FROM dispositivo d
     WHERE d.codigo_cadastro_hash = p_hash AND d.codigo_expira_em > now() AND d.ativo
  $$;

-- Rede de segurança dos temporizadores: o que venceu e ninguém tratou.
CREATE FUNCTION sistema.pendencias_varredura(p_folga_seg int DEFAULT 30)
  RETURNS TABLE (org_id uuid, tipo text, ref_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.org_id, 'oferta_vencida', o.id FROM oferta o
     WHERE o.resultado = 'pendente' AND o.expira_em < now() - make_interval(secs => p_folga_seg)
    UNION ALL
    SELECT s.org_id, 'setor_com_fila', s.setor_id FROM solicitacao s
     WHERE s.estado = 'na_fila' AND s.setor_id IS NOT NULL
       AND s.entrou_fila_em < now() - make_interval(secs => p_folga_seg)
     GROUP BY s.org_id, s.setor_id
    UNION ALL
    SELECT p.org_id, 'presenca_inativa', p.id FROM presenca p
      JOIN unidade u ON u.id = p.unidade_id
      JOIN jornada_versao j ON j.id = u.jornada_versao_id
     WHERE p.fim IS NULL
       AND p.ultima_atividade < now() - make_interval(mins => coalesce((j.config #>> '{tempos,presencaInatividadeMin}')::int, 240))
  $$;

ALTER FUNCTION sistema.resolver_canal(text) OWNER TO ramais_sistema;
ALTER FUNCTION sistema.resolver_login(text) OWNER TO ramais_sistema;
ALTER FUNCTION sistema.resolver_codigo_dispositivo(text) OWNER TO ramais_sistema;
ALTER FUNCTION sistema.pendencias_varredura(int) OWNER TO ramais_sistema;

REVOKE ALL ON FUNCTION sistema.resolver_canal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sistema.resolver_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sistema.resolver_codigo_dispositivo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sistema.pendencias_varredura(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.resolver_canal(text) TO ramais_app;
GRANT EXECUTE ON FUNCTION sistema.resolver_login(text) TO ramais_app;
GRANT EXECUTE ON FUNCTION sistema.resolver_codigo_dispositivo(text) TO ramais_app;
GRANT EXECUTE ON FUNCTION sistema.pendencias_varredura(int) TO ramais_app;
