-- =====================================================================
-- 0015 — vários itens num atendimento
--
-- O hóspede monta o pedido conversando ("um hambúrguer e uma água"): os itens do mesmo setor
-- viram um atendimento só, e a equipe confirma, lança e entrega tudo junto.
-- =====================================================================

DROP INDEX pedido_solicitacao;
CREATE INDEX pedido_solicitacao ON pedido (solicitacao_id);
