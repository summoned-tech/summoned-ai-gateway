FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install gateway dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build gateway
FROM base AS builder
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Build console SPA
FROM node:22-alpine AS console-builder
WORKDIR /app/console
COPY console/package.json console/package-lock.json* ./
RUN npm ci
COPY console/ .
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=console-builder /app/console/../public/console ./public/console
COPY entrypoint.sh ./entrypoint.sh

# Non-root user
RUN chmod +x ./entrypoint.sh && \
    addgroup --system --gid 1001 gateway && \
    adduser --system --uid 1001 gateway && \
    chown -R gateway:gateway /app
USER gateway

EXPOSE 4000
# entrypoint.sh runs `bun run db:migrate` then boots the gateway.
# Migrations are idempotent — safe to run on every container start.
CMD ["./entrypoint.sh"]
