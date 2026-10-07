# Deploy no Coolify

O Coolify sobe o `docker-compose.coolify.yml`: banco, migração, api, worker e web, cada um no seu contêiner. Só a web recebe domínio. A api e o banco ficam na rede interna.

## 1. Antes

- **DNS:** crie um registro A, por exemplo `ramais.seudominio.com.br`, apontando para o IP do servidor do Coolify.
- **Acesso ao repositório** (`luisf2907/ramais` é privado): no Coolify, **Sources → + Add → GitHub App**. Instale o app na conta `luisf2907` e dê acesso só ao repositório `ramais`.

## 2. Criar o recurso

1. **Projects → (seu projeto) → + New → Private Repository (with GitHub App)**.
2. Escolha o app criado acima e o repositório `luisf2907/ramais`.
3. **Branch:** `main`. A branch `docker` serve enquanto ela não estiver mesclada.
4. **Build Pack:** `Docker Compose`.
5. **Base Directory:** `/`.
6. **Docker Compose Location:** `/docker-compose.coolify.yml`.
7. Salve. O Coolify lê o arquivo e lista os serviços `banco`, `migracao`, `api`, `worker` e `web`.

## 3. Domínio

Em **Domains**, só no serviço **web**:

```
https://ramais.seudominio.com.br:80
```

O `:80` não aparece para o usuário. Ele diz ao proxy do Coolify em qual porta do contêiner entregar a requisição, e o nginx da web escuta na 80. Deixe os outros serviços sem domínio.

## 4. Variáveis de ambiente

Na aba **Environment Variables** aparecem todas as variáveis do compose. Gere as senhas no seu computador:

```bash
openssl rand -hex 24
```

Use hexadecimal: as senhas do banco entram dentro de uma URL `postgres://…`, e símbolos como `@`, `/` ou `#` a quebrariam. **Desmarque "Build Variable"** em todas. Elas só são usadas quando os contêineres rodam e não devem ir para o build das imagens.

**Obrigatórias** (o deploy falha sem elas):

| Variável | Valor |
|---|---|
| `DB_SENHA_ADMIN` | `openssl rand -hex 24`. É a senha do superusuário `postgres`. |
| `DB_SENHA_OWNER` | `openssl rand -hex 24`. É a do papel dono das tabelas, usado nas migrações. |
| `DB_SENHA_APP` | `openssl rand -hex 24`. É a do papel da aplicação, que fica sujeito à RLS. |
| `JWT_SEGREDO` | `openssl rand -hex 32` |
| `WEB_URL_PUBLICA` | `https://ramais.seudominio.com.br`, sem barra no fim. É para onde o QR dos quartos aponta. |
| `META_APP_SECRET` | segredo do app na Meta. Para testar sem WhatsApp real, qualquer texto serve. |
| `META_VERIFY_TOKEN` | token de verificação do webhook. Você escolhe o valor e repete no painel da Meta. |

**Principais opcionais:**

| Variável | Default | Quando mudar |
|---|---|---|
| `OPENROUTER_API_KEY` | vazio | Sempre. Sem ela não há IA: o roteamento cai para palavras-chave e não há tradução. |
| `META_DRY_RUN` | `true` | Passe para `false` quando o número do WhatsApp estiver ligado. |
| `META_TOKEN` | vazio | Token permanente da Meta, junto com `META_DRY_RUN=false`. |
| `SEED_DEMO` | `false` | `true` só no primeiro deploy de teste. Veja o passo 6. |
| `IA_MODELO_*` | configuração B de `docs/custos.md` | Só para testar outro modelo. |
| `ARMAZENAMENTO` | `local` | `s3`, com `S3_BUCKET`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`. |
| `TRUSTED_PROXY` | `172.16.0.0/12` | Se o IP real dos usuários não aparecer nos logs. Use a subnet que `docker network inspect coolify` mostrar. |

Guarde as três senhas do banco num cofre. Elas ficam gravadas no volume `banco` na primeira subida, e trocar depois exige alterar os papéis no Postgres.

## 5. Deploy

Clique em **Deploy**. O primeiro build leva alguns minutos; os seguintes usam cache. Nos logs, a ordem esperada é:

1. `banco`: healthy.
2. `migracao`: `aplicada: 0001…` até a última migração, depois `pg-boss pronto`. Ele termina e sai. Isso é normal, o Coolify não o conta na saúde da aplicação.
3. `api`: `ouvindo em :3000`. Fica healthy pelo `GET /saude`.
4. `worker`: `pronto`.
5. `web`: sobe depois que a api fica healthy.

Para conferir, abra `https://ramais.seudominio.com.br/api/saude`. A resposta esperada é `{"ok":true,"versao":"<commit>"}`.

## 6. Primeiro acesso

Ainda não existe um comando para criar a primeira organização e o primeiro admin. Para um ambiente de teste:

1. Coloque `SEED_DEMO=true` e faça **Redeploy**. A migração carrega o Hotel Piloto com equipe e quartos.
2. Entre com `admin@hotel.dev`. A senha é `SENHA_DEV`, em `tools/seed/dados.ts`.
3. **Troque a senha do admin na hora**, no menu do usuário → Minha conta. As contas do seed têm senha conhecida e o site está na internet.
4. Em Administração → Equipe, gere senhas novas para as outras pessoas ou desative as que não usar.
5. Volte `SEED_DEMO=false`. O seed não roda duas vezes, mas assim fica explícito.

Para um hotel de verdade, o caminho certo é um comando de "primeiro admin": cria organização, unidade e admin com senha aleatória mostrada uma vez. Ele ainda precisa ser feito.

## 7. WhatsApp (quando houver número)

- **URL do webhook** no painel da Meta: `https://ramais.seudominio.com.br/api/webhooks/whatsapp`.
- **Verify token:** o mesmo valor de `META_VERIFY_TOKEN`.
- Depois, `META_DRY_RUN=false`, `META_TOKEN` e **Redeploy**.

## Operação

- **Atualizar:** push na branch configurada e **Redeploy**. Ligue o "Auto Deploy" do GitHub App se quiser deploy a cada push. Migrações novas rodam sozinhas antes da api subir.
- **Backup:** os volumes `banco` e `armazenamento` (fotos e áudios). Em **Backups** do Coolify, ou com `pg_dump` dentro do contêiner `banco`.
- **Logs:** aba **Logs** de cada serviço. A api e o worker mostram erros de fila com o nome do job.
- **Terminal:** aba **Terminal** → serviço `banco` → `psql -U postgres -d ramais`.
