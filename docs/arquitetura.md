# Arquitetura — MVP hotel

Documento de referência para construir o MVP. Consolida as decisões tomadas a partir de
"Atendimento por linguagem natural — a ideia do projeto". As decisões ainda abertas estão
marcadas com **[A CONFIRMAR]**, e os ajustes propostos sobre as respostas originais com **[AJUSTE]**.

O MVP precisa provar uma coisa: **a mensagem chega à pessoa certa mais rápido.**

---

## 1. Escopo

### Entra no MVP

- WhatsApp de entrada: texto, imagem e áudio.
- Identificação por QR do quarto, com fallback por quarto e sobrenome.
- Tradução PT/ES/EN nos textos fixos e melhor esforço nos demais idiomas. Quem escreve em outro idioma recebe os textos fixos em inglês.
- Roteamento com gate de confiança.
- Respostas automáticas só a partir da base de conhecimento: a IA informa, não age.
- Transferência, pedidos de apoio (filhos), nota interna e mensagem direta entre pessoas.
- Distribuição por menor carga com aceite e escada de escalonamento configurável por setor (seção 17).
- Presença (entrar e sair do turno).
- Dashboard fixo.
- Gatilhos globais, inatividade e encerramento.

### Fica para depois

Agente com ações, construtor visual, hierarquia configurável pela interface, cartões
configuráveis, escala e outros provedores de disponibilidade, conectores com PMS, mensagem
para posto, avisos gerais, passagem de turno e mensagem proativa de boas-vindas.

### Jornada

O ciclo é fixo no código. A configuração da unidade fica em JSON versionado (textos, tempos,
catálogo de setores) e é validada por schema zod. O motor já executa blocos com o contrato
da seção 6, então o construtor futuro será só um editor desse JSON.

---

## 2. Stack

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript em tudo |
| Backend | NestJS, um código e dois processos: `api` e `worker` |
| Banco | Postgres 16 + Drizzle, migrações em SQL |
| Jobs e temporizadores | pg-boss |
| Tempo real | Socket.IO com `@socket.io/postgres-adapter` |
| Mídia | S3 |
| Web (recepção, supervisão) | React + Vite |
| App da equipe | Expo em build de desenvolvimento, `@react-native-firebase/messaging` + Notifee |
| IA | OpenRouter (roteamento, tradução, base de conhecimento, multimodal) |
| Hospedagem | AWS sa-east-1: ECS Fargate, RDS Postgres, S3, CloudFront |

Infraestrutura: só Postgres e S3, sem Redis.

Meta e OpenRouter processam dados fora do Brasil. Isso se resolve em contrato
(transferência internacional), não na hospedagem.

---

## 3. Processos e módulos

```
api     → webhook da Meta, REST, WebSocket
worker  → processamento de mensagens, IA, temporizadores, envio
```

Monólito modular. Os módulos são canais, solicitacoes, jornada, ia, distribuicao,
equipes-presenca, tempo-real, notificacoes, conectores e administracao.

As fronteiras entre módulos são garantidas por contrato (`packages/contracts`) e por lint de
importação: um módulo só importa a API pública de outro.

---

## 4. Multi-instituição e isolamento

- **organizacao** (rede, contrato, cobrança) é o tenant da RLS. **unidade** é o hotel.
- Setores, números de WhatsApp, catálogo e jornada pertencem à unidade. Pessoas pertencem à organização e são lotadas em setores.
- Coluna `org_id` em todas as tabelas, Row Level Security e chaves estrangeiras compostas com `org_id`.

**[AJUSTE] Cuidados de RLS que costumam causar vazamento:**

