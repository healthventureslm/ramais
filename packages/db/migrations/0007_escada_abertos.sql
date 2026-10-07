-- =====================================================================
-- 0007 — escada para o que já estava aberto
--
-- Com FORCE ROW LEVEL SECURITY nem o dono do banco enxerga linhas sem `app.org_id`
-- (nem a própria tabela organizacao): um UPDATE solto numa migração não atinge nada.
-- Migração de dados passa organização por organização, listadas por uma função do
-- papel de sistema (BYPASSRLS), que só o dono pode chamar.
-- =====================================================================

CREATE OR REPLACE FUNCTION sistema.organizacoes()
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT id FROM organizacao $$;
ALTER FUNCTION sistema.organizacoes() OWNER TO ramais_sistema;
REVOKE ALL ON FUNCTION sistema.organizacoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.organizacoes() TO ramais_owner;

DO $$
DECLARE org uuid;
BEGIN
  FOR org IN SELECT * FROM sistema.organizacoes() LOOP
    PERFORM set_config('app.org_id', org::text, true);
    UPDATE solicitacao SET espera_desde = coalesce(entrou_fila_em, criado_em), escada_proxima_em = now()
     WHERE estado IN ('na_fila', 'oferecida') AND NOT teste AND espera_desde IS NULL;
    UPDATE solicitacao SET espera_desde = coalesce(ultima_msg_solicitante_em, atualizado_em),
                           atendente_desde = atualizado_em, escada_proxima_em = now()
     WHERE estado = 'em_atendimento' AND origem = 'externa' AND NOT teste AND espera_desde IS NULL;
  END LOOP;
  PERFORM set_config('app.org_id', '', true);
END $$;
