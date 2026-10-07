# Deploy no Coolify

Mesmo desenho do VoiceHealth, em dois recursos:

| Recurso | Servidor | Build pack | O que sobe | Acesso |
|---|---|---|---|---|
| **ramais-api** | vps-api | Docker Compose, `/docker-compose.api.yml` | banco, migracao, api, worker | Só pelo Tailscale: `100.100.212.18:3406` |
| **ramais-web** | vps-web | Dockerfile, `/apps/web/Dockerfile` | nginx com o build da web | O domínio público. Repassa `/api` e `/tempo-real` para a api. |

O navegador, o QR dos quartos e o webhook da Meta falam só com o domínio da web. A API não aparece na internet.

Repositório: `healthventureslm/ramais`, branch `docker` (ou `main`, depois de juntar as duas). A porta `3406` está livre na vps-api; o VoiceHealth usa 3106, 3206 e 3006.

## 1. ramais-api (vps-api)

**Build configuration:**

| Campo | Valor |
|---|---|
| Branch | `docker` |
| Build pack | **Docker Compose** (não Railpack) |
| Base directory | `/` |
| Docker Compose location | `/docker-compose.api.yml` |

Sem domínio: deixe todos os serviços sem domínio.

**Environment Variables.** Desmarque "Build Variable" em todas. Gere as senhas com `openssl rand -hex 24`. Use hexadecimal, porque as senhas entram numa URL `postgres://…` e símbolos a quebram.

| Variável | Valor |
|---|---|
| `API_PUBLICAR` | `100.100.212.18:3406` (IP do Tailscale da vps-api : porta) |
| `DB_SENHA_ADMIN` | `openssl rand -hex 24` |
| `DB_SENHA_OWNER` | `openssl rand -hex 24` |
| `DB_SENHA_APP` | `openssl rand -hex 24` |
| `JWT_SEGREDO` | `openssl rand -hex 32` |
| `WEB_URL_PUBLICA` | `https://ramais.seudominio.com.br`, sem barra no fim. É o domínio da **web**, para onde aponta o QR dos quartos. |
| `META_APP_SECRET` | segredo do app na Meta. Para testar sem WhatsApp real, qualquer texto serve. |
| `META_VERIFY_TOKEN` | um valor que você escolhe e repete no painel da Meta |
| `OPENROUTER_API_KEY` | chave da OpenRouter. Sem ela não há IA. |

Opcionais, com default:

- `META_DRY_RUN=true`: nada vai para a Meta.
- `SEED_DEMO=false`: veja a seção 3.
- `IA_MODELO_*`: configuração B de `docs/custos.md`.
- `ARMAZENAMENTO=local`: volume `armazenamento`.

Guarde as senhas do banco num cofre: elas ficam gravadas no volume na primeira subida.

**Deploy.** A ordem esperada nos logs é:

1. `banco` healthy.
2. `migracao` termina com `pg-boss pronto` e sai. É normal.
3. `api` mostra `ouvindo em :3000` e fica healthy.
4. `worker` mostra `pronto`.

Para conferir, de dentro da vps-web: `curl http://100.100.212.18:3406/saude` deve devolver `{"ok":true,…}`.

## 2. ramais-web (vps-web)

**Build configuration:**

| Campo | Valor |
|---|---|
| Branch | `docker` |
| Build pack | **Dockerfile** |
| Base directory | `/` (o build precisa da raiz do monorepo) |
| Dockerfile location | `/apps/web/Dockerfile` |
| Port | `80` |
| Domínio | `https://ramais.seudominio.com.br` |

**Environment Variables** (runtime, não "Build Variable"):

| Variável | Valor |
|---|---|
| `API_UPSTREAM` | `http://100.100.212.18:3406`, sem barra no fim |
| `TRUSTED_PROXY` | o mesmo valor usado na web do VoiceHealth (de onde vem o proxy HTTPS da vps-web) |

O nginx lê essas variáveis na subida. Mudar a API de lugar é só trocar `API_UPSTREAM` e reiniciar, sem rebuild.

Para conferir: `https://ramais.seudominio.com.br/api/saude` e `https://ramais.seudominio.com.br/version.txt` (o commit do build).

## 3. Primeiro acesso

Ainda não existe um comando para criar a primeira organização e o primeiro admin. Para um ambiente de teste:

1. No ramais-api, coloque `SEED_DEMO=true` e faça **Redeploy**. A migração carrega o Hotel Piloto.
2. Entre na web com `admin@hotel.dev`. A senha é `SENHA_DEV`, em `tools/seed/dados.ts`.
3. **Troque a senha na hora**, no menu do usuário → Minha conta. A senha do seed é conhecida e o site está na internet.
4. Em Administração → Equipe, gere senhas novas para as outras pessoas ou desative quem não usar.
5. Volte `SEED_DEMO=false`.

Para um hotel de verdade, falta um comando de "primeiro admin": cria organização, unidade e admin com senha aleatória mostrada uma vez.

## 4. WhatsApp (quando houver número)

- **Webhook** no painel da Meta: `https://ramais.seudominio.com.br/api/webhooks/whatsapp`. Ele chega pela web e o nginx repassa para a api.
- **Verify token:** o valor de `META_VERIFY_TOKEN`.
- Depois, no ramais-api: `META_DRY_RUN=false`, `META_TOKEN` e **Redeploy**.

## Operação

- **Atualizar:** push e **Redeploy** dos dois recursos. Migrações novas rodam sozinhas antes da api subir. Se só a web mudou, basta o ramais-web.
- **Backup:** volumes `banco` e `armazenamento` (fotos e áudios) do ramais-api.
- **Banco:** Terminal do serviço `banco` → `psql -U postgres -d ramais`.
- **Testar tudo junto na sua máquina:** `docker compose up -d --build` (o `docker-compose.yml`, com a web em `http://localhost:8080`).
