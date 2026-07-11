import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import type { AgentEngine } from '../agent/engine.js'
import { assessContract } from '../enrich/assess-client.js'
import { deleteUnifiedSignalById, upsertUnifiedSignal } from './persist-unified.js'
import {
  publishUnifiedFeedEvent,
  removeFromUnifiedFeedCache,
  updateUnifiedFeedCache,
} from './publish-unified.js'
import { evaluateSportsSignal } from './sports-evaluator.js'
import { mergeTokenSources } from './source-merge.js'
import {
  markDropped,
  markProcessed,
  markPublishedNew,
  markPublishedUpdate,
  markRemoved,
  markSportsEvaluated,
  markTokenAssessed,
} from './stats.js'
import { recordChannelOutcome } from './channel-metrics-feedback.js'

function isTokenChain(
  chain: string | undefined,
): chain is 'solana' | 'ethereum' | 'base' | 'bsc' | 'arbitrum' {
  return (
    chain === 'solana' ||
    chain === 'ethereum' ||
    chain === 'base' ||
    chain === 'bsc' ||
    chain === 'arbitrum'
  )
}

async function publishScanning(redis: Redis, signal: UnifiedSignal): Promise<void> {
  const snap: UnifiedSignal = {
    ...signal,
    verdict: 'scanning',
    dropped: false,
    dropReason: undefined,
    scoreValue: undefined,
  }
  await upsertUnifiedSignal(snap)
  await updateUnifiedFeedCache(redis, snap, 'new')
  await publishUnifiedFeedEvent(redis, { type: 'signal.new', signal: snap })
  markPublishedNew()
}

async function publishEnriched(redis: Redis, signal: UnifiedSignal): Promise<void> {
  await upsertUnifiedSignal(signal)
  await updateUnifiedFeedCache(redis, signal, 'update')
  await publishUnifiedFeedEvent(redis, { type: 'signal.update', signal })
  markPublishedUpdate()
}

async function publishDropped(redis: Redis, signal: UnifiedSignal, dropReason: string): Promise<void> {
  const dropped: UnifiedSignal = {
    ...signal,
    dropped: true,
    dropReason,
    verdict: signal.subjectType === 'match_event' ? 'n/a' : 'danger',
  }
  await upsertUnifiedSignal(dropped)
  await removeFromUnifiedFeedCache(redis, signal.id)
  await publishUnifiedFeedEvent(redis, {
    type: 'signal.remove',
    id: signal.id,
    reason: dropReason,
  })
  markDropped()
}

async function publishRemove(redis: Redis, signal: UnifiedSignal): Promise<void> {
  await deleteUnifiedSignalById(signal.id)
  await removeFromUnifiedFeedCache(redis, signal.id)
  await publishUnifiedFeedEvent(redis, {
    type: 'signal.remove',
    id: signal.id,
    reason: signal.dropReason ?? 'removed',
  })
  markRemoved()
}

async function processToken(
  redis: Redis,
  signal: UnifiedSignal,
  proofEngine?: import('../proof-engine/engine.js').TokenProofEngine | null,
): Promise<void> {
  if (signal.dropped) {
    await publishRemove(redis, signal)
    return
  }

  const chain = signal.chain
  const ca = signal.contractAddress?.trim() ?? ''
  if (!isTokenChain(chain) || !ca) {
    console.warn('[gate:token] drop — missing chain/CA', {
      id: signal.id,
      sourceTag: signal.sourceTag,
      chain,
      label: signal.label,
    })
    await publishDropped(redis, signal, 'Missing chain or contract address')
    return
  }

  // Accumulate sources[] when multiple channels mention the same CA (free-tier gate).
  const merged = await mergeTokenSources(redis, signal)

  // Async-upgrade step 1: instant feed row (scanning).
  await publishScanning(redis, merged)

  // Async-upgrade step 2: scan gateway via internal assess (frozen core untouched).
  markTokenAssessed()
  const assessStarted = Date.now()
  const assessment = await assessContract(chain, ca)
  const latencyMs = Math.max(
    0,
    Date.now() -
      (Date.parse(merged.ingestTimestamp) || Date.parse(merged.msgTimestamp) || assessStarted),
  )

  if (!assessment.resolved || assessment.dropped) {
    console.warn('[gate:token] drop — assess failed', {
      id: merged.id,
      chain,
      ca: `${ca.slice(0, 8)}…${ca.slice(-4)}`,
      sources: merged.sources,
      sourceCount: merged.sourceCount,
      reason: assessment.dropReason ?? 'Unresolvable contract address',
      latencyMs,
    })
    await publishDropped(redis, merged, assessment.dropReason ?? 'Unresolvable contract address')
    void recordChannelOutcome(
      { ...merged, dropped: true, verdict: 'danger' },
      { latencyMs },
    )
    return
  }

  const enriched: UnifiedSignal = {
    ...merged,
    dropped: false,
    dropReason: undefined,
    verdict: assessment.sentinelVerdict ?? 'caution',
    scoreValue: assessment.neuralScore,
  }

  console.info('[gate:token] enriched', {
    id: enriched.id,
    chain,
    ca: `${ca.slice(0, 8)}…${ca.slice(-4)}`,
    verdict: enriched.verdict,
    score: enriched.scoreValue,
    sourceCount: enriched.sourceCount,
    sources: enriched.sources,
  })

  await publishEnriched(redis, enriched)
  void recordChannelOutcome(enriched, { latencyMs })

  if (proofEngine) {
    void proofEngine.maybeRecordCall(enriched, {
      ...assessment,
      evidenceSummary:
        assessment.evidenceSummary ??
        `Neural score ${enriched.scoreValue ?? 0}/100 · verdict ${enriched.verdict}`,
    })
  }

  if (enriched.verdict === 'safe') {
    void dispatchSafeTokenPush(enriched)
  }
}

