# syntax=docker/dockerfile:1
# ramais-api — NestJS. A MESMA imagem roda os dois processos, cada um no seu contêiner:
#   api     node dist/main.api.js     (REST, webhook da Meta, WebSocket)   ← CMD padrão
#   worker  node dist/main.worker.js  (filas do pg-boss: IA, envio, mídia)
# Eles compartilham os módulos de domínio (src/modulos.ts); separar em imagens duplicaria o build
# sem isolar nada a mais do que contêineres separados já isolam.
#
# Alvo `migracao`: cria papéis e banco (db:setup, idempotente) e aplica as migrações. Roda uma vez
# antes da API, como tarefa, e sai.
#
# Contexto de build é a RAIZ do repositório (workspaces do pnpm):
#   docker build -f apps/api/Dockerfile -t ramais-api .
#   docker build -f apps/api/Dockerfile --target migracao -t ramais-migracao .
#
# O boot valida o ambiente (src/config.ts) e sai com código 1 se faltar variável obrigatória:
# num orquestrador isso aparece como crash-loop, não como serviço degradado. É intencional.

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /repo

# ---- Poda do monorepo ----
# A API e o seed (o seed entra só na imagem de migração, para `db:seed` em ambiente de teste).
FROM base AS poda
# Mesma versão do turbo da raiz (package.json).
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @ramais/api @ramais/seed --docker

# ---- Build (com dependências de desenvolvimento) ----
FROM base AS build
# O Coolify injeta cada variável da aplicação como ARG no topo de cada estágio. Um NODE_ENV=production
# vindo de lá faria o pnpm pular as devDependencies (tsc, vite, turbo) e o build morreria adiante.
# ENV vence ARG de mesmo nome.
ENV NODE_ENV=development
# Manifests e lockfile antes do código: a instalação só roda de novo se as dependências mudarem.
COPY --from=poda /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=poda /repo/out/full/ .
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@ramais/api...

# ---- Migração: tarefa que roda e sai ----
# Usa o build inteiro: os scripts de banco são TypeScript rodados pelo tsx (dev dependency).
FROM build AS migracao
CMD ["sh", "-c", "pnpm db:setup && pnpm db:migrate"]

# ---- Dependências de produção ----
FROM base AS deps
COPY --from=poda /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@ramais/api..."

# ---- Imagem final ----
FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app

# node_modules de produção (os links do pnpm são relativos: a árvore vai inteira) e só o JS
# compilado de cada pacote. Pacote interno novo de que a API dependa entra nesta lista.
COPY --from=deps /repo/ ./
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/domain/dist packages/domain/dist
COPY --from=build /repo/packages/db/dist packages/db/dist
COPY --from=build /repo/packages/ai/dist packages/ai/dist
COPY --from=build /repo/packages/verticals/hotel/dist packages/verticals/hotel/dist
COPY --from=build /repo/apps/api/dist apps/api/dist

# Mídia no disco (ARMAZENAMENTO=local): o compose monta um volume aqui, compartilhado entre api
# e worker. Criada na imagem para o volume nascer com o dono certo. Em produção, prefira s3.
ENV ARMAZENAMENTO_DIR=/dados/armazenamento
RUN mkdir -p /dados/armazenamento && chown -R node:node /dados

# Carimbo de versão, lido pelo /saude. Depois do código: muda a cada commit.
ARG GIT_COMMIT=""
ARG SOURCE_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT SOURCE_COMMIT=$SOURCE_COMMIT

# Não roda como root (o usuário `node` vem na imagem oficial).
USER node
WORKDIR /app/apps/api

# Convenção da infra: API do projeto 4 em 3406, a mesma porta dentro e fora do contêiner.
ENV PORTA=3406
EXPOSE 3406
# O worker não tem HTTP: no compose ele desliga este healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORTA}/saude" || exit 1
CMD ["node", "--enable-source-maps", "dist/main.api.js"]
