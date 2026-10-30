-- =====================================================================
-- 0017 — cartões no chat e escolha de quarto antes da tarifa
--
-- A reserva pela conversa mostra os quartos em cartões (foto, preço a partir de, café,
-- cancelamento), depois as tarifas do quarto escolhido, o resumo com diárias e impostos e o
-- pagamento com botão. O cartão vai junto da mensagem: o texto continua sendo a versão completa
-- (equipe, tradução e WhatsApp fora da janela); o chat e o WhatsApp desenham o cartão.
-- =====================================================================

ALTER TABLE mensagem ADD COLUMN cartao jsonb;

-- 'tarifas': o hóspede escolheu o quarto e vê as tarifas dele.
ALTER TABLE reserva_hospedagem DROP CONSTRAINT reserva_hospedagem_estado_check;
ALTER TABLE reserva_hospedagem ADD CONSTRAINT reserva_hospedagem_estado_check
  CHECK (estado IN ('coletando', 'opcoes', 'tarifas', 'titular', 'cotada', 'aguardando_pagamento', 'paga',
                    'recusada', 'expirada', 'cancelada', 'estornada', 'desistiu', 'erro'));
