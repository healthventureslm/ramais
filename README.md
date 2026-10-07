# Ramais

O hóspede escreve no WhatsApp ou no chat do quarto (QR) o que precisa, e a mensagem chega à pessoa certa da equipe.
Este repositório é o MVP de hotel descrito em [docs/arquitetura.md](docs/arquitetura.md).

```
WhatsApp ──────────▶ api (webhook) ──┐
                                     ├──▶ fila ──▶ worker: jornada → IA → distribuição ──▶ app / web da equipe
Chat do quarto (QR) ─▶ api (/chat) ──┘                ▲                                       │
                                                      └─────────────── resposta ◀─────────────┘
```

## O que já funciona

- **Entrada pelo WhatsApp**
  - Webhook com assinatura verificada.
  - Payload bruto gravado antes de responder 200.
  - Processamento idempotente e em ordem por conversa.
  - Texto, foto e áudio.
- **Chat do quarto, sem WhatsApp** (Administração → Quartos e QR → "Para onde o QR leva"):
  - O QR abre um chat no navegador, estilo WhatsApp, sem instalar nada e sem custo de mensagens da Meta.
  - A mensagem segue o mesmo caminho do WhatsApp: classificação, fila, oferta e escada.
  - Uma conversa por quarto, só da estadia atual: quem chega depois do check-out não vê a conversa do hóspede anterior. Sem lista de hóspedes, a sessão vale 24 h.
  - Texto, foto e áudio; a tela segue o idioma do celular (PT/ES/EN) e as respostas da equipe chegam traduzidas.
- **Identificação**
  - QR do quarto com token aleatório; vale só para pedido de baixo risco.
  - Confirmação por quarto + sobrenome contra a lista de hóspedes ativos.
  - Recepção confirma com um toque.
- **IA, sempre com saída por regras**
  - Roteamento por perguntas fechadas, com gate de confiança. A confiança vem de autoconsistência ou logprobs, nunca do texto do modelo.
  - Tradução PT/ES/EN, com conferência de números.
  - Respostas só a partir da base de conhecimento.
  - Transcrição de áudio e descrição de foto.
  - Sem `OPENROUTER_API_KEY`, roteia por palavras-chave e não traduz.
- **Gatilhos globais** com precedência fixa: emergência > encerrar > humano > setor errado > demora.
- **Distribuição**
  - Menor carga, com aceite com prazo e "último recurso" para o supervisor.
  - "Pegar" atômico.
- **Escada de escalonamento configurável** (Jornada → Escalonamento), uma padrão da unidade e, se quiser, uma própria por setor:
  - **Sem aceite:** cada oferta dura N segundos e passa para a próxima pessoa do setor.
  - **Sem resposta:** quem aceitou e não respondeu o hóspede é lembrado em X min e, em Y min, a conversa passa para a próxima pessoa do setor. Quem não respondeu não recebe de novo.
  - **Avisos por tempo de espera:** por exemplo 3 min → supervisores do setor, 8 min → gerentes (ou um gerente de plantão), 15 min → quem está no turno da Recepção. Cada degrau pode chamar mesmo quem está fora do turno.
  - **Aviso ao hóspede** de que está demorando, uma vez por espera.
  - A espera começa quando o pedido entra na fila ou quando o hóspede escreve, e termina quando alguém da equipe responde. Passar adiante não zera a espera.
  - Funciona mesmo com o setor vazio: os avisos andam pelo tempo, não pelas ofertas vencidas. O painel mostra também quem está sem resposta.
- **Atendimento**
  - **Foto e áudio em qualquer conversa** (com o hóspede, nota interna e mensagem direta), na web e no app. O áudio sempre aparece com a transcrição embaixo, como no WhatsApp, e é a transcrição traduzida que chega ao hóspede estrangeiro.
  - Pedido de apoio (filho) a outro setor, que leva só o necessário.
  - Nota interna com @menção, transferência com correção para calibração, resolver e encerrar.
  - Inatividade dentro da janela de 24 h; fora dela, envio por template.