/** Best-effort push — maps UnifiedSignal token fields for existing push-dispatch route. */
async function dispatchSafeTokenPush(signal: UnifiedSignal): Promise<void> {
  if (signal.subjectType !== 'token' || signal.verdict !== 'safe') return

  const baseUrl = (
    process.env.SIGNAL_ASSESS_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  if (!secret) return

  const legacy = {
    id: signal.id,
    sourceChannel: signal.sources?.[0] ?? signal.sourceTag,
    sourceMessageId: signal.sourceRef,
    chain: signal.chain,
    contractAddress: signal.contractAddress,
    tokenSymbol: signal.tokenSymbol ?? signal.label,
    price: signal.value,
    signalType: signal.type,
    confidence: signal.confidence,
    parseMethod: signal.rawPayload?.parseMethod ?? 'adapter',
    rawText: typeof signal.rawPayload?.text === 'string' ? signal.rawPayload.text : signal.label,
    msgTimestamp: signal.msgTimestamp,
    ingestTimestamp: signal.ingestTimestamp,
    resolved: true,
    sentinelVerdict: 'safe' as const,
    neuralScore: signal.scoreValue,
    sources: signal.sources ?? [signal.sourceTag],
    sourceCount: signal.sourceCount ?? 1,
  }

  try {
    await fetch(`${baseUrl}/api/internal/signals/push-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ signal: legacy }),
    })
  } catch {
    /* best-effort */
  }
}

async function processMatchEvent(
  redis: Redis,
  signal: UnifiedSignal,
  agent?: AgentEngine | null,
): Promise<void> {
  if (signal.dropped) {
    await publishRemove(redis, signal)
    return
  }

  // Sports eval is sync/cheap — still paint scanning first for latency contract parity.
  await publishScanning(redis, signal)

  markSportsEvaluated()
  const evalResult = evaluateSportsSignal(signal)

  const enriched: UnifiedSignal = {
    ...signal,
    dropped: false,
    dropReason: undefined,
    verdict: evalResult.verdict, // always n/a — not crypto risk
    scoreValue: evalResult.scoreValue, // edge magnitude 0–100
    confidence: evalResult.confidence,
    edgeSignal: evalResult.edgeSignal,
    rawPayload: {
      ...signal.rawPayload,
      edgeSignal: evalResult.edgeSignal,
    },
  }

  await publishEnriched(redis, enriched)
  // match_event NEVER enters Jupiter swap path.

  // Sentinel Edge AgentEngine (Prompt B) — autonomous, capped, opt-in.
  if (agent) {
    try {
      await agent.onSignal(enriched)
    } catch (e) {
      console.error('[AgentEngine] onSignal failed', e instanceof Error ? e.message : e)
    }
  }
}

export async function processUnifiedSignal(
  redis: Redis,
  signal: UnifiedSignal,
  agent?: AgentEngine | null,
  proofEngine?: import('../proof-engine/engine.js').TokenProofEngine | null,
): Promise<void> {
  markProcessed()

  if (signal.subjectType === 'match_event') {
    await processMatchEvent(redis, signal, agent)
    return
  }

  if (signal.subjectType === 'token') {
    await processToken(redis, signal, proofEngine)
    return
  }

  await publishDropped(redis, signal, `Unknown subjectType: ${String((signal as UnifiedSignal).subjectType)}`)
}