1. A aplicação conecta com um papel que **não** é dono das tabelas nem tem `BYPASSRLS`. Use também `ALTER TABLE … FORCE ROW LEVEL SECURITY`.
2. O tenant é definido com `set_config('app.org_id', $1, true)` (equivalente a `SET LOCAL`), dentro da transação. Assim o valor não sobrevive no pool de conexões.
3. A política falha fechada: sem `app.org_id` definido, nenhuma linha é retornada.
4. O worker processa jobs de vários tenants, então cada job carrega `org_id` e abre a própria transação com ele.
5. As tabelas do pg-boss, a tabela de webhooks brutos e a do adaptador do Socket.IO ficam fora da RLS, num schema próprio e com acesso restrito.
6. Há um teste automatizado que tenta ler dados de outra organização em cada tabela.

---

## 5. Modelo de dados

```
organizacao 1─N unidade
unidade     1─N canal_whatsapp        (phone_number_id, waba_id, modo_credencial)
unidade     1─N setor                 (descricao_roteamento, politica_distribuicao)
unidade     1─N local                 (quarto, leito ou sala; codigo_qr)
pessoa      N─N setor  via lotacao    (papel: membro|supervisor; recebe: sempre|ultimo_recurso|nunca; idiomas)
presenca                              (pessoa, unidade, inicio, fim)
solicitante (org, telefone) 1─N vinculo (unidade, local, periodo, origem)
solicitacao                           (unidade, solicitante?, origem externa|interna, pai_id?,
                                       setor_atual, responsavel_atual, estado, etapa, idioma,
                                       jornada_versao_id, contexto jsonb, versao int)
solicitacao 1─N mensagem              (autor, visibilidade externa|interna, original imutável, wa_message_id)
mensagem    1─N mensagem_derivado     (tipo: transcricao|traducao|descricao, idioma, texto, modelo, origem_id)
oferta                                (solicitacao, pessoa, ofertada_em, expira_em, resultado)
decisao_ia  1─N correcao              (motor, opcoes, escolha, confianca, latencia / previsto, correto, quem)
evento                                (log imutável de tudo, inclusive ações da IA)
jornada_versao                        (imutável)
conversa_interna 1─N mensagem_interna (mensagem direta; pode apontar para uma solicitação)
webhook_bruto                         (payload, recebido_em, processado_em) — fora da RLS
```

### Estados da solicitação

```
automacao → na_fila → oferecida → em_atendimento ⇄ aguardando_solicitante → resolvida → encerrada
     └──────────────────────────────── cancelada (o solicitante encerra antes)
```

- Se a oferta expira, a solicitação volta para `na_fila`.
- A transferência leva para `na_fila` em outro setor.
- Uma nova mensagem em `resolvida` dentro de 24 h reabre o caso. Depois disso, abre uma solicitação nova.
- Quando um filho é resolvido, é gerado um evento no pai.

---

## 6. Contratos plugáveis

Ficam em `packages/contracts`.

```ts
// Bloco de jornada
interface Bloco<C> {
  tipo: string; schemaConfig: ZodSchema<C>;
  executar(ctx: Contexto, ev: Evento, cfg: C): Promise<
    | { acao: 'aguardar'; por: 'mensagem' | 'timer' }
    | { acao: 'avancar'; vars?: Record<string, unknown> }
    | { acao: 'encaminhar'; setorId: string }
    | { acao: 'humano'; motivo: string }>;
} // erros: ErroRecuperavel (tenta de novo), ErroFatal (vai para humano)

// Motor de decisão
interface MotorDecisao {
  decidir(r: { estado: string; perguntas: Pergunta[] }): Promise<{
    respostas: { id: string; escolha: string; confianca: number;
                 probs?: Record<string, number> }[];
    motor: string; latenciaMs: number }>;
} // erros: Timeout, Indisponivel, SaidaInvalida → próximo motor da cadeia

// Ferramenta do agente
interface Ferramenta<I, O> {
  nome: string; descricao: string;
  nivel: 'ler' | 'informar' | 'agir_baixo' | 'agir_risco';
  entrada: ZodSchema<I>; saida: ZodSchema<O>;
  executar(ctx: Contexto, i: I): Promise<O>;
} // erros: SemPermissao, Falha

// Conector
interface Conector {
  sincronizar?(desde: Date): AsyncIterable<RegistroCanonico>;
  consultar?(q: ConsultaCanonica): Promise<ResultadoCanonico>;
} // erros: Auth, Indisponivel, DadoInvalido

// Disponibilidade e distribuição
interface ProvedorDisponibilidade {
  disponiveis(setorId: string, t: Date): Promise<Candidato[]>;
}
interface EstrategiaDistribuicao {
  escolher(cands: Candidato[], item: ItemFila): string | null; // pura e determinística
}

// Cartão do dashboard (fixos no MVP, mas já seguem o contrato)
interface Cartao<D> {
  id: string; consultar(escopo: Escopo): Promise<D>; canais: string[];
}
```