- **Níveis de acesso**
  - **Funcionário:** atende os setores em que está lotado. Como supervisor de um setor, vê no Painel quem está atendendo cada conversa do setor (e há quanto tempo o hóspede espera resposta) e pode **assumir** a conversa.
  - **Gerente:** vê e assume as conversas de todo o hotel e vê o Relatório, sem acesso à configuração.
  - **Administrador:** tudo do gerente, mais Jornada e Administração.
- **Equipe**
  - Presença (entrar e sair do turno) na web e no app.
  - PIN com bloqueio, celular compartilhado cadastrado por QR.
  - Mensagem direta entre pessoas, na web e no app: busca por nome ou setor, urgente toca como oferta e pede "ciente".
- **Tempo real** com Socket.IO e adaptador Postgres, sem Redis. O worker publica direto no formato do adaptador.
- **Isolamento por organização**
  - RLS forçada em todas as tabelas, com papel da aplicação sem privilégios.
  - Funções `SECURITY DEFINER` mínimas para o que precisa cruzar tenants.
  - Log de eventos imutável, inclusive de quem viu cada caso.
- **Modo sombra, setor a setor:** a IA sugere e a triagem (recepção) confirma ou corrige com um toque. O acerto por setor diz quando liberar o automático (Administração → Automação por setor).
- **Jornada (só para admin):** editor de setores (com nome em ES/EN), textos PT/ES/EN, tempos, limites de confiança e palavras-chave. Valida enquanto você digita e publica versões; conversas em andamento continuam na versão em que começaram.
- **Construtor de fluxo:** as 5 etapas fixas (entrada → identificação → resolução → atendimento → encerramento), com blocos e condições.
  - Blocos: mensagem, pedir um dado (quarto e sobrenome, reserva, CPF, e-mail…, esperando ou não a resposta), responder pela base, decidir o setor, encaminhar (setor decidido ou fixo), encerrar e pesquisa de satisfação.
  - Condições: horário, dia da semana, setor, idioma, identificação, dado informado, urgência e primeira mensagem.
- **Simulador do construtor:** você conversa como hóspede usando o rascunho, sem publicar, e vê o que a IA decidiu e por quais blocos o fluxo passou. A conversa de teste não vai à equipe, à Meta nem às estatísticas.
- **Web da equipe** (recepção e supervisão): atendimentos, painel ("precisa de alguém" e "em atendimento agora") e mensagens diretas. Clicando no próprio nome, "Minha conta" troca a senha.
- **Visual:** o **design system da Health Ventures** (`@healthventureslm/design-system`) com a marca do Ramais por cima. Detalhes em [docs/design.md](docs/design.md).
  - **Componentes do DS em todas as telas:**
    - navegação: `TopNav` no computador, `TabBar`, `NavBar` e `ActionSheet` no celular;
    - atendimento: `ListItem`, `ChatBubble`, `Card`, `Dialog`, `Drawer`;
    - pedido tocando: `LiveActivity`;
    - painel e relatório: `StatCard`, `Table`, `BarChart`;
    - avisos: `toast`;
    - e os campos de formulário do DS.
  - **Cópia versionada** em `packages/design-system`, trazida de `Desktop/Health/DesignSystem` por `node tools/sincronizar-ds.mjs`.
  - **Marca:**
    - as cores da libré do hotel (azul-marinho e latão), trocando as rampas do DS em `apps/web/src/estilo/tema-ramais.css`;
    - duas peças próprias: o chaveiro do quarto e o recado da nota interna.
  - **Fiscalização:** `pnpm --filter @ramais/web test` reprova cor solta, token inexistente, emoji e `confirm`/`prompt` do navegador, e avisa elemento HTML cru onde há componente do DS.
