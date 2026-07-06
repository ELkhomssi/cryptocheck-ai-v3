/**
 * App-side re-exports for multi-source ingestion contracts.
 * Workers import @cryptocheck/signal-contracts directly.
 */

export {
  type SourceAdapter,
  type SourceTag,
  type SubjectType,
  type UnifiedSignal,
  type UnifiedVerdict,
  type UnifiedFeedEvent,
  type UnifiedFeedFilter,
  type MatchEventType,
  type TokenEventType,
  type UnifiedEventType,
  SIGNAL_STREAM_UNIFIED,
  SIGNAL_CONSUMER_GROUP_GATE,
  SIGNAL_DEDUP_ID_PREFIX,
  SIGNAL_UNIFIED_STREAM_FIELD,
  signalSourceStreamKey,
  namespacedSignalId,
} from '@cryptocheck/signal-contracts'
