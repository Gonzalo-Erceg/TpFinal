# Contexto de build: la raíz del repositorio.
#   docker build -f backend/Dockerfile -t exam-platform-backend .
#
# Imagen de producción:
#   - dependencias de runtime únicamente;
#   - usuario no root;
#   - tini como PID 1 para propagar señales;
#   - healthcheck HTTP.

FROM node:22.22.3-bookworm-slim AS deps

WORKDIR /app

# El lockfile y la definición de workspaces están en la raíz.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
# Necesario porque el workspace raíz también declara "frontend".
COPY frontend/package.json ./frontend/package.json

RUN npm ci --workspace backend --include-workspace-root --omit=dev \
    --no-audit --no-fund \
    && mkdir -p /app/backend/node_modules


FROM node:22.22.3-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# tini como PID 1 para propagar SIGTERM/SIGINT y evitar procesos zombis.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps --chown=node:node /app/package.json ./package.json
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/backend/node_modules ./backend/node_modules

COPY --chown=node:node backend ./backend

WORKDIR /app/backend

USER node

EXPOSE 3000

STOPSIGNAL SIGTERM

# El endpoint actual es /heal-check. Si se agrega /health, actualizar esta línea.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "const p=process.env.PORT||3000; fetch('http://127.0.0.1:'+p+'/heal-check').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