- **Administração (só para admin), em abas:**
  - **Equipe:** pessoas, setores (papel, se recebe pedidos, limite de conversas), idiomas e nível de acesso (funcionário, gerente, administrador). A senha temporária e o PIN aparecem uma vez só. A pessoa troca a senha no primeiro acesso. Também gera senha ou PIN novos (o PIN novo desbloqueia) e desativa (sai do turno e devolve as conversas para a fila).
  - **Quartos e QR:** para onde o QR leva (WhatsApp ou chat do quarto), cadastro em lote (`101-120, 201-220, Suíte Master`), renomear, desativar, QR novo quando um vaza (encerra as sessões do chat do quarto) e folha A4 para imprimir (4 cartões por página, com chamada em PT/ES/EN).
  - **Base de conhecimento:** perguntas e respostas, palavras-chave, uso nos últimos 30 dias e "testar uma pergunta" (diz se a IA responderia sozinha, com qual item e com qual certeza, sem mandar nada a ninguém).
  - **Dashboard** (gerência e administração; hoje, 7, 30 ou 90 dias, comparado com o período anterior):
    - Pedidos, primeira resposta (mediana e 90%), resolução, nota, quanto a IA resolveu sozinha, escalados e aceite de ofertas.
    - Pedidos por dia (WhatsApp × chat do quarto) e por hora; por setor e por pessoa da equipe.
    - Canais, texto/áudio/foto, idiomas, escada e ofertas, pesquisa de satisfação.
    - IA: acerto, confiança e **custo** por tarefa, por modelo e por dia (cada chamada à OpenRouter é registrada com o custo informado por ela).
  - **Automação da IA** (sombra/automático e calibração) e **Celulares e hóspedes**.
- **App nativo** (Expo): cadastro por QR, teste de notificação, PIN, ofertas com som insistente (Notifee + FCM), conversa e mensagens diretas, com foto (câmera ou galeria) e áudio gravado no próprio app.

## Rodar localmente

Requisitos: Node 22.12+, pnpm 10, PostgreSQL 16+ (o desenvolvimento foi feito no 18).

```bash
pnpm install
```

```bash
cp .env.example .env
```

Para um Postgres só do projeto, na porta 5544 e com acesso local sem senha (`trust`):

```bash
initdb -D .dev/pgdata -U postgres -A trust -E UTF8
```

```bash
pg_ctl -D .dev/pgdata -l .dev/pg.log -o "-p 5544" start
```

Crie os papéis e o banco, aplique as migrações e o seed:

```bash
pnpm db:setup
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Compile e suba api, worker e web, cada um num terminal:

```bash
pnpm build
```

```bash
pnpm --filter @ramais/api start:api
```

```bash
pnpm --filter @ramais/api start:worker
```

```bash
pnpm --filter @ramais/web dev
```

A web abre em http://localhost:5173. As contas de desenvolvimento (todas com a mesma senha e o mesmo PIN) estão em [tools/seed/dados.ts](tools/seed/dados.ts).
O seed também grava em `.dev/seed.json` os ids, o QR de cada quarto e um código para cadastrar um celular.

### Simular um hóspede (sem Meta)

Com `META_DRY_RUN=true`, nada vai para a Meta: as saídas ficam registradas e o simulador mostra as respostas.

```bash
pnpm sim -- --quarto 302 "O ar condicionado está pingando"
```

```bash
pnpm sim -- --de 5491155550000 --nome Lucía "Necesito dos toallas"
```

```bash
pnpm sim
```

O último abre uma conversa interativa. Também aceita `--imagem foto.jpg` e `--audio audio.ogg`.

### Chat do quarto

Em Administração → Quartos e QR, escolha "Chat do quarto, no navegador" e use "Ver QR" → "Abrir o chat" (ou abra `http://localhost:5173/q/<código>`, com os códigos de `.dev/seed.json`).
O link do QR usa `WEB_URL_PUBLICA` (sem ela, o primeiro endereço de `WEB_ORIGEM`). Para testar no celular pela rede local, aponte para o IP da máquina.
A gravação de áudio no navegador exige HTTPS ou `localhost`.

### Testar no celular (ngrok)

Em desenvolvimento, a web fala com a API pela mesma origem (o Vite repassa `/api` e `/tempo-real` para a porta 3000). Por isso um túnel só, apontado para a web, serve tudo, e o HTTPS do ngrok libera o microfone no celular.

```bash
pnpm --filter @ramais/web tunel
```

```bash
ngrok http 5173
```

Abra no celular o endereço `https://….ngrok-free.app` que o ngrok mostrar (na primeira vez, o ngrok mostra um aviso: toque em "Visit Site"). Para os QR do chat do quarto apontarem para o túnel, ponha esse endereço em `WEB_URL_PUBLICA` no `.env` e reinicie a api.
Enquanto o túnel estiver aberto, qualquer pessoa com o link chega à tela de login, e as contas de desenvolvimento têm senha conhecida: feche o túnel quando terminar.

