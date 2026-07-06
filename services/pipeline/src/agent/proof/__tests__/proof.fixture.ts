/**
 * Proof layer fixtures (Prompt C).
 * Run: npx tsx src/agent/proof/__tests__/proof.fixture.ts
 */
import type { AgentConfig, EdgeSignal, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { AgentEngine } from '../../engine.js'
import { hashRawPacket } from '../../data-hash.js'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function edge(): EdgeSignal {
  return {
    magnitude: 70,
    confidence: 0.9,
    rationale: 'odds lag 2s after the goal; fair value implies 1.80 vs market 2.20 (10.0% gap).',
    fairValue: 1.8,
    marketValue: 2.2,
    detectors: [
      {
        detector: 'latency_edge',
        magnitude: 70,
        confidence: 0.9,
        rationale: 'odds lag 2s after the goal',
        fairValue: 1.8,
        marketValue: 2.2,
        actionable: true,
      },
    ],
    anomalyOnly: false,
    evaluatedAt: new Date().toISOString(),
  }
}

function signal(id: string, type: string, extra: Partial<UnifiedSignal> = {}): UnifiedSignal {
  const e = edge()
  return {
    id,
    sourceTag: 'txodds',
    sourceRef: id,
    subjectType: 'match_event',
    label: 'ARG vs FRA',
    type,
    msgTimestamp: new Date().toISOString(),
    ingestTimestamp: new Date().toISOString(),
    confidence: e.confidence,
    verdict: 'n/a',
    matchId: '17588316',
    teams: { home: 'Argentina', away: 'France' },
    scoreValue: e.magnitude,
    edgeSignal: e,
    rawPayload: { stream: 'scores', fixtureId: 17588316, seq: 7, action: 'goal' },
    sources: ['txodds'],
    sourceCount: 1,
    ...extra,
  }
}

async function main(): Promise<void> {
  process.env.SIGNAL_AGENT_SIGNING_KEY = 'proof-test-key'

  const config: AgentConfig = {
    agentId: 'proof-agent',
    enabled: true,
    killSwitch: false,
    mode: 'paper',
    enabledDetectors: ['latency_edge'],
    edgeThreshold: 40,
    confidenceFloor: 0.5,
    maxPositionSize: 10,
    perMatchCap: 25,
    dailyLossLimit: 50,
    agentPubkey: 'proof-pubkey',
  }

  const engine = new AgentEngine(config, null)
  const raw = { stream: 'scores', fixtureId: 17588316, seq: 7, action: 'goal' }
  const dataHash = hashRawPacket(raw)

  const r = await engine.onSignal(signal('txodds:17588316:7', 'goal', { rawPayload: raw }))
  assert(r.kind === 'decision', 'decision')
  if (r.kind !== 'decision') return

  assert(r.decision.dataHash === dataHash, 'dataHash binds packet')
  assert(Boolean(r.decision.proof?.commitmentHash), 'commitmentHash present')
  assert(Boolean(r.decision.proof?.txSignature?.startsWith('paper:')), 'paper tx marker')

  const verify = await engine.getProof().verifyDecision(r.decision.id)
  assert(verify.ok, `verify failed: ${verify.details.join('; ')}`)
  assert(verify.checks.dataHashMatch, 'dataHashMatch')
  assert(verify.checks.commitmentHashMatch, 'commitmentHashMatch')
  assert(verify.checks.hmacValid === true, 'hmacValid')
  assert(verify.checks.onChainMatch === true, 'paper onChainMatch')

  // Tamper packet in index → verify fails
  const rec = await engine.getProof().getIndex().get(r.decision.proof!.commitmentHash)
  assert(rec != null, 'record')
  rec!.rawPacket = { ...raw, tampered: true }
  const bad = await engine.getProof().verify(r.decision.proof!.commitmentHash)
  assert(!bad.ok && !bad.checks.dataHashMatch, 'tamper detected')

  console.log('proof fixtures OK', {
    commitmentHash: r.decision.proof!.commitmentHash.slice(0, 16),
    tx: r.decision.proof!.txSignature,
    verifyOk: verify.ok,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