**Nova vertical:** um pacote em `packages/verticals/<nome>` com catálogo-modelo, jornada em
JSON, textos por idioma, templates e habilidades de filtro. Só é preciso escrever código
quando a vertical exige um bloco ou um conector novo.

---

## 7. Execução da jornada

### Caminho de uma mensagem

```
Meta ──POST──▶ api: valida assinatura, grava webhook_bruto, responde 200
                 │
                 ▼ job (idempotente por wa_message_id)
              worker: lock por conversa → interceptador de gatilhos → bloco da etapa atual
                 │                                   │
                 ▼                                   ▼
          IA (tradução, decisão)            distribuição / oferta / temporizadores
                 │
                 ▼
          evento + tempo real (web/app) + envio pela Meta
```

**[AJUSTE] Assinatura do webhook:** valide o `X-Hub-Signature-256` com o app secret antes
de gravar o payload.

**[AJUSTE] Chave do lock:** o lock consultivo usa a chave da conversa
(`canal_whatsapp_id + telefone`), não o `solicitacao_id`. Assim, duas mensagens
simultâneas de alguém sem solicitação aberta não criam duas solicitações.

### Estado, temporizadores e gatilhos

- **Estado:** fica todo na linha da `solicitacao`, sem nada em memória. Qualquer worker processa qualquer job.
- **Temporizadores:** são jobs atrasados no pg-boss. Cada job carrega a `versao` esperada da solicitação; se ela mudou quando o job dispara, o job não faz nada. Uma varredura por minuto serve de rede de segurança.
- **Gatilhos globais:** passam por um interceptador único, que combina palavras-chave exatas com as perguntas globais na mesma chamada de decisão. A precedência é emergência > encerrar > humano > setor errado > demora. A emergência tem limite baixo de propósito.
- **Versionamento:** a solicitação fica na `jornada_versao` em que começou. O catálogo e a distribuição usam sempre a versão vigente.

---

## 8. IA

### Roteamento

- **Entrada:** a mensagem pivotada para inglês, os dois últimos turnos e fatos vindos do código (unidade, local, horário).
- **Saída:** JSON estruturado com `setor` (id permitido | `vago` | `nenhum`), `urgencia`, `emergencia`, `pede_humano`, `quer_encerrar`, `setor_errado`, `reclama_demora`, `insatisfeito` e `idioma`.
- **Opções:** são filtradas por permissão em código antes da chamada.

### Confiança, em ordem de preferência

1. A confiança nativa do Jev, se a rota do OpenRouter devolver. **[A CONFIRMAR]**
2. Logprob do token único: cada setor vira uma letra. **[A CONFIRMAR]** Verifique quais provedores no OpenRouter devolvem logprobs, porque vários não devolvem.
3. Autoconsistência: três amostras em paralelo, e a concordância é a confiança.

Nunca use a confiança que o modelo declara em texto.

### Gate no hotel

| Confiança | Ação |
|---|---|
| ≥ 0,85 | Encaminha |
| 0,60–0,85 | Encaminha ao mais provável com a marca "baixa certeza" e re-roteamento em um toque |
| < 0,60 | Fila da recepção |
| `vago` | Pergunta de volta |

