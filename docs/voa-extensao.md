# Extensão de estadia: proposta de rota para a API de parceiros da VOA

O hóspede já hospedado pede, pelo chat do quarto, para ficar mais noites. Hoje a API de parceiros
não tem rota para isso, então o Ramais **simula** a resposta abaixo (`apps/api/src/infra/voa.ts`,
`cotarExtensao` e `confirmarExtensao`). O preço da simulação é real: sai da busca de disponibilidade
(`GET /api/ota/hotel/{id}/search`) para as noites a mais, com a mesma ocupação.

O fluxo no Ramais:

1. "Quero ficar mais 2 noites" → cotação (passo 1 abaixo).
2. O hóspede confirma → o Ramais cria um link de pagamento no Salabim Pay com o valor da cotação.
3. Pago → o Ramais confirma a extensão (passo 2) e avisa o hóspede e a recepção.

A proposta segue o formato das rotas que já existem (`{ status, data }`, valores em reais, ISS como na busca).

## 1. Cotação

`POST /api/ota/hotel/{hotelId}/booking/{bookingId}/extension/quote`

```json
{
  "check_out": "2026-11-03",
  "room_number": "302"
}
```

- `bookingId`: o código da reserva atual (`VOA-…`). Se o parceiro não tiver o código, aceitar o número do quarto (`room_number`) e o hotel acha a reserva ativa dele.
- `check_out`: a nova data de saída. A entrada das noites a mais é o check-out atual da reserva.

Resposta (`200`):

```json
{
  "status": true,
  "data": {
    "quote_id": "ext_9f2c1d0a4b6e4f8c",
    "booking_id": "VOA-ANEW8P",
    "available": true,
    "reason": null,
    "room": { "id": 332, "name": "Deluxe Casal", "number": "302" },
    "rate": { "id": 86, "name": "Motor de Reservas", "type": "HOSTING_WITH_BREAKFAST", "type_formated": "Com café da manhã", "cancelable": true },
    "current": { "check_out": "2026-11-01" },
    "extension": { "check_in": "2026-11-01", "check_out": "2026-11-03", "nights": 2 },
    "prices": [
      { "date": "2026-11-01", "total": 350.0 },
      { "date": "2026-11-02", "total": 350.0 }
    ],
    "iss_tax": 5,
    "price_include_iss_tax": false,
    "total": 735.0,
    "currency": "BRL",
    "expires": "2026-10-28T18:30:00Z"
  }
}
```

- `total`: o valor final das noites a mais, **já com ISS** (o que o hóspede paga).
- Sem disponibilidade no mesmo quarto: `available: false` e `reason` em texto (ex.: "quarto ocupado a partir de 02/11"). Opcional: `alternatives` com outros quartos, no formato de `rooms` da busca, para o hóspede trocar de quarto.
- `expires`: até quando a cotação segura o preço (como a busca, 30 min).

## 2. Confirmação (depois do pagamento)

`POST /api/ota/hotel/{hotelId}/booking/{bookingId}/extension`

```json
{
  "quote_id": "ext_9f2c1d0a4b6e4f8c",
  "payment": {
    "provider": "salabim_pay",
    "id": "pl_7bf6c7febba2415aad973f8cd6291029",
    "amount": 735.0,
    "paid_at": "2026-10-28T17:12:44Z"
  },
  "created_by": "Ramais (atendimento automático)"
}
```

- `payment.provider`: `salabim_pay` (link pago pelo hóspede) ou `room_bill` (vai para a conta do quarto, sem pagamento antecipado).
- `payment.id`: o id do link de pagamento no Salabim Pay, para a conciliação.

Resposta (`200`):

```json
{
  "status": true,
  "data": {
    "extension_id": "ext_9f2c1d0a4b6e4f8c",
    "booking_id": "VOA-ANEW8P",
    "status": "CONFIRMED",
    "check_in": "2026-11-01",
    "check_out": "2026-11-03",
    "nights_added": 2,
    "total_paid": 735.0,
    "payment": { "provider": "salabim_pay", "id": "pl_7bf6c7febba2415aad973f8cd6291029", "paid_at": "2026-10-28T17:12:44Z" }
  }
}
```

- `booking_id`: o mesmo da reserva (a extensão não cria outra reserva). Se o PMS precisar criar uma reserva nova emendada, devolver o código novo aqui.
- `status: "REJECTED"` com `reason`, se o quarto foi ocupado entre a cotação e o pagamento (a cotação venceu ou outro canal vendeu). O Ramais avisa a recepção para resolver o reembolso.

## Erros

Os mesmos das rotas atuais: `401` token inválido, `404` reserva ou hotel não encontrado, `406` sem disponibilidade (como na oferta), `422` dados inválidos (`check_out` antes do check-out atual, cotação vencida).

## Webhook (opcional)

Se a extensão também puder ser feita por outro canal, um evento `booking.extended` no webhook que já existe (`payment.updated`) com `booking_id`, `check_out` novo e `nights_added` mantém o Ramais (e o chat do quarto, que vence no check-out) em dia.
