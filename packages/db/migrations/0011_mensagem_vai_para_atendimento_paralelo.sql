-- =====================================================================
-- 0011 — a mensagem pode passar para outro atendimento do mesmo hóspede
--
-- Pedido de outro setor feito no meio de um atendimento ("está com um vazamento" enquanto o
-- restaurante cuida da Coca) abre um atendimento paralelo. A mensagem chega no atendimento em
-- andamento (a ordem da conversa vem primeiro; o roteamento é depois) e precisa ir para o
-- paralelo: senão quem atende a manutenção só vê uma nota do sistema e o restaurante fica com
-- uma fala que não é dele.
--
-- Mudar de atendimento só vale entre atendimentos do MESMO solicitante. Texto, arquivo,
-- visibilidade e autor continuam imutáveis.
-- =====================================================================

CREATE OR REPLACE FUNCTION mensagem_original_imutavel() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.texto IS DISTINCT FROM OLD.texto
     OR (NEW.midia_chave IS DISTINCT FROM OLD.midia_chave AND OLD.midia_chave IS NOT NULL)
     OR NEW.visibilidade IS DISTINCT FROM OLD.visibilidade
     OR NEW.autor_tipo IS DISTINCT FROM OLD.autor_tipo THEN
    RAISE EXCEPTION 'o original da mensagem é imutável';
  END IF;
  IF NEW.solicitacao_id IS DISTINCT FROM OLD.solicitacao_id AND NOT EXISTS (
       SELECT 1 FROM solicitacao a JOIN solicitacao b ON b.solicitante_id = a.solicitante_id
        WHERE a.id = OLD.solicitacao_id AND b.id = NEW.solicitacao_id) THEN
    RAISE EXCEPTION 'a mensagem só pode mudar para outro atendimento do mesmo solicitante';
  END IF;
  RETURN NEW;
END $$;