Os limites são calibrados em sombra, por unidade.

**[AJUSTE] Pivot para inglês:** a cadeia transcrição → tradução → roteamento soma latência
e erros. Compare em sombra o pivot contra o roteamento direto no idioma original. Se o
direto empatar, a tradução sai do caminho crítico e roda em paralelo, só para a equipe ler.

### Correções

Cada re-roteamento grava uma `correcao`. Toda semana sai uma matriz de confusão por unidade.
O conjunto de regressão (`tools/eval`) roda antes de publicar qualquer mudança de catálogo.

### Modelos e custo

| Função | Modelo |
|---|---|
| Roteamento | Jev ou um modelo pequeno e rápido, comparados em sombra |
| Tradução | Modelo pequeno, com glossário no prompt |
| Base de conhecimento | Modelo médio com ferramentas |
| Áudio e imagem | Multimodal via OpenRouter; transcrição dedicada se não houver rota boa |

Estimativa: US$ 0,01–0,05 por conversa típica. **[A CONFIRMAR]** Valide com os preços
atuais antes de fechar proposta.

---

## 9. WhatsApp

- **Entrada do hóspede:** QR code com link `wa.me` e texto pré-preenchido com o código do local. Quem começa a conversa é o hóspede, então não há template nem opt-in.
- **Identificação:** o código do QR liga o telefone ao local durante a estadia. Para qualquer coisa além de um pedido simples, também se confirma quarto e sobrenome contra a lista de hóspedes ativos. Se nada bater, a recepção confirma com um toque. O vínculo expira no checkout.
- **[AJUSTE] Código do QR:** use um token aleatório (`k7Qp2x`), não o número do quarto. Um número sequencial deixa qualquer pessoa reivindicar qualquer quarto. Também vale considerar um segundo QR no cartão de check-in, com token por estadia; ele é mais forte que o QR fixo do quarto. O hóspede também pode apagar o texto pré-preenchido, e aí cai no fallback.
- **Templates:** dois de utilidade (atualização da solicitação e pedido concluído) × PT/ES/EN = 6 aprovações. Peça na semana 1.
- **Modo degradado:**
  - Se a IA cair: circuit breaker → modelo alternativo → palavras-chave do catálogo → fila da recepção.
  - Se a tradução cair: a equipe vê o original com um aviso.
  - Se o envio falhar: retentativa com espera crescente e aviso ao supervisor depois de N falhas.

---

## 10. App da equipe

### Notificações

- **Android:**
  - FCM de alta prioridade só com dados.
  - Canal Notifee "Atribuições" com importância alta e som em loop até abrir.
  - Tela de teste no onboarding e pedido de isenção de bateria.
  - Não depende de intenção de tela cheia.
  - Celulares do hotel gerenciados pelo Android Enterprise.
  - **[A CONFIRMAR]** A política da Play Store para `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- **iOS:** APNs com nível sensível ao tempo e som personalizado.
- **Garantia:** nenhuma notificação é garantida. Quem garante é o escalonamento.

### Login por turno

- O celular é cadastrado na unidade por um QR do administrador. A pessoa entra com um PIN de 6 dígitos.
- Entrar inicia a presença. Sair encerra a presença, limpa o cache e desvincula o token de notificação.
- O servidor só notifica quem tem presença ativa.
- **[AJUSTE]** Limite de tentativas de PIN com bloqueio temporário.

### Tempo real

**[AJUSTE]** Atrás do ALB, force `transports: ['websocket']` no Socket.IO ou ative sticky
sessions. O fallback de long-polling quebra sem afinidade de sessão.

---

## 11. Repositório

```
ramais/                    monorepo pnpm + Turborepo
  apps/
    server/                NestJS: main.api.ts e main.worker.ts
      src/modules/<mod>/   domain/ application/ infra/
    web/                   React + Vite
    mobile/                Expo (build de desenvolvimento)
  packages/
    contracts/             schemas zod, DTOs, interfaces plugáveis
    domain/                regras puras: estados, distribuição, escalonamento
    db/                    schema Drizzle, migrações, políticas de RLS
    ai/                    motores, prompts, cadeia de fallback
    verticals/hotel/       catálogo, jornada, textos, templates
  tools/
    eval/                  replay das correções contra o catálogo
    seed/                  dados de piloto
