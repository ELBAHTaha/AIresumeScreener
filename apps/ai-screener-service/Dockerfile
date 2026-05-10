# Pin to a specific minor release for reproducible builds.
# To lock to a sha256 digest run: docker pull node:20.18.0-alpine3.20
# then append @sha256:<digest> to the FROM line.
FROM node:20.18.0-alpine3.20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────
FROM node:20.18.0-alpine3.20 AS production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    mkdir -p /app/logs && \
    chown -R nestjs:nodejs /app/logs

USER nestjs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3003/api/v1/health || exit 1

CMD ["node", "dist/main"]
