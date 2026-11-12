FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config
COPY --from=builder /app/server/corpus/ingest.bundle.mjs ./server/corpus/ingest.bundle.mjs
COPY --from=builder /app/server/corpus/ingest.bundle.mjs.map ./server/corpus/ingest.bundle.mjs.map
COPY --from=builder /app/server/corpus/directFetch.mjs ./server/corpus/directFetch.mjs
COPY --from=builder /app/server/corpus/store.mjs ./server/corpus/store.mjs
COPY --from=builder /app/server/corpus/http.mjs ./server/corpus/http.mjs
COPY --from=builder /app/proxy.config.mjs ./proxy.config.mjs
COPY --from=builder /app/proxy.errors.mjs ./proxy.errors.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/data /app/certs && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
