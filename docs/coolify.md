# Deploy no Coolify

Segue a arquitetura padrão da infra, a mesma do Central de Ramais e do VoiceHealth (ver `docs/ARQUITETURA-PADRAO.md` e `docs/DEPLOY.md` do central-ramais):

- **Um único ponto público:** o Caddy da `vps-web` (`0.0.0.0:80/443`). Ele termina o HTTPS e entrega ao front pela tailnet.
- **O resto só na tailnet (Tailscale):** todo publish de contêiner é `<ip-tailnet>:porta`, nunca `0.0.0.0`. Sem o IP, o Docker publica na internet passando por cima do `ufw`.
- **O Coolify roda na `vps-api` com o proxy desligado:** ele só constrói e publica a porta. Domínio (FQDN) **vazio** em todos os recursos.

## Portas: a convenção da infra

API em `3<n>06`, com o contêiner escutando na mesma porta. Front em `8<n>90`, com o nginx do contêiner na `80`. `n` é o índice do projeto:

| n | Projeto | API (vps-api `100.100.212.18`) | Front (vps-web `100.117.232.104`) |
|---|---|---|---|
| 0 | Metabioma | 3006 | 8090 |
| 1 | VoiceHealth | 3106 | 8190 |
| 2 | Central de Ramais | 3206 | 8290 |
| 3 | site HealthVentures | — | 8390 |
| **4** | **Ramais** | **3406** | **8490** |

## O que roda onde

| Host | Recurso no Coolify | Build pack | Contêineres | Bind |
|---|---|---|---|---|
| vps-api | `ramais-api` | Docker Compose, `/docker-compose.api.yml` | banco, migracao, api, worker | api em `100.100.212.18:3406`. Banco sem porta. |
| vps-web | `ramais-web` | Dockerfile, `/apps/web/Dockerfile` | web (nginx) | `100.117.232.104:8490:80` |
| vps-web | Caddy (infra) | — | — | `<dominio>` → `100.117.232.104:8490` |

O Ramais tem banco próprio e um worker de filas, por isso a API sobe por Docker Compose, e não por um Dockerfile só como nos outros projetos. É uma diferença consciente em relação ao padrão.

**Rota do `/api`.** Diferente do Central de Ramais, o Caddy **não** tem `handle /api/*`. Ele manda tudo para o nginx do front, e o nginx repassa `/api` e `/tempo-real` (WebSocket) para a API pela tailnet, tirando o prefixo `/api`. É o desenho do VoiceHealth. Se o Caddy rotear `/api/*` direto para a 3406, todas as rotas dão 404, porque a API do Ramais não tem o prefixo.

Repositório: `healthventureslm/ramais`, branch `docker` (ou `main`, depois de juntar as duas).

## 1. ramais-api (Destination: vps-api)

| Campo | Valor |
|---|---|
| Branch | `docker` |
| Build pack | **Docker Compose** |
| Base directory | `/` |
| Compose file | `/docker-compose.api.yml` |
| Domains | **vazio** em todos os serviços |

As portas vêm do compose (`TAILNET_IP` e `API_PORT`, com defaults `100.100.212.18` e `3406`). Não preencha "Ports mappings".

**Environment Variables.** Nos segredos (`DB_SENHA_*`, `JWT_SEGREDO`, `META_*` com segredo, `OPENROUTER_API_KEY`), deixe **só Runtime** e desmarque Buildtime. O build não precisa de nenhuma variável. A falta de um segredo é barrada na subida: o Postgres não inicia, a migração para com a mensagem `defina DB_SENHA_OWNER e DB_SENHA_APP…`, ou a api recusa a configuração. **Não crie `NODE_ENV`.** Gere as senhas com `openssl rand -hex 24`. Use hexadecimal, porque as senhas entram numa URL `postgres://…` e símbolos a quebram.