### Recomeçar o banco

```bash
pnpm db:reset
```

## Rodar com Docker

Cada parte num contêiner, como vai para produção. Precisa do Docker Desktop e do mesmo `.env` do desenvolvimento (chave da OpenRouter, Meta, JWT).

```bash
docker compose up -d --build
```

Abra `http://localhost:8080`. Na primeira vez, carregue os dados de demonstração (hotel, equipe e logins de dev):

```bash
docker compose --profile seed run --rm seed
```

| Serviço | Imagem | O que faz |
|---|---|---|
| `banco` | `postgres:18-alpine` | Postgres, volume `banco`. Publicado só em `127.0.0.1:5545`, para o psql. |
| `migracao` | `apps/api/Dockerfile`, alvo `migracao` | Cria papéis e banco, aplica as migrações e sai. A api só sobe depois dele. |
| `api` | `apps/api/Dockerfile` | `main.api.js`: REST, webhook da Meta, WebSocket. Sem porta publicada. |
| `worker` | a mesma da api | `main.worker.js`: filas (IA, envio, mídia). |
| `web` | `apps/web/Dockerfile` | nginx com o build do Vite. Repassa `/api` e `/tempo-real` para a api. |

- A web chama a API pela própria origem (`/api`), em desenvolvimento e em produção: um build serve qualquer domínio e não há CORS.
- Fotos e áudios ficam no volume `armazenamento`, compartilhado entre api e worker (`ARMAZENAMENTO=local`). Em produção, prefira `s3`.
- As senhas do banco têm default só para a máquina local. Fora dela, defina `DB_SENHA_ADMIN`, `DB_SENHA_OWNER` e `DB_SENHA_APP` no `.env`.
- Túnel: `ngrok http 8080`. Atrás de um proxy HTTPS, defina `WEB_URL_PUBLICA` para o QR do quarto sair com o domínio certo.
- Saúde: `GET /api/saude` (a API e o banco respondem) e `/version.txt` (commit do build da web, via `GIT_COMMIT`).
- Logs: `docker compose logs -f api worker`. Parar: `docker compose down` (os volumes ficam; `down -v` apaga o banco).
- Produção no Coolify, na convenção da infra (projeto 4): `docker-compose.api.yml` na vps-api (banco, migração, api, worker; api em `100.100.212.18:3406`) e `apps/web/Dockerfile` na vps-web (`100.117.232.104:8490`, atrás do Caddy). Passo a passo em [docs/coolify.md](docs/coolify.md).

## Testes

```bash
pnpm test
```

- **domain:** máquina de estados, distribuição, escalonamento, gate, identificação, calibração.
- **ai:** motor de regras, autoconsistência, logprobs, disjuntor, idioma, conhecimento.
- **db:** isolamento entre organizações (RLS), contra o banco local.
- **server:** fronteiras entre módulos e ponta a ponta (api e worker no mesmo processo).
  - Atendimento: webhook → roteamento → oferta → aceite atômico → resposta → resolver, "pegar" concorrente, emergência, "sair" e tempo real.
  - Escada: avisos por tempo com o setor vazio e fora do turno, lembrete, passar adiante sem devolver a quem não respondeu, resposta que encerra a espera.
  - Mensagens diretas: busca por setor, urgente com "ciente".
  - Gestão: gerente vê tudo e o relatório, sem a configuração; supervisor vê quem atende e assume; colega e outro setor não assumem.
  - Mídia: foto e áudio da equipe para o hóspede, nota interna em áudio, transcrição antes do envio, diretas com arquivo só para quem participa.
  - Chat do quarto: QR inválido, classificação e oferta como no WhatsApp, reenvio sem duplicar, áudio transcrito, o outro celular do quarto, privacidade entre estadias e QR novo derrubando as sessões.
  - Jornada: modo sombra, fluxo e simulador.
  - Administração: equipe com senha temporária, PIN e desativação, base de conhecimento, quartos em lote e relatório.

### Teste de carga (com custo da IA)

Com api e worker rodando, cria uma unidade nova ("Teste de carga …") com equipe, quartos e escada rápida, e simula hóspedes em 10 idiomas (WhatsApp e chat do quarto; texto, áudio e foto) e uma equipe-robô que aceita, responde, transfere, assume, resolve e troca diretas:

