# Scanner microservice — build from repo root:
#   docker build -f services/scanner/Dockerfile -t ccai-scanner .
#   docker run -p 4103:4103 --env-file .env.scanner ccai-scanner
#
# Env: HELIUS_API_KEY, SIGNAL_WORKER_SECRET, SIGNAL_ASSESS_URL,
#      UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, PORT

FROM node:20-alpine AS build
WORKDIR /app

COPY packages/signal-contracts ./packages/signal-contracts
COPY services/scanner ./services/scanner

RUN npm run build --prefix packages/signal-contracts
RUN npm ci --prefix services/scanner --omit=dev 2>/dev/null || npm install --prefix services/scanner --omit=dev
RUN npm run build --prefix services/scanner

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/signal-contracts /app/packages/signal-contracts
COPY --from=build /app/services/scanner /app/services/scanner

EXPOSE 4103
# Container-level liveness probe hitting the in-process /healthz.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4103}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "services/scanner/dist/index.js"]
