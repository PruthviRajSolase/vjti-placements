# syntax=docker/dockerfile:1

# Build stage: install all dependencies and build the Vite frontend.
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: production dependencies + built app + API server.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001
ENV DB_PATH=/data/placements.db

# Non-root user for runtime.
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data /app \
    && chown -R app:app /data /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app server ./server
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app src/branches.js ./src/branches.js
COPY --chown=app:app src/tags.js ./src/tags.js

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/start.js"]
