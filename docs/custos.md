# Custos: IA e canal (WhatsApp × chat do quarto)

Medido em 06/10/2026 com o teste de carga (`pnpm carga`): hóspedes em 10 idiomas pelo WhatsApp (Meta em dry-run) e pelo chat do quarto, com texto, áudio e foto, e uma equipe-robô atendendo. O custo da IA é o que a OpenRouter cobrou: o registro do sistema (tabela `uso_ia`) bateu com o uso da chave nas três rodadas, com diferença abaixo de 1%.

## 1. IA: três configurações testadas

| | Atual | A | **B (recomendada)** |
|---|---|---|---|
| Roteamento | Jev 1.13 | Jev 1.13 | Jev 1.13 |
| Tradução | gemini-3.1-flash-lite | mistral-small-24b | **gemini-2.5-flash-lite** (reserva: gemini-3.1-flash-lite) |
| Base de conhecimento | gemini-3.5-flash-lite | gemini-2.5-flash-lite | **gemini-2.5-flash-lite** |
| Mensagens de hóspedes | 699 | 281 | 279 |
| **Custo por mensagem** | US$ 0,00049 | US$ 0,00015 | **US$ 0,00019** |
| **Custo por pedido** | US$ 0,0011 | US$ 0,0004 | **US$ 0,0004** |
| Projeção por 1.000 mensagens | US$ 0,49 | US$ 0,15 | **US$ 0,19** |
| Roteamento certo | 91,7%¹ | 94,9% | **97,5%** |
| Tradução para a equipe | 90,6% | 96,4% | **100%** |
| Tradução para o hóspede | 57%¹ | 90,9%² | **100%** |
| Áudios transcritos | 72%¹ | 100% | **100%** |
| Falhas de IA | 0 | 38 (limite do provedor)² | **0** (4 salvas pela reserva) |
| 1ª resposta da equipe (mediana) | 44 s | 52 s | 34 s |
| Erros, mensagens perdidas | 0 | 0 | 0 |

¹ Rodada feita antes de corrigir dois defeitos encontrados por ela (mídia do WhatsApp e troca de idioma por mensagem curta).
² O mistral-small-24b é barato, mas com a exigência de provedor sem retenção de dados sobram poucos provedores, e eles batem no limite com ~1 mensagem por segundo. Ainda não havia modelo de reserva para tradução; hoje há.

**Recomendação: configuração B.** Custa 61% menos que a atual e foi a melhor em qualidade. A A é ~20% mais barata que a B, mas depende de um provedor que não aguentou a carga. Para adotar a B, acrescente ao `.env` e reinicie api e worker:

```
IA_MODELO_TRADUCAO=google/gemini-2.5-flash-lite
IA_MODELO_TRADUCAO_ALTERNATIVO=google/gemini-3.1-flash-lite
IA_MODELO_RESPOSTA=google/gemini-2.5-flash-lite
```

### Para onde vai o dinheiro (configuração B)

| Tarefa | Parte do custo | Observação |
|---|---:|---|
| Resposta pela base de conhecimento | 34% | 2 chamadas por pergunta (autoconsistência, para medir a certeza) |
| Roteamento (Jev) | 30% | 1 chamada por mensagem do hóspede |
| Tradução | 29% | equipe ↔ hóspede, mais o "pivô" em inglês para o roteamento |
| Transcrição e descrição de foto | 7% | |

### Ainda dá para cortar (não testado)

- **Pular a tradução quando a mensagem já está em português** (hoje vai uma chamada que devolve o mesmo texto) e **desligar o pivô em inglês** (`IA_PIVOT_INGLES`), se o roteamento continuar bom sem ele: a tradução pode cair pela metade.
- **Uma amostra na base de conhecimento** em vez de duas: corta um terço do custo, mas perde a medida de certeza que evita respostas erradas. Medir antes.

## 2. Canal: WhatsApp × chat do quarto

### O que a Meta cobra (Brasil, outubro de 2026)