| Variável | Valor |
|---|---|
| `DB_SENHA_ADMIN` | `openssl rand -hex 24` |
| `DB_SENHA_OWNER` | `openssl rand -hex 24` |
| `DB_SENHA_APP` | `openssl rand -hex 24` |
| `JWT_SEGREDO` | `openssl rand -hex 32` |
| `WEB_URL_PUBLICA` | `https://<dominio>`, sem barra no fim. O QR dos quartos aponta para cá. **Defina o domínio definitivo antes de imprimir QR**: o papel congela o domínio. |
| `META_APP_SECRET` | painel da Meta → Configurações do app → Básico. Para testar em dry-run, qualquer texto serve. |
| `META_VERIFY_TOKEN` | `openssl rand -hex 24`; o mesmo valor vai no painel da Meta |
| `OPENROUTER_API_KEY` | chave da OpenRouter. Sem ela não há IA. |
| `VAPID_PUBLICA`, `VAPID_PRIVADA` | notificação no navegador (equipe e chat do quarto). Gere o par com `pnpm --filter @ramais/api vapid`. Sem elas, o recurso fica desligado. Trocar o par obriga cada navegador a ativar de novo. |

Opcionais, com default:

- `META_DRY_RUN=true`: nada vai para a Meta.
- `SEED_DEMO=false`: veja a seção 4.
- `IA_MODELO_*`: configuração B de `docs/custos.md`.
- `ARMAZENAMENTO=local`: volume `armazenamento`.

Guarde as senhas do banco num cofre: elas ficam gravadas no volume na primeira subida.

**Deploy.** A ordem esperada nos logs é:

1. `banco` healthy.
2. `migracao` termina com `pg-boss pronto` e sai.
3. `api` mostra `ouvindo em :3406` e fica healthy.
4. `worker` mostra `pronto`.

A migração roda num contêiner à parte, **antes** da api, e nunca no entrypoint. Se ela falhar, a api nova não sobe e a anterior continua no ar. Mesmo assim, valem as regras do central-ramais:

- **migração aditiva:** coluna nova anulável ou com default, tabela nova, índice;
- **migração destrutiva:** dois deploys, primeiro o código que deixa de usar, depois a migração.

**Conferir pela tailnet**, antes de mexer no edge:

```bash
curl -s http://100.100.212.18:3406/saude      # {"ok":true,...}
ss -tlnp | grep 3406                          # na vps-api: só 100.100.212.18, nunca 0.0.0.0
```

## 2. ramais-web (Destination: vps-web)

| Campo | Valor |
|---|---|
| Branch | `docker` |
| Build pack | **Dockerfile** |
| Base directory | `/` (o build precisa da raiz do monorepo e do `pnpm-lock.yaml`) |
| Dockerfile location | `/apps/web/Dockerfile` |
| Ports exposes | `80` |
| Ports mappings | `100.117.232.104:8490:80` |
| Domains / FQDN | **vazio** |

**Environment Variables** (o nginx lê na subida; mudar não exige rebuild):

| Variável | Valor |
|---|---|
| `API_UPSTREAM` | `http://100.100.212.18:3406`, sem barra no fim |

O Coolify injeta essas variáveis também como build args. São inofensivas aqui: não há segredo nenhum no front. **Não crie `NODE_ENV`.**

O `TRUSTED_PROXY` não precisa ser definido. O nginx já confia na faixa do Tailscale (`100.64.0.0/10`) e nas redes do Docker para ler o IP real que o Caddy repassa.

```bash
ss -tlnp | grep 8490      # na vps-web: só 100.117.232.104
```

## 3. Caddy (vps-web, infra)

Em `/opt/caddy/Caddyfile`, um bloco só, sem `handle /api/*`:

```caddyfile
<dominio> {
    encode zstd gzip
    reverse_proxy 100.117.232.104:8490
}
```

O Caddy já manda `X-Forwarded-Proto` e `X-Forwarded-Host`, e o nginx repassa os dois para a API.

**Edite preservando o inode**, porque o arquivo é bind mount de arquivo único. `sed -i` e o vim criam um inode novo, e o container continua lendo o antigo. Faça assim:

```bash
sudo cp /opt/caddy/Caddyfile /tmp/Caddyfile.novo     # edite /tmp/Caddyfile.novo
sudo cp /tmp/Caddyfile.novo /opt/caddy/Caddyfile     # cp mantém o inode
docker exec $(docker ps -qf name=caddy) tail -5 /etc/caddy/Caddyfile   # confira antes do reload
docker exec $(docker ps -qf name=caddy) caddy reload --config /etc/caddy/Caddyfile
```

