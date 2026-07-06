import type { ParsedStreamEntry, NormalizedSignal } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import { assessContract } from './assess-client.js'
import { deleteSignalById, deleteSignalByMessage, upsertSignal } from './persist.js'
import { publishFeedEvent, removeFromFeedCache, updateFeedCache } from './publish.js'
import {
  markDropped,
  markProcessed,
  markPublishedNew,
  markPublishedUpdate,
  markRemoved,
} from './stats.js'
import { dispatchSafeSignalPush } from './push-dispatch.js'
import { normalizedToUnified } from './to-unified.js'

function scanningSnapshot(signal: NormalizedSignal): NormalizedSignal {
  return {
    ...signal,
    sentinelVerdict: 'scanning',
    resolved: false,
    dropped: false,
    dropReason: undefined,
    neuralScore: undefined,
  }
}

async function publishScanning(
  redis: Redis,
  signal: NormalizedSignal,
  isUpdate: boolean,
): Promise<void> {
  const snap = scanningSnapshot(signal)
  await upsertSignal(snap)
  const unified = normalizedToUnified(snap)
  if (isUpdate) {
    await updateFeedCache(redis, snap, 'update')
    await publishFeedEvent(redis, { type: 'signal.update', signal: unified })
    markPublishedUpdate()
  } else {
    await updateFeedCache(redis, snap, 'new')
    await publishFeedEvent(redis, { type: 'signal.new', signal: unified })
    markPublishedNew()
  }
}

async function publishEnriched(redis: Redis, signal: NormalizedSignal): Promise<void> {
  await upsertSignal(signal)
  await updateFeedCache(redis, signal, 'update')
  await publishFeedEvent(redis, { type: 'signal.update', signal: normalizedToUnified(signal) })
  markPublishedUpdate()
}

async function publishDropped(
  redis: Redis,
  signal: NormalizedSignal,
  dropReason: string,
): Promise<void> {
  const dropped: NormalizedSignal = {
    ...signal,
    dropped: true,
    dropReason,
    resolved: false,
    sentinelVerdict: 'danger',
  }
  await upsertSignal(dropped)
  await removeFromFeedCache(redis, signal.id)
  await publishFeedEvent(redis, {
    type: 'signal.remove',
    id: signal.id,
    reason: dropReason,
  })
  markDropped()
}

async function processSignal(
  redis: Redis,
  entry: Extract<ParsedStreamEntry, { kind: 'signal' }>,
): Promise<void> {
  const { signal, update } = entry

  // Async-upgrade step 1: instant feed row (scanning).
  await publishScanning(redis, signal, update)

  // Async-upgrade step 2: gateway resolve + Sentinel gate.
  const assessment = await assessContract(signal.chain, signal.contractAddress)
  if (!assessment.resolved || assessment.dropped) {
    await publishDropped(redis, signal, assessment.dropReason ?? 'Unresolvable contract address')
    return
  }

  const enriched: NormalizedSignal = {
    ...signal,
    resolved: true,
    dropped: false,
    dropReason: undefined,
    sentinelVerdict: assessment.sentinelVerdict ?? 'caution',
    neuralScore: assessment.neuralScore,
  }

  await publishEnriched(redis, enriched)
  if (enriched.sentinelVerdict === 'safe') {
    void dispatchSafeSignalPush(enriched)
  }
}

async function processRemove(
  redis: Redis,
  entry: Extract<ParsedStreamEntry, { kind: 'remove' }>,
): Promise<void> {
  if (entry.signalId) {
    await deleteSignalById(entry.signalId)
    await removeFromFeedCache(redis, entry.signalId)
    await publishFeedEvent(redis, {
      type: 'signal.remove',
      id: entry.signalId,
      reason: 'telegram_delete',
    })
  } else {
    await deleteSignalByMessage(entry.channel, entry.messageId)
  }
  markRemoved()
}

export async function processParsedEntry(redis: Redis, entry: ParsedStreamEntry): Promise<void> {
  markProcessed()
  if (entry.kind === 'remove') {
    await processRemove(redis, entry)
    return
  }
  await processSignal(redis, entry)
}