- Mensagem do hóspede para o hotel: **grátis**.
- **Mensagens de serviço** (as respostas dentro da janela de 24 h desde a última mensagem do hóspede, que são quase todas as do Ramais):
  - pela documentação oficial da Meta, **grátis** ("All non-template messages are free");
  - parceiros da Meta informam que, desde **1º/10/2026**, o rate card em BRL passou a cobrar **R$ 0,0350 por mensagem de serviço acima de 1.000 por número por mês**. **Confirme na fatura do Business Manager antes de fechar preço.**
- Modelo de utilidade (o Ramais usa quando responde depois de 24 h sem o hóspede escrever): R$ 0,0350.
- Sem intermediário (BSP): o Ramais fala direto com a Cloud API da Meta, sem taxa de terceiros.

No teste, cada pedido gerou em média **4,3 mensagens do hotel para o hóspede**: boas-vindas, "encaminhado", resposta da equipe, "concluído", pesquisa e agradecimento.

### O que o chat do quarto custa

Nada para a Meta. O custo é o da infraestrutura (servidor, banco, arquivos), que é o mesmo para os dois canais e não entra na comparação.

### Comparação por hotel (configuração B de IA)

Premissas: 0,5 pedido por quarto ocupado por dia, 70% de ocupação, dólar a R$ 5,50.

| Hotel | Pedidos/mês | IA | WhatsApp, cenário 1 (serviço grátis) | WhatsApp, cenário 2 (serviço cobrado) | Chat do quarto |
|---|---:|---:|---:|---:|---:|
| 60 quartos | 630 | R$ 1,52 | ~R$ 1 | R$ 60 | R$ 0 |
| 150 quartos | 1.575 | R$ 3,81 | ~R$ 2 | R$ 202 | R$ 0 |
| 400 quartos | 4.200 | R$ 10,16 | ~R$ 4 | R$ 597 | R$ 0 |

Cenário 2: (pedidos × 4,3 − 1.000 grátis) × R$ 0,0350. Os "~R$" do cenário 1 são modelos de utilidade fora da janela (estimados em 3% dos pedidos).

**Leitura:**
- **A IA é barata em qualquer cenário**: cerca de R$ 0,0024 por pedido na configuração B.
- **Se a cobrança de serviço da Meta estiver valendo, o canal passa a ser o custo principal**: ~R$ 0,15 por pedido no WhatsApp contra R$ 0 no chat do quarto. Juntar as mensagens automáticas ("recebemos" + "encaminhado" numa só, por exemplo) baixaria isso em ~20%.
- **O chat do quarto não avisa o hóspede quando a equipe responde** se a página estiver fechada; o WhatsApp avisa. Notificação do navegador (Web Push, gratuita) resolve isso e vale fazer antes de oferecer o chat do quarto como canal principal.

### Fontes (preço da Meta)

- [WhatsApp Business Platform — Pricing (Meta)](https://developers.facebook.com/docs/whatsapp/pricing)
- [Updates to pricing (Meta)](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- [Preços da API do WhatsApp em outubro de 2026 (Zappy)](https://www.zappy.chat/novos-precos-whatsapp-api-outubro-2026-zappy/)
- [Tabela de preços WhatsApp API 2026 no Brasil (Wizebot)](https://wizebot.com.br/blog/tabela-precos-whatsapp-business-api-2026)
- [Preço WhatsApp Business API Brasil 2026 (SocialHub)](https://www.socialhub.pro/blog/preco-whatsapp-api-2026-brasil/)

## 3. Como repetir

```bash
pnpm carga -- --mensagens 300 --minutos 6
```

Para outra combinação de modelos, suba api e worker com as variáveis `IA_MODELO_*` desejadas e rode de novo. O relatório sai em `.dev/carga-relatorio-<id>.md` e a unidade criada aparece no Dashboard, com o custo por tarefa e por modelo. Para uma prova rápida de modelos (tradução e base, sem carga): `npx tsx packages/ai/prova-modelos.mts <modelo> …`.
