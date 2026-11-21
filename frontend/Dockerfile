# Contexto de build: la raíz del repositorio.
#   docker build -f frontend/Dockerfile -t exam-platform-frontend .
#
# Imagen de producción para Angular SSR:
#   - build de Angular en una etapa separada;
#   - solo dependencias de runtime en la imagen final;
#   - usuario no root;
#   - tini como PID 1 para propagar señales;
#   - healthcheck HTTP.

FROM node:22.22.3-bookworm-slim AS deps

WORKDIR /app

# Instala todas las dependencias (incluye devDependencies) para compilar Angular.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --workspace frontend --include-workspace-root \
    --no-audit --no-fund \
    && mkdir -p /app/frontend/node_modules


FROM node:22.22.3-bookworm-slim AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# Solo lo que necesita el servidor SSR en ejecución.
RUN npm ci --workspace frontend --include-workspace-root --omit=dev \
    --no-audit --no-fund \
    && mkdir -p /app/frontend/node_modules


FROM node:22.22.3-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

COPY package.json ./package.json
COPY frontend ./frontend

RUN npm run build --workspace frontend -- --configuration production \
    && test -f frontend/dist/app/server/server.mjs


FROM node:22.22.3-bookworm-slim AS runtime

# Angular SSR valida el header Host (protección SSRF). Sin NG_ALLOWED_HOSTS responde 400.
# En producción conviene restringirlo al dominio público, por ejemplo:
#   NG_ALLOWED_HOSTS=midominio.com,<ELASTIC_IP>
ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    NG_ALLOWED_HOSTS=*

# tini como PID 1 para propagar SIGTERM/SIGINT y evitar procesos zombis.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend

COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/frontend/node_modules /app/frontend/node_modules
COPY --from=prod-deps --chown=node:node /app/package.json /app/package.json

COPY --from=build --chown=node:node /app/frontend/package.json ./package.json
COPY --from=build --chown=node:node /app/frontend/dist ./dist

USER node

EXPOSE 4000

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "const p=process.env.PORT||4000; fetch('http://127.0.0.1:'+p+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/app/server/server.mjs"]
