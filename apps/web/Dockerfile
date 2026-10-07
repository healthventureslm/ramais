# syntax=docker/dockerfile:1
# ramais-web — build do Vite servido por nginx, que também repassa /api e /tempo-real à API.
#
# Contexto de build é a RAIZ do repositório (workspaces do pnpm):
#   docker build -f apps/web/Dockerfile -t ramais-web .
# O `turbo prune` separa só o que a web usa (contracts e a cópia do design system), com o
# lockfile podado: mudar dependência da API não invalida a camada de instalação daqui.

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /repo

# ---- Poda do monorepo ----
FROM base AS poda
# Mesma versão do turbo da raiz (package.json).
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @ramais/web --docker

# ---- Build ----
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
RUN pnpm turbo run build --filter=@ramais/web...

# Carimbo de versão: distingue "deploy não rodou" de "cache do navegador". O Coolify não passa o
# commit ao build (medido na infra em 10/09/2026), então vai também a hora do build, que não
# depende de build arg nenhum.
ARG GIT_COMMIT=""
ARG SOURCE_COMMIT=""
RUN c="${GIT_COMMIT:-$SOURCE_COMMIT}"; \
    printf 'commit: %s\nbuild:  %s\n' "${c:-desconhecido}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > apps/web/dist/version.txt

# ---- Imagem final ----
FROM nginx:1.29-alpine AS web
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# Templates: o envsubst da imagem oficial resolve as variáveis na subida.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/seguranca.inc.template /etc/nginx/templates/seguranca.inc.template

# Onde a API responde, alcançável DESTE contêiner (nome do serviço na rede, não localhost).
ENV API_UPSTREAM=http://api:3000
ENV CSP_HEADER=Content-Security-Policy
# Faixa privada do Docker: cobre um proxy HTTPS na mesma máquina. Em produção, o IP exato dele.
ENV TRUSTED_PROXY=172.16.0.0/12
# Sem o filtro, o envsubst também trocaria $host, $uri e $scheme do próprio nginx.
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM|CSP_HEADER|TRUSTED_PROXY

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/version.txt || exit 1
CMD ["nginx", "-g", "daemon off;"]