```bash
pnpm carga
```

```bash
pnpm carga -- --mensagens 200 --minutos 5
```

Os resultados medidos (modelos testados, custo por pedido e comparação WhatsApp × chat do quarto) estão em [docs/custos.md](docs/custos.md).

No fim, grava em `.dev/carga-relatorio-<id>.md`: acerto do roteamento por idioma e por setor, traduções, transcrições, tempos, escada, erros e o gasto com IA, pelo registro do sistema (tabela `uso_ia`) e pelo uso da chave na própria OpenRouter. A unidade criada aparece no Dashboard (troque de unidade no menu do seu nome).

### Regressão do roteamento

Rode antes de publicar qualquer mudança de catálogo:

```bash
pnpm eval
```

```bash
pnpm eval -- --minimo 0.9
```

```bash
pnpm eval -- --comparar google/gemini-3.1-flash-lite,openai/gpt-4o-mini
```

O `--comparar` exige `OPENROUTER_API_KEY` e compara motores sobre o mesmo conjunto.
Os casos estão em [tools/eval/casos/hotel.jsonl](tools/eval/casos/hotel.jsonl). Com `--correcoes <unidadeId>`, entram também as correções reais da equipe.

## App nativo

O app usa módulos nativos (FCM, Notifee, áudio e seletor de fotos), então precisa de build de desenvolvimento. Não roda no Expo Go. Quem já tinha o build antes de foto e áudio precisa gerar de novo.

1. Crie um projeto no Firebase e baixe `google-services.json` (Android) e `GoogleService-Info.plist` (iOS) para `apps/mobile/`. Esses arquivos ficam fora do git.
2. Gere a conta de serviço do FCM e coloque o JSON em base64 em `FCM_CONTA_SERVICO_B64`.
3. Gere e instale o build no aparelho:

```bash
pnpm --filter @ramais/mobile android
```

No emulador Android, o servidor local fica em `http://10.0.2.2:3000` (já é o padrão da tela de cadastro).
Para cadastrar o celular, use o QR em Administração → Celulares e hóspedes.

## Estrutura

```
apps/api        NestJS: main.api.ts (webhook, REST, WebSocket) e main.worker.ts (filas)
apps/web        React + Vite: recepção, supervisão, painel, administração
apps/mobile     Expo: app da equipe
packages/contracts   schemas zod, DTOs, contratos plugáveis
packages/domain      regras puras (sem infraestrutura)
packages/db          SQL + RLS, Drizzle, filas do pg-boss
packages/ai          OpenRouter, motores, cadeia com disjuntor, tradução, conhecimento, mídia
packages/verticals/hotel   catálogo, textos PT/ES/EN, templates, base de exemplo
tools/seed · tools/simulador · tools/eval
```

## Antes de produção

Ver também a seção "O que ainda falta decidir" em [docs/arquitetura.md](docs/arquitetura.md).

- **Meta:**
  - Registrar como Tech Provider e fazer a verificação de empresa (caminho crítico).
  - Aprovar os 6 templates (2 × PT/ES/EN, em `packages/verticals/hotel`).
  - Guardar o token de cada número no gerenciador de segredos, com o nome em `canal_whatsapp.credencial_ref`.
- **IA:**
  - O roteamento usa o Jev (`typesafe/jev-1.13`) pela Decisions API, com o Gemini de reserva.
  - Calibrar os limites em sombra, com dados reais (Administração → Automação da IA).
- **Chat do quarto:**
  - `WEB_URL_PUBLICA` com HTTPS (o microfone do navegador só funciona em HTTPS).
  - Limite de requisições nas rotas públicas `/chat/*` no balanceador.
- **AWS sa-east-1:**
  - ECS para `api` e `worker`, RDS e S3 (`ARMAZENAMENTO=s3`, onde ficam fotos e áudios).
  - Senhas dos papéis via `DB_SENHA_OWNER` e `DB_SENHA_APP` no `db:setup`.
  - Balanceador com WebSocket (o cliente só usa WebSocket).
- **Jurídico:**
  - Contrato de operador (LGPD) e transferência internacional (Meta, OpenRouter).
  - Presença não é ponto.