Um Caddyfile inválido derruba **todos** os sites do host. Por isso o edge entra por último, só depois de a api e a web responderem pela tailnet.

**Conferir de fora:**

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://<dominio>/api/saude   # 200 application/json
curl -s https://<dominio>/version.txt                                                  # commit e hora do build
```

## 4. Primeiro acesso

Ainda não existe um comando para criar a primeira organização e o primeiro admin, como o `criar-super-admin.ts` do central-ramais. Para um ambiente de teste:

1. No `ramais-api`, coloque `SEED_DEMO=true` e faça **Redeploy**. A migração carrega o Hotel Piloto.
2. Entre com `admin@hotel.dev`. A senha é `SENHA_DEV`, em `tools/seed/dados.ts`.
3. **Troque a senha na hora**, no menu do usuário → Minha conta. A senha do seed é conhecida e o site está na internet.
4. Em Administração → Equipe, gere senhas novas para as outras pessoas ou desative quem não usar.
5. Volte `SEED_DEMO=false`.

## Hotel de demonstração (apresentação comercial)

`tools/seed/demo.ts` cria uma organização separada, **VOA Hotéis**, com a unidade **Wyndham Rio Barra** (`tools/seed/demo-dados.ts`):

- 181 quartos (201–1413), QR para o chat do quarto;
- 12 hóspedes de vários países em casa;
- base de conhecimento com os dados públicos do hotel;
- setores com a IA em modo **automático**: o pedido cai direto no setor certo;
- logins `admin`, `gerente`, `recepcao`, `governanca`, `manutencao`, `restaurante` e `concierge`, todos `@wyndham.demo` e com a mesma senha.

Para criar em produção, no ramais-api: variável `DEMO_SENHA` (6+ caracteres, só Runtime) e **Redeploy**. A migração cria o hotel uma vez só; os redeploys seguintes não mexem nele.

Os horários de café, check-in e check-out, piscina e academia, e a numeração dos quartos, foram supostos (não são públicos). Confira em Administração → Base de conhecimento antes da apresentação. Depois dela, troque as senhas ou desative as contas.

## Notificações

- **Equipe, na web:** o Ramais oferece "Ativar" no topo (e no menu da conta). Com isso, pedido novo, mensagem do hóspede no atendimento da pessoa, nota interna, menção e mensagem direta aparecem como notificação do sistema, mesmo com a aba fechada. Com o Ramais aberto na tela, o aviso aparece só dentro dele.
- **Hóspede, no chat do quarto:** depois de escrever, aparece "Avisar quando o hotel responder". A resposta da equipe chega como notificação no celular dele.
- **iPhone:** o Safari só recebe notificação com o site adicionado à Tela de Início. Numa aba comum, o botão não aparece. Android (Chrome) e computador funcionam direto.
- **App da equipe (celular):** usa o FCM (`FCM_CONTA_SERVICO_B64`). Sem ele, os avisos do app só vão para o log; a web continua funcionando pelo Web Push.

## 5. WhatsApp (quando houver número)

- **Webhook** no painel da Meta: `https://<dominio>/api/webhooks/whatsapp`. Ele passa pelo Caddy, depois pelo nginx, e chega à api.
- **Verify token:** o valor de `META_VERIFY_TOKEN`.
- No `ramais-api`: `META_DRY_RUN=false`, `META_TOKEN` e **Redeploy**.
- **Troque a URL na Meta só depois que `https://<dominio>/api/saude` responder JSON.** Antes disso, a Meta receberia o `index.html` com status 200 e consideraria a mensagem entregue.

## Operação

- **Atualizar:** push e **Redeploy** dos dois recursos. Se só a web mudou, basta o `ramais-web`. Migrações novas rodam sozinhas antes da api.
- **Backup:** volumes `banco` e `armazenamento` (fotos e áudios) do `ramais-api`.
- **Banco:** Terminal do serviço `banco` → `psql -U postgres -d ramais`.
- **Testar tudo junto na sua máquina:** `docker compose up -d --build` (o `docker-compose.yml`, com a web em `http://localhost:8080`).
