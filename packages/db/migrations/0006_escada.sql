-- =====================================================================
-- 0006 — escada de escalonamento configurável
--
-- A escada mora na configuração versionada da jornada (por unidade e por setor).
-- Aqui fica só o estado de cada solicitação:
--   espera_desde        desde quando o solicitante espera a equipe (os avisos contam daqui)
--   atendente_desde     desde quando o responsável atual tem a conversa (lembrar e passar adiante)
--   escada_feitos       passos já executados nesta espera
--   escada_proxima_em   quando olhar de novo (rede de segurança da varredura)
--   excluir_distribuicao quem não deve receber de novo (passou adiante por falta de resposta)
-- =====================================================================

ALTER TABLE solicitacao
  ADD COLUMN espera_desde         timestamptz,
  ADD COLUMN atendente_desde      timestamptz,
  ADD COLUMN escada_feitos        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN escada_proxima_em    timestamptz,
  ADD COLUMN excluir_distribuicao uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX solicitacao_escada ON solicitacao (escada_proxima_em) WHERE escada_proxima_em IS NOT NULL;

-- O preenchimento do que já estava aberto fica na 0007 (precisa passar organização por organização).

-- A tabela de políticas nunca foi usada: a escada é configuração versionada.
ALTER TABLE setor DROP COLUMN politica_escalonamento_id;
DROP TABLE politica_escalonamento;

CREATE OR REPLACE FUNCTION sistema.pendencias_varredura(p_folga_seg int DEFAULT 30)
  RETURNS TABLE (org_id uuid, tipo text, ref_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.org_id, 'oferta_vencida', o.id FROM oferta o
     WHERE o.resultado = 'pendente' AND o.expira_em < now() - make_interval(secs => p_folga_seg)
    UNION ALL
    SELECT s.org_id, 'setor_com_fila', s.setor_id FROM solicitacao s
     WHERE s.estado = 'na_fila' AND s.setor_id IS NOT NULL AND NOT s.teste
       AND s.entrou_fila_em < now() - make_interval(secs => p_folga_seg)
     GROUP BY s.org_id, s.setor_id
    UNION ALL
    SELECT p.org_id, 'presenca_inativa', p.id FROM presenca p
      JOIN unidade u ON u.id = p.unidade_id
      JOIN jornada_versao j ON j.id = u.jornada_versao_id
     WHERE p.fim IS NULL
       AND p.ultima_atividade < now() - make_interval(mins => coalesce((j.config #>> '{tempos,presencaInatividadeMin}')::int, 240))
    UNION ALL
    SELECT s.org_id, 'escada', s.id FROM solicitacao s
     WHERE s.escada_proxima_em < now() - make_interval(secs => p_folga_seg) AND NOT s.teste
  $$;
ALTER FUNCTION sistema.pendencias_varredura(int) OWNER TO ramais_sistema;
