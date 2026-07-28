/**
 * Trade Like Me Orchestrator V2 — wires engines via event bus only.
 */

import type { FeatureFlags, TokenRow, WhaleMovement } from '@/features/terminal-os/shared/types'
import { BehavioralLearningEngine, getMinTradesForDna } from './behavioral-learning-engine'
import { TraderDnaEngine } from './trader-dna-engine'
import { MarketIntelligenceEngine } from './market-intelligence-engine'
import { PredictionEngine } from './prediction-engine'
import { DecisionEngine } from './decision-engine'
import { ExplainableAiEngine } from './explainable-engine'
import {
  AutonomousExecutionEngine,
  DEFAULT_AUTONOMY_CONFIG,
} from './autonomous-execution-engine'
import { PerformanceAnalyticsEngine } from './performance-analytics-engine'
import { CollectiveIntelligenceEngine } from './collective-intelligence-engine'
import { TlmEventBus, tlmEventBus } from './event-bus'
import type {
  AutonomyConfig,
  CapturedTrade,
  ExplainableDecision,
  TradeLikeMeState,
  TlmEnginePhase,
  TlmEvent,
} from '../types'

export class TradeLikeMeOrchestrator {
  readonly bus: TlmEventBus
  readonly behavioral: BehavioralLearningEngine
  readonly dnaEngine: TraderDnaEngine
  readonly market: MarketIntelligenceEngine
  readonly prediction: PredictionEngine
  readonly decision: DecisionEngine
  readonly explainable: ExplainableAiEngine
  readonly autonomy: AutonomousExecutionEngine
  readonly analytics: PerformanceAnalyticsEngine
  readonly collective: CollectiveIntelligenceEngine

  private phase: TlmEnginePhase = 'idle'
  private recentEvents: TlmEvent[] = []
  private lastDecision: ExplainableDecision | null = null
  private currentOpportunity: ExplainableDecision | null = null
  private openPosition: TradeLikeMeState['openPosition'] = null
  private statusLine = 'Idle — connect wallet (read-only) to train'
  private teachRules: string[] = []

  constructor(bus: TlmEventBus = tlmEventBus) {
    this.bus = bus
    this.behavioral = new BehavioralLearningEngine(bus)
    this.dnaEngine = new TraderDnaEngine(bus)
    this.market = new MarketIntelligenceEngine()
    this.prediction = new PredictionEngine()
    this.decision = new DecisionEngine(bus)
    this.explainable = new ExplainableAiEngine()
    this.autonomy = new AutonomousExecutionEngine(bus)
    this.analytics = new PerformanceAnalyticsEngine(bus)
    this.collective = new CollectiveIntelligenceEngine(bus)

    bus.subscribe('*', (e) => {
      this.recentEvents = [e, ...this.recentEvents].slice(0, 40)
    })
  }

  trainFromWallet(wallet: string, seedTrades?: CapturedTrade[]) {
    this.behavioral.startRecording(wallet)
    if (seedTrades?.length) this.behavioral.recordMany(seedTrades)
    this.phase =
      seedTrades && seedTrades.length >= getMinTradesForDna() ? 'building_dna' : 'recording'
    this.statusLine =
      this.phase === 'recording'
        ? 'Recording trades + rejections — building behavioral memory…'
        : 'Building Trader DNA…'
    if (this.phase === 'building_dna') this.refreshDna()
    return this.getState({ autonomousTrading: false, copyTrading: false, realSwapExecution: false })
  }

  stopTraining() {
    this.behavioral.stopRecording()
    this.phase = 'paused'
    this.statusLine = 'Paused'
  }

  recordTrade(trade: CapturedTrade) {
    this.behavioral.recordTrade(trade)
    if (this.behavioral.hasSufficientHistory()) {
      this.phase = 'learning'
      this.refreshDna()
      this.phase = 'ready'
      this.statusLine = 'Trader DNA ready — watching markets…'
    } else {
      this.phase = 'recording'
      this.statusLine = `Learning progress ${this.behavioral.learningProgressPct()}% · sample ${this.behavioral.listTrades().length}`
    }
  }

  teach(note: string) {
    this.behavioral.teachNote(note)
    this.teachRules = [...this.teachRules, note].slice(-20)
  }

