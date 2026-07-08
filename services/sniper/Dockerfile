# Sniper engine — build from repo root:
#   docker build -f services/sniper/Dockerfile -t ccai-sniper .
#   docker run -p 4104:4104 --env-file .env.sniper ccai-sniper
#
# Env: SCANNER_URL, SNIPER_MIN_SCORE, UPSTASH_REDIS_REST_URL,
#      UPSTASH_REDIS_REST_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT

FROM node:20-alpine AS build
WORKDIR /app

COPY packages/signal-contracts ./packages/signal-contracts
COPY services/sniper ./services/sniper

RUN npm run build --prefix packages/signal-contracts
RUN npm ci --prefix services/sniper --omit=dev 2>/dev/null || npm install --prefix services/sniper --omit=dev
RUN npm run build --prefix services/sniper

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/signal-contracts /app/packages/signal-contracts
COPY --from=build /app/services/sniper /app/services/sniper

EXPOSE 4104
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4104}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "services/sniper/dist/index.js"]
