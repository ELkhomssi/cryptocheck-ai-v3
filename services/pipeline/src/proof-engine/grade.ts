import type { SignalProofCall } from '@cryptocheck/signal-contracts'
import { assessContract } from '../enrich/assess-client.js'
import { fetchPendingProofCalls, updateProofCallOutcome } from './persist.js'

const MS_72H = 72 * 60 * 60 * 1000
const MS_24H = 24 * 60 * 60 * 1000

async function gradeOne(call: SignalProofCall): Promise<void> {
  const age = Date.now() - new Date(call.calledAt).getTime()
  const assessment = await assessContract('solana', call.mint)
  const score = assessment.neuralScore ?? 0
  const risk = assessment.riskScore ?? Math.max(0, 100 - score)

  if (call.callType === 'rug_alert') {
    if (call.verdict === 'danger' && risk >= 70) {
      await updateProofCallOutcome(call.id, 'hit', `Rug risk confirmed · risk ${risk}/100`, score)
      return
    }
    if (age >= MS_72H) {
      const outcome = score >= 50 ? 'miss' : 'expired'
      await updateProofCallOutcome(
        call.id,
        outcome,
        outcome === 'miss' ? `Token still healthy after 72h · score ${score}/100` : 'Inconclusive window',
        score,
      )
    }
    return
  }

  if (call.callType === 'safe_entry') {
    if (age >= MS_24H) {
      if (assessment.sentinelVerdict === 'safe' && score >= 70) {
        await updateProofCallOutcome(call.id, 'hit', `Still SAFE after 24h · score ${score}/100`, score)
      } else if (assessment.sentinelVerdict === 'danger') {
        await updateProofCallOutcome(call.id, 'miss', `Turned DANGER within window · score ${score}/100`, score)
      } else {
        await updateProofCallOutcome(call.id, 'expired', `Mixed outcome · score ${score}/100`, score)
      }
    }
    return
  }

  if (call.callType === 'smart_money') {
    if (age >= MS_24H) {
      if (assessment.sentinelVerdict === 'danger') {
        await updateProofCallOutcome(call.id, 'miss', `Smart money call invalidated · DANGER`, score)
      } else {
        await updateProofCallOutcome(call.id, 'hit', `Cluster signal held · score ${score}/100`, score)
      }
    }
  }
}

export async function runProofCallGrading(): Promise<void> {
  const pending = await fetchPendingProofCalls(40)
  if (!pending.length) return
  for (const call of pending) {
    try {
      await gradeOne(call)
    } catch (e) {
      console.error('[proof-engine] grade failed', call.id, e instanceof Error ? e.message : e)
    }
  }
}

export function startProofGradingLoop(intervalMs: number): () => void {
  const tick = () => void runProofCallGrading()
  tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
