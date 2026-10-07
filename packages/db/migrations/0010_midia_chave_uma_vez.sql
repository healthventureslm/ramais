-- =====================================================================
-- 0010 — o arquivo de uma mensagem recebida pode ser anotado uma vez
--
-- A mensagem do WhatsApp é gravada antes de baixar a mídia (a ordem por conversa vem
-- primeiro); o arquivo baixado é anotado depois. A trava de imutabilidade proibia
-- também essa primeira anotação, e toda foto e áudio do WhatsApp ficava sem arquivo,
-- sem transcrição e sem roteamento. Agora vale preencher uma vez (de vazio para um valor);
-- trocar ou apagar o arquivo continua proibido.
-- =====================================================================

CREATE OR REPLACE FUNCTION mensagem_original_imutavel() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.texto IS DISTINCT FROM OLD.texto
     OR (NEW.midia_chave IS DISTINCT FROM OLD.midia_chave AND OLD.midia_chave IS NOT NULL)
     OR NEW.visibilidade IS DISTINCT FROM OLD.visibilidade
     OR NEW.autor_tipo IS DISTINCT FROM OLD.autor_tipo
     OR NEW.solicitacao_id IS DISTINCT FROM OLD.solicitacao_id THEN
    RAISE EXCEPTION 'o original da mensagem é imutável';
  END IF;
  RETURN NEW;
END $$;
