import type { NormalizedSignal, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { namespacedSignalId } from '@cryptocheck/signal-contracts'

/** Map legacy NormalizedSignal → UnifiedSignal for shared feed/cache. */
export function normalizedToUnified(signal: NormalizedSignal): UnifiedSignal {
  const sourceRef = signal.sourceMessageId
  const id =
    signal.id.includes(':') ? signal.id : namespacedSignalId('telegram', sourceRef)

  return {
    id,
    sourceTag: 'telegram',
    sourceRef,
    subjectType: 'token',
    label: signal.tokenSymbol,
    type: signal.signalType,
    value: signal.price,
    msgTimestamp: signal.msgTimestamp,
    ingestTimestamp: signal.ingestTimestamp,
    confidence: signal.confidence,
    chain: signal.chain,
    contractAddress: signal.contractAddress,
    tokenSymbol: signal.tokenSymbol,
    verdict: signal.sentinelVerdict,
    scoreValue: signal.neuralScore,
    rawPayload: {
      channel: signal.sourceChannel,
      text: signal.rawText,
      parseMethod: signal.parseMethod,
      pair: signal.pair,
    },
    sources: signal.sources,
    sourceCount: signal.sourceCount,
    sample: signal.sample,
    dropped: signal.dropped,
    dropReason: signal.dropReason,
  }
}
