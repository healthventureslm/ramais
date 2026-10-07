-- =====================================================================
-- 0002 — modo sombra
--
-- Cada setor tem um modo de IA:
--   sombra      a IA sugere o setor, mas o pedido vai para a triagem (setor de fallback,
--               normalmente a recepção), que confirma ou corrige com um toque.
--   automatico  a IA encaminha direto.
-- Cada confirmação ou correção fica registrada na decisão, e o acerto por setor diz
-- quando dá para liberar o automático.
-- =====================================================================

ALTER TABLE setor
  ADD COLUMN modo_ia text NOT NULL DEFAULT 'sombra' CHECK (modo_ia IN ('sombra', 'automatico'));

ALTER TABLE solicitacao
  ADD COLUMN triagem boolean NOT NULL DEFAULT false,
  ADD COLUMN setor_sugerido_id uuid,
  ADD COLUMN decisao_sugerida_id uuid,
  ADD FOREIGN KEY (org_id, setor_sugerido_id) REFERENCES setor (org_id, id),
  ADD FOREIGN KEY (org_id, decisao_sugerida_id) REFERENCES decisao_ia (org_id, id);

CREATE INDEX solicitacao_triagem ON solicitacao (unidade_id) WHERE triagem;

ALTER TABLE decisao_ia
  ADD COLUMN revisao text CHECK (revisao IN ('confirmada', 'corrigida')),
  ADD COLUMN revisada_por uuid,
  ADD COLUMN revisada_em timestamptz,
  ADD COLUMN setor_final_id uuid,
  ADD FOREIGN KEY (org_id, revisada_por) REFERENCES pessoa (org_id, id),
  ADD FOREIGN KEY (org_id, setor_final_id) REFERENCES setor (org_id, id);