  refreshDna() {
    const wallet = this.behavioral.getWallet()
    if (!wallet) return null
    return this.dnaEngine.rebuild(wallet, this.behavioral.listTrades())
  }

  evaluateOpportunity(
    token: TokenRow,
    whales: WhaleMovement[],
    flags: FeatureFlags,
    opts?: { hasOpenPosition?: boolean },
  ) {
    const dna = this.dnaEngine.getDna() ?? this.refreshDna()
    const intel = this.market.snapshot({ token, whales })
    this.prediction.predict(dna, intel)

    const collectiveSig = this.collective.signal(dna, intel)
    const collectiveBoost =
      collectiveSig && collectiveSig.similarDnaCount > 0 ? collectiveSig.avgOutcomePct : undefined

    const decision = this.decision.evaluate(dna, intel, {
      hasOpenPosition: opts?.hasOpenPosition ?? Boolean(this.openPosition),
      teachRules: this.teachRules,
      collectiveBoostPct: collectiveBoost,
    })

    this.currentOpportunity = decision
    this.lastDecision = decision
    this.phase = 'watching'
    this.statusLine = `Watching Markets… · ${decision.summary}`
    this.autonomy.plan(decision, flags, dna)
    this.analytics.report(this.behavioral.listTrades(), dna)

    // Opt-in contribution of anonymized outcome estimates only
    if (dna && this.collective.getConsent().optedIn) {
      this.collective.contribute(dna, decision.estimatedUpsidePct)
    }

    return decision
  }

  setOpenPosition(pos: TradeLikeMeState['openPosition']) {
    this.openPosition = pos
  }

  updateAutonomyConfig(patch: Partial<AutonomyConfig>) {
    this.autonomy.updateConfig(patch)
  }

  setCollectiveConsent(optedIn: boolean) {
    return this.collective.setConsent(optedIn)
  }

  getState(flags: FeatureFlags): TradeLikeMeState {
    const dna = this.dnaEngine.getDna()
    const trades = this.behavioral.listTrades()
    const performance = trades.length > 0 ? this.analytics.report(trades, dna) : null
    const autonomy = this.autonomy.plan(this.currentOpportunity, flags, dna)
    const collective =
      this.currentOpportunity && dna
        ? this.collective.signal(dna, {
            tokenSymbol: this.currentOpportunity.tokenSymbol,
            chain: this.currentOpportunity.chain,
            whaleBias: 'neutral',
            liquidityTrend: 'stable',
            smartMoneyScore: 50,
            walletQuality: 50,
            tokenScore: 50,
            securityBand: 'good',
            riskScore: 40,
            newsSentiment: 50,
            marketSentiment: 50,
            orderFlowBias: 'mixed',
            volumeScore: 50,
            volatilityPct: 10,
            volumeToLiquidityRatio: 1,
            whaleActivityScore: 50,
            predictionUpsidePct: 0,
            conditionVector: {},
            sources: [],
            fetchedAt: new Date().toISOString(),
          })
        : null

    let phase = this.phase
    if (autonomy.armed && flags.autonomousTrading && this.autonomy.getConfig().enabled) {
      phase = 'autonomous_armed'
    }

    return {
      phase,
      wallet: this.behavioral.getWallet(),
      learningProgressPct: this.behavioral.learningProgressPct(),
      analyzing: [
        'Entry / exit why',
        'Rejected opportunities',
        'Risk sizing',
        'Market conditions',
        'Whale alignment',
        'Emotional bias',
      ],
      dna,
      currentOpportunity: this.currentOpportunity,
      lastDecision: this.lastDecision,
      openPosition: this.openPosition,
      autonomy,
      performance,
      collective,
      collectiveConsent: this.collective.getConsent(),
      auditLog: this.autonomy.getAuditLog(),
      statusLine: this.statusLine,
      events: this.recentEvents,
    }
  }
}

let singleton: TradeLikeMeOrchestrator | null = null

export function getTradeLikeMeOrchestrator(): TradeLikeMeOrchestrator {
  if (!singleton) singleton = new TradeLikeMeOrchestrator()
  return singleton
}

export { DEFAULT_AUTONOMY_CONFIG, getMinTradesForDna }
