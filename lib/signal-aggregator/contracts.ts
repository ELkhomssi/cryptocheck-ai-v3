/**
 * Re-export shared contracts for Next.js app code.
 * Workers import from @cryptocheck/signal-contracts directly.
 */

export type {
  SignalChain,
  SignalType,
  ParseMethod,
  SentinelVerdict,
  RawMessageEventType,
  RawMessage,
  NormalizedSignal,
  FeeRecord,
  SignalFeedEvent,
  SignalFeedFilter,
  SignalSubscriptionTier,
} from '@cryptocheck/signal-contracts'

export { gatewayVerdictToSentinel, signalSwapDeepLink } from './constants'
