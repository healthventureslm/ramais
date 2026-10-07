-- =====================================================================
-- 0004 — gestão pela tela
--
-- Pessoas criadas pelo admin recebem uma senha temporária e trocam no primeiro acesso.
-- =====================================================================

ALTER TABLE pessoa ADD COLUMN trocar_senha boolean NOT NULL DEFAULT false;
ALTER TABLE pessoa ADD COLUMN criado_por uuid;
