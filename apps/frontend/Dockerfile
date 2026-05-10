FROM node:20.18.0-alpine3.20 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20.18.0-alpine3.20 AS production

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs
USER nextjs

EXPOSE 3004
ENV PORT=3004
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
