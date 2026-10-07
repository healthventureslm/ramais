-- =====================================================================
-- 0003 — simulador do construtor
--
-- O admin testa o rascunho do fluxo como se fosse um hóspede. A conversa de teste:
--   - usa uma versão de rascunho da jornada (não publicada);
--   - nunca vai para a Meta, nunca é ofertada à equipe, não aparece nas listas
--     nem no dashboard e não conta nas estatísticas da IA.
-- =====================================================================

ALTER TABLE solicitacao ADD COLUMN teste boolean NOT NULL DEFAULT false;
CREATE INDEX solicitacao_teste ON solicitacao (solicitante_id) WHERE teste;

-- Rascunhos ficam na mesma tabela (a solicitação de teste aponta para eles), sem número.
ALTER TABLE jornada_versao ADD COLUMN rascunho boolean NOT NULL DEFAULT false;
ALTER TABLE jornada_versao DROP CONSTRAINT jornada_versao_unidade_id_numero_key;
CREATE UNIQUE INDEX jornada_versao_numero ON jornada_versao (unidade_id, numero) WHERE NOT rascunho;

-- A varredura ignora conversas de teste.
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
  $$;
ALTER FUNCTION sistema.pendencias_varredura(int) OWNER TO ramais_sistema;