```

---

## 12. Ordem de construção (2 devs)

| Semanas | Fase | Entrega |
|---|---|---|
| 1–2 | Fundação | Monorepo, Postgres + RLS, autenticação, organização, unidade, setor, pessoa, webhook e envio pela Meta, início das aprovações na Meta |
| 3–4 | Ponta a ponta sem IA | Mensagem → solicitação → fila manual → resposta pela web → envio; mídia no S3; tempo real |
| 5–6 | IA em sombra | Tradução, transcrição, descrição e roteamento plugável com log. **O piloto entra, só na web, em modo sombra** |
| 7–8 | Operação | Distribuição, aceite, escalonamento, presença, app nativo com notificações, pedidos filhos e notas |
| 9–10 | Jornada completa | Identificação por QR, gatilhos, inatividade, respostas automáticas, dashboard, catálogo calibrado |
| depois | Automação | Roteamento automático setor a setor |

**[AJUSTE] Riscos de cronograma:**
- A verificação de empresa na Meta e o registro como Tech Provider podem levar semanas e bloquear a fase 1. Comece antes do código.
- As semanas 7–8 estão apertadas para app nativo com notificação confiável. Comece o protótipo de notificação em paralelo, já na fase 2.

---

## 13. O que ainda falta decidir

- **Autenticação da web:** provedor próprio ou gerenciado, SSO para redes, papéis de administrador.
- **Observabilidade:** logs estruturados com `org_id` e `solicitacao_id`, métricas de fila e latência de IA, alertas.
- **LGPD operacional:** jobs de retenção por tipo de dado, exclusão a pedido do titular, backups e restauração com isolamento, e se a trilha de auditoria registra quem viu (não só quem fez).
- **Base de conhecimento:** formato, quem edita no MVP e se usa busca vetorial (pgvector) ou contexto direto.
- **Lista de hóspedes ativos no MVP:** formato da planilha e quem atualiza.
- **Testes:** estratégia para o domínio puro, para os contratos e ponta a ponta com o simulador da Meta.

---

## 14. O que mudou na construção (2026-10-02)

Decisões tomadas ao implementar, além do que está acima:

- **Ordem por conversa:** a fila `mensagem-entrada` usa a política `key_strict_fifo` do pg-boss, com chave `canal:telefone`. O lock consultivo continua, mas só protege cada fase.
- **Jornada em três fases:** registrar (transação), analisar (IA, sem transação) e aplicar (transação). Nenhuma transação fica aberta durante uma chamada de IA. Falha de IA degrada para regras; o job não falha, porque um job falho seguraria a conversa inteira.
- **Tempo real:** o `@socket.io/postgres-emitter` publicado fala o formato antigo, e o adaptador atual (ClusterAdapter) descarta as mensagens em silêncio. O worker publica direto no formato `BROADCAST` via `pg_notify`. Os eventos levam só ids, e o cliente busca os dados pela API.
- **Filas:** com LISTEN/NOTIFY do pg-boss, o worker acorda na criação do job. Os testes ponta a ponta caíram de ~38 s para ~5 s.
- **Idioma:** a conversa só troca de idioma com detecção confiável. Transcrição e tradução por LLM valem 0,9; no motor de regras, depende do texto. Uma frase curta e ambígua não muda mais o idioma de quem já escreveu.
- **Jev:** está no OpenRouter (`typesafe/jev-1.13`), pela Decisions API (`/api/alpha/decisions`), com confiança nativa por opção. É o motor de roteamento padrão (`MotorJev`), com o Gemini de reserva. Nos 43 casos de regressão: 100% de acerto em ~0,3 s, contra 1,7 s do Gemini com autoconsistência.
- **Fronteiras:** `apps/api/scripts/verificar-fronteiras.ts` roda antes dos testes do servidor.

---

## 15. Modo sombra, editor, construtor e simulador (2026-10-05)

- **Modo sombra** (`setor.modo_ia`, migração 0002):
  - Em sombra, o pedido vai para a triagem (o setor de fallback) com `setor_sugerido_id`.
  - Confirmar ou corrigir grava `decisao_ia.revisao`, e corrigir também cria uma `correcao`.
  - `GET /admin/automacao` mostra o acerto em 30 dias e recomenda liberar com ≥ 20 avaliações e ≥ 95% de acerto.
- **Fluxo** (`ConfigUnidade.fluxo`, em `packages/contracts/src/fluxo.ts`):
  - São 5 etapas fixas com blocos tipados e condições (`quando`, todas precisam valer).
  - Versões antigas sem fluxo recebem `FLUXO_PADRAO`, que reproduz o comportamento anterior.
- **Motor** (`apps/api/src/modules/jornada/motor-fluxo.ts`):
  - Roda os blocos enquanto a conversa está em `automacao`, com o cursor em `contexto.fluxo`.
  - Para quando um bloco espera resposta, quando encaminha ou quando encerra.
  - O encerramento (mensagem e pesquisa) roda em `Acoes.resolver`.
  - Cada mensagem gera um evento `fluxo` com a trilha dos blocos.
- **Transições seguras:** `Acoes.atualizar` não grava mais o estado, e `transicionar` exige que o estado não tenha mudado (senão, conflito). Isso fechou um bug em que uma cópia antiga da solicitação desfazia uma transição.
- **Simulador** (migração 0003):
  - As conversas `solicitacao.teste` usam um rascunho em `jornada_versao.rascunho`.
  - Ficam fora de distribuição, listas, dashboard, varredura e estatísticas, e não passam pela Meta.
- **Testes:** as filas usam um schema próprio do pg-boss (`PGBOSS_SCHEMA=pgboss_teste`), então um worker de desenvolvimento rodando não rouba os jobs do teste.

## 16. Telas de administração (2026-10-05)

- **Equipe** (`admin/equipe.controller.ts`, migração 0004):
  - `pessoa.trocar_senha` obriga a troca no primeiro acesso, e a web bloqueia até trocar.
  - A senha temporária e o PIN são gerados no servidor e voltam só na resposta; o banco guarda apenas o hash.
  - As lotações editadas são só as da unidade aberta. Mudou lotação, a fila do setor é redistribuída.
  - Desativar encerra a presença e devolve as conversas abertas para a fila. O admin não tira o próprio acesso.
- **Base de conhecimento** (`admin/conhecimento.controller.ts`):
  - A chave é gerada a partir da pergunta.
  - `POST /admin/conhecimento/testar` roda o mesmo respondedor e o mesmo limite (`limites.respostaAutomatica`) da conversa real, sem gravar nada.
- **Quartos** (`admin/locais.controller.ts`):
  - O lote é expandido no servidor (máx. 500 por intervalo e 2000 por vez), com `ON CONFLICT DO NOTHING`.
  - "QR novo" troca `local.codigo_qr` e registra o evento `qr_regenerado`.
- **Relatório** (`admin/relatorio.controller.ts`):
  - Agrega `solicitacao`, `oferta`, `evento` e `decisao_ia` no fuso da unidade, sem as conversas de teste.
  - "Por dia" inclui os dias sem pedido.
- **Todas exigem admin** (`admin/guarda.ts`): a checagem é no banco, dentro da transação do tenant, e não confia só no token.
- **Correções encontradas no caminho:**
  - Mensagens gravadas na mesma transação tinham o mesmo `now()`, e a ordem na conversa podia sair trocada. A migração 0005 passa `mensagem.criado_em` e `evento.criado_em` para `clock_timestamp()`.
  - Para admin, as listas "Unidade" e "Fechados" quebravam: um `$1` sem uso não tem tipo para o Postgres. Agora a consulta só liga os parâmetros que usa.
  - Senha atual errada na troca devolve 400, não 401, para a web não tratar como sessão expirada e deslogar.

## 17. Escada de escalonamento configurável e diretas no app (2026-10-05)

- **Configuração** (`packages/contracts/src/escalonamento.ts`): `ConfigUnidade.escalonamento` é a escada padrão; `SetorCatalogo.escalonamento` é a escada própria do setor. Fica versionada com a jornada (migração 0006 removeu a tabela `politica_escalonamento`, que nunca foi usada).
  - `ofertaSegundos`, `lembrarMin`, `repassarMin` (0 = desligado) e `avisoSolicitanteMin`.
  - `avisos[]`, cada um com `aposMin` e um alvo: supervisores de um setor, todos no turno de um setor ou uma pessoa. Pode marcar `foraDoTurno`.
  - A validação recusa setor inexistente, pessoa inexistente e lembrete depois de passar adiante. Avisa quando um degrau cai num setor sem supervisor.
- **Dois tempos por solicitação:**
  - `espera_desde`: o solicitante espera a equipe. Os avisos e o aviso ao hóspede contam daqui.
  - `atendente_desde`: o responsável atual pegou a conversa. Lembrar e passar adiante contam daqui.
- **A espera é derivada do estado em `Acoes.gravar`**, para nenhum caminho esquecer (regra pura em `proximaEspera`):
  - Na fila: a espera continua no mesmo setor; em outro setor, começa de novo.
  - Em atendimento: no pedido do hóspede, continua até a equipe responder; no pedido interno, o aceite a encerra.
  - Qualquer outro estado: ninguém espera.
  - Quando a espera muda, agenda uma avaliação imediata.
- **Execução** (`modules/distribuicao/escada.service.ts`):
  - `planoEscada` (puro) diz o que venceu e quando olhar de novo.
  - `escada_feitos` guarda o que já foi feito: rodar duas vezes não repete nada.
  - Roda por temporizador (`tipo: 'escada'`) e pela varredura (`escada_proxima_em`).
  - Passar adiante usa `colocarNaFila` no mesmo setor com `excluir_distribuicao`.
  - A oferta vencida só volta para a fila: a supervisão é chamada pelo tempo, então um setor sem ninguém no turno também escala.
- **Push fora do turno:** a notificação com `foraDoTurno` vai para o celular em que a pessoa entrou por último, mesmo sem presença.
- **Painel:** "precisa de alguém" inclui conversas em atendimento sem resposta, com o responsável. O degrau sai de `escada_feitos`.
- **Mensagens diretas no app:** aba Mensagens no turno, com a mesma API da web. A busca de pessoas acha por nome ou setor, com quem está no turno primeiro. A urgente vai com `urgente: 'true'` no push e toca em loop.
- **Migração de dados com RLS:** com `FORCE ROW LEVEL SECURITY`, nem o dono vê linhas sem `app.org_id`, nem as de `organizacao`. Um UPDATE solto numa migração não atinge nada, sem erro. A 0007 cria `sistema.organizacoes()` (SECURITY DEFINER do papel de sistema, só o dono executa) e corrige os dados organização por organização. Use o mesmo padrão em migrações de dados futuras.

## 18. Gerente, supervisão ao vivo, mídia em toda conversa e chat do quarto (2026-10-05)

- **Níveis de acesso** (migração 0008, `pessoa.gerente`):
  - **Funcionário:** atende os setores em que está lotado. Como **supervisor** de um setor (`lotacao.papel`), também vê e assume as conversas desse setor.
  - **Gerente:** vê e atende todas as unidades, vê o relatório (`exigirGestao` em `admin/guarda.ts`) e é alvo de degrau da escada (`{ tipo: 'gerentes' }`). Não mexe em jornada, equipe nem quartos.
  - **Admin:** tudo do gerente, mais a configuração. Em `Comandos.permissao`, `admin` passou a significar "gestão da operação" (admin ou gerente).
  - Gerência e administração sem setor aparecem na busca de pessoas e recebem mensagem direta (a conversa fica na unidade de quem envia).
- **Supervisão ao vivo:**
  - `DashboardView.emAtendimento` lista quem está com cada conversa, há quanto tempo e se o hóspede espera resposta. O escopo é o mesmo do painel: setores supervisionados, ou tudo para gerente e admin.
  - `POST /solicitacoes/:id/assumir` tira a conversa do responsável atual. Só vale em atendimento (na fila é "Pegar"). Registra o evento `assumida` e uma nota interna, e avisa quem perdeu a conversa. `atendente_desde` recomeça, então lembrar e passar adiante contam do novo responsável; a espera do hóspede não zera.
- **Foto e áudio em qualquer conversa:**
  - A equipe manda pela API em base64 (até 10 MB de arquivo; corpo JSON de até 16 MB): `POST /solicitacoes/:id/midia` (para o hóspede ou nota interna) e `POST /diretas/midia`. `infra/midia.ts` confere tipo, formato e tamanho.
  - Áudio passa pela fila `midia-derivar` (`canais/derivar-midia.ts`): transcreve e só então libera o envio ao hóspede, porque o que se traduz é a transcrição. Sem IA, segue sem transcrição.
  - Saída pela Meta (`ClienteMeta.enviarMidia`): sobe o arquivo e manda por id. Áudio vai como áudio quando o formato serve ao WhatsApp (aac, amr, mp3, m4a, ogg/opus), seguido da transcrição traduzida. O WAV gravado no navegador vai só como transcrição.
  - Na web, o áudio é gravado em WAV 16 kHz mono (funciona em qualquer navegador, e a transcrição aceita). No app, em m4a (`expo-audio`), que o WhatsApp toca. A foto é reduzida para 1600 px em JPEG antes de subir.
  - A transcrição aparece embaixo do áudio, como no WhatsApp: em `mensagem_derivado` (conversa com o hóspede) e em `mensagem_interna.transcricao` (diretas).
- **Chat do quarto** (`canais/chat-quarto.controller.ts`, rotas públicas `/chat/*`):
  - `unidade.qr_destino` diz para onde o QR leva: WhatsApp (como antes) ou `<WEB_URL_PUBLICA>/q/<código>`, a página do hóspede no app web.
  - A mensagem entra como `EntradaMensagem` por um canal `canal_whatsapp.tipo = 'web'` da unidade (criado na primeira leitura), na mesma fila ordenada, com classificação, oferta e escada. `Saida` não chama a Meta nesse canal e não há janela de 24 h.
  - **Uma conversa por quarto:** o solicitante é `quarto:<localId>`, com nome "Quarto 302".
  - **Sessão presa à estadia:** cada leitura do QR cria uma `chat_sessao`. O navegador guarda o segredo; o banco, só o hash, resolvido por `sistema.resolver_chat`. A sessão começa no check-in do hóspede ativo e vence no check-out. Sem lista de hóspedes, vale 24 h, e quem abre enquanto outra sessão do quarto está viva (o outro celular do casal) herda o começo dela.
  - O hóspede só vê mensagens externas a partir do começo da estadia. Mensagem nova de uma estadia nova nunca continua o pedido do hóspede anterior (`naoAntesDe` no orquestrador).
  - "QR novo" encerra as sessões abertas do quarto.
  - O QR prova que a pessoa esteve no quarto, não quem ela é: a solicitação nasce com o local, mas sem identificação confirmada. Pedido sensível ainda confere quarto e sobrenome.
  - Sem tempo real para o hóspede: a página busca a cada 3 s com a aba visível. A bolha "enviando" casa com a mensagem gravada pelo id que o navegador gerou (idempotente no reenvio).
