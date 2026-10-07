-- =====================================================================
-- 0005 — ordem das mensagens
--
-- now() é o início da transação: boas-vindas e a primeira pergunta, gravadas juntas,
-- ficavam com o mesmo horário e a conversa podia aparecer fora de ordem.
-- clock_timestamp() avança dentro da transação.
-- =====================================================================

ALTER TABLE mensagem ALTER COLUMN criado_em SET DEFAULT clock_timestamp();
ALTER TABLE evento ALTER COLUMN criado_em SET DEFAULT clock_timestamp();
