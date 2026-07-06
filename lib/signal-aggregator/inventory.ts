/**
 * Prompt 0 — reuse inventory (read-only references; do not duplicate logic here).
 */

export const SIGNAL_AGGREGATOR_INVENTORY = {
  scanGateway: {
    path: 'lib/connect/scan-gateway.ts',
    exports: ['assessRiskByMint', 'scanViaGateway', 'fetchCanonicalForMint', 'gatewayEventBus'],
    rule: 'All scans via gateway only — never import frozen scanner core',
  },
  chainPort: {
    path: 'lib/connect/chain-port.ts',
    exports: ['ChainDataPort', 'chainRouter'],
  },
  sentinel: {
    path: 'lib/sentinel/',
    exports: ['canonicalScan (FROZEN)', 'scoreToVerdict', 'mergeReasoningWithCanonical'],
    api: 'GET /api/v1/sentinel/canonical-scan/[mint]',
    rule: 'Use existing Sentinel backend; do not reimplement scoring',
  },
  jupiterSwap: {
    path: 'lib/trading/',
    exports: ['assessSwapIntent', 'executeRiskGatedSwap', 'getJupiterQuote', 'simulateJupiterSwap'],
    ui: ['components/trading/RiskGatedSwapPanel.tsx', 'components/revenue-dashboard/TradeTerminal.tsx'],
    rule: 'All swaps through risk-gated-swap + jupiter-client',
  },
  realtimePatterns: {
    sse: 'app/api/trading/signals/route.ts (EventSource poll hybrid)',
    ndjson: 'app/api/agent/investigate/route.ts',
    clientPoll: 'services/websocket/client.ts, services/market-stream/poll-fallback.ts',
    priorFeedUi: 'components/trading/SignalAlertFeed.tsx',
    note: 'Signal Aggregator uses WebSocket push (services/realtime) — not poll',
  },
  redis: {
    wrapper: 'lib/cache/redis.ts (@upstash/redis REST — extend for Streams in Prompt 1)',
    existingKeys: ['cc:pulse:institutional', 'ccai:rev:fee:*', 'ccai:payment:*'],
    signalKeys: 'ccai:sig:* (see @cryptocheck/signal-contracts)',
  },
  postgres: {
    client: 'lib/supabase/server.ts, lib/supabase/admin.ts',
    orm: 'Supabase client (no Prisma/Drizzle); Timescale hypertable optional on signal_normalized',
  },
  feeRecord: {
    type: 'lib/revenue-dashboard/types.ts → FeeRecord',
    store: 'lib/revenue-dashboard/fee-store.ts → recordFeeRecord',
    api: 'POST /api/revenue/record-fee',
  },
  payments: {
    path: 'lib/payments/payment-intent.ts',
    api: ['POST /api/payments/intent', 'POST /api/payments/confirm'],
    use: 'Premium tier billing (Prompt 6)',
  },
  frozen: [
    'lib/services/scanner-engine.ts',
    'lib/services/scanner/pipeline/run-institutional-scan.ts',
    'lib/sentinel/canonical-scan.ts',
  ],
} as const
