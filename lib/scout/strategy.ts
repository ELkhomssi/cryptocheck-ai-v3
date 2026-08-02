/**
 * Scout V2 — ecosystem content strategy.
 * Never generic crypto blogging. Every topic must reinforce Terminal OS + AI stack.
 */

export type EcosystemPillar =
  | 'terminal_os'
  | 'intelligence_chart'
  | 'ai_gateway'
  | 'ai_coaching'
  | 'trade_like_me'
  | 'portfolio_intelligence'
  | 'secure_execution'
  | 'security_scanner'
  | 'discovery_engine'
  | 'decision_intelligence'
  | 'capital_rotation'
  | 'whale_intelligence'
  | 'market_psychology'

export type PillarDef = {
  id: EcosystemPillar
  label: string
  productPaths: string[]
  priorityBoost: number
  keywords: string[]
  seedTitles: string[]
  problem: string
  toolFailure: string
  professionalApproach: string
  ccaiSolution: string
}

/** High-signal phrases that raise publish priority (Rule #3). */
export const SCOUT_PRIORITY_KEYWORDS = [
  'AI + Trading',
  'AI trading',
  'security',
  'whale intelligence',
  'portfolio automation',
  'terminal operating',
  'terminal os',
  'on-chain intelligence',
  'market psychology',
  'capital rotation',
  'decision intelligence',
  'behavioral finance',
  'ai gateway',
  'intelligence chart',
  'security scanner',
] as const

/** Highest-priority narratives that convert readers into Terminal OS users. */
export const ECOSYSTEM_PILLARS: PillarDef[] = [
  {
    id: 'terminal_os',
    label: 'Terminal OS',
    productPaths: ['/terminalOS', '/app'],
    priorityBoost: 28,
    keywords: ['terminal os', 'trading dashboard', 'operating system', 'terminal operating'],
    seedTitles: [
      'Why traditional trading dashboards are becoming obsolete',
      'How Terminal OS thinks before traders do',
      "Inside CryptoCheckAI's AI Operating System",
    ],
    problem: 'Traders juggle disconnected charts, scanners, and chat tools — decisions arrive late and fragmented.',
    toolFailure: 'Dashboards show data; they do not orchestrate judgment, risk, or execution discipline.',
    professionalApproach: 'Institutions run operating systems: shared context, decision gates, and audit trails.',
    ccaiSolution:
      'Terminal OS unifies Intelligence Chart, Security Scanner, AI Coaching, Trade Like Me, and Secure Execution in one desk.',
  },
  {
    id: 'intelligence_chart',
    label: 'Intelligence Chart',
    productPaths: ['/terminalOS', '/market-intel'],
    priorityBoost: 22,
    keywords: ['intelligence chart', 'market structure', 'on-chain intelligence'],
    seedTitles: [
      'How Intelligence Chart reads market structure beyond indicators',
      'Why Decision Intelligence beats classic chart patterns',
    ],
    problem: 'Indicator stacks create noise and false confidence without context.',
    toolFailure: 'Most charting tools stop at candles and overlays — they never connect risk or wallet behavior.',
    professionalApproach: 'Pros layer structure, flow, and risk before size.',
    ccaiSolution:
      'Intelligence Chart is Terminal OS’s structured market surface — context for Decision Engine, not a standalone gadget.',
  },
  {
    id: 'ai_gateway',
    label: 'AI Gateway',
    productPaths: ['/docs', '/terminalOS', '/app'],
    priorityBoost: 20,
    keywords: ['ai gateway', 'ai trading', 'ai + trading'],
    seedTitles: [
      'How AI Gateway removes trading complexity',
      'AI Gateway: one intelligence surface for scanners and desks',
    ],
    problem: 'Builders and traders hit fragmented APIs and inconsistent risk language.',
    toolFailure: 'Raw chain RPCs and ad-hoc bots lack a governed intelligence contract.',
    professionalApproach: 'Serious systems expose a single gateway with auth, rate limits, and evidence.',
    ccaiSolution:
      'CryptoCheckAI AI Gateway delivers institutional scan and intelligence access — the same truth Terminal OS consumes.',
  },
  {
    id: 'ai_coaching',
    label: 'AI Coaching',
    productPaths: ['/ai-coach', '/terminalOS'],
    priorityBoost: 18,
    keywords: ['ai coaching', 'behavioral finance', 'market psychology'],
    seedTitles: [
      'Why AI Coaching matters more than another signal feed',
      'Coaching that refuses to invent edge',
    ],
    problem: 'Traders want feedback on their process, not another noisy tip channel.',
    toolFailure: 'Generic chatbots invent advice when data is thin.',
    professionalApproach: 'Coaches ground feedback in the trader’s own sample and risk rules.',
    ccaiSolution:
      'AI Coaching in Terminal OS is DNA-aware and evidence-bound — it stays quiet when the sample is insufficient.',
  },
  {
    id: 'trade_like_me',
    label: 'Trade Like Me',
    productPaths: ['/trade-like-me', '/terminalOS'],
    priorityBoost: 18,
    keywords: ['trade like me', 'decision pattern', 'ai trading'],
    seedTitles: [
      'How Trade Like Me learns your decision pattern',
      'Mirroring edge without copying blind risk',
    ],
    problem: 'Copy-trading often clones size and timing without understanding the original decision logic.',
    toolFailure: 'Blind mirroring ignores DNA, risk appetite, and invalidation.',
    professionalApproach: 'Pros study process first, then selectively align.',
    ccaiSolution:
      'Trade Like Me learns from Decision Engine + Explainable AI — still risk-gated before any execution path.',
  },
  {
    id: 'security_scanner',
    label: 'Security Scanner',
    productPaths: ['/scanner', '/security', '/terminalOS'],
    priorityBoost: 24,
    keywords: ['security', 'security scanner', 'rug', 'honeypot'],
    seedTitles: [
      'How Security Scanner protects users before they click buy',
      'Rug risk as an operating-system concern — not an afterthought',
    ],
    problem: 'Capital is lost when risk assessment happens after the trade impulse.',
    toolFailure: 'Many “rug checkers” are black boxes with no path into execution discipline.',
    professionalApproach: 'Security is a gate in the workflow, not a separate tab.',
    ccaiSolution:
      'Security Scanner feeds Terminal OS and Secure Execution — DANGER verdicts stay friction-heavy on purpose.',
  },
  {
    id: 'portfolio_intelligence',
    label: 'Portfolio Intelligence',
    productPaths: ['/portfolio', '/terminalOS'],
    priorityBoost: 16,
    keywords: ['portfolio intelligence', 'portfolio automation', 'capital rotation'],
    seedTitles: [
      'How Portfolio Intelligence helps investors stay disciplined',
      'Capital Rotation as portfolio protection, not prediction',
    ],
    problem: 'Holdings drift without a coherent risk narrative.',
    toolFailure: 'Balance trackers report numbers; they rarely explain concentration or rotation.',
    professionalApproach: 'Portfolio desks monitor exposure, rotation, and process continuously.',
    ccaiSolution:
      'Portfolio Intelligence inside Terminal OS connects holdings context to coaching and market structure — not fabricated PnL theater.',
  },
  {
    id: 'secure_execution',
    label: 'Secure Execution',
    productPaths: ['/execution', '/terminalOS'],
    priorityBoost: 17,
    keywords: ['secure execution', 'simulate before send', 'non-custodial'],
    seedTitles: [
      'Secure Execution: simulate before send, always',
      'Why non-custodial execution still needs risk gates',
    ],
    problem: 'Speed without simulation is how wallets get drained by bad routes.',
    toolFailure: 'One-click swap UIs hide slippage, impact, and fee lines until too late.',
    professionalApproach: 'Pros simulate, bound slippage, and refuse unsafe routes.',
    ccaiSolution:
      'Secure Execution in Terminal OS is non-custodial, simulated, and risk-gated — platform fees stay explicit.',
  },
  {
    id: 'discovery_engine',
    label: 'Discovery Engine',
    productPaths: ['/discovery', '/terminalOS', '/scanner'],
    priorityBoost: 15,
    keywords: ['discovery engine', 'emerging narratives', 'token discovery'],
    seedTitles: [
      'Discovery without FOMO: scanning before chasing',
      'How Discovery Engine feeds Terminal OS, not Telegram rumor',
    ],
    problem: 'Narratives move faster than diligence.',
    toolFailure: 'Trend lists without security context manufacture urgency.',
    professionalApproach: 'Discovery is ranked by evidence, then routed to deeper desks.',
    ccaiSolution:
      'Discovery Engine surfaces candidates into Scanner and Terminal OS — never auto-arms snipers.',
  },
  {
    id: 'decision_intelligence',
    label: 'Decision Intelligence',
    productPaths: ['/terminalOS', '/trade-like-me'],
    priorityBoost: 21,
    keywords: ['decision intelligence', 'decision engine', 'explainable ai'],
    seedTitles: [
      'Why Decision Intelligence beats indicators',
      'One decision, many engines — how CryptoCheckAI stays coherent',
    ],
    problem: 'Traders drown in conflicting signals with no single decision object.',
    toolFailure: 'Siloed bots each shout a different “edge.”',
    professionalApproach: 'A decision is scored, explained, and gated before action.',
    ccaiSolution:
      'Decision Engine + Explainable AI give Terminal OS a single auditable call — Scout never invents that call.',
  },
  {
    id: 'whale_intelligence',
    label: 'Whale Intelligence',
    productPaths: ['/terminalOS', '/market-intel'],
    priorityBoost: 14,
    keywords: ['whale intelligence', 'whale', 'smart money'],
    seedTitles: [
      'Whale movements as context — not commands to copy',
      'Reading smart-money flow inside Terminal OS',
    ],
    problem: 'Whale alerts without wallet quality scores create herd mistakes.',
    toolFailure: 'Raw transfer feeds look urgent but lack attribution and risk.',
    professionalApproach: 'Flow is interpreted beside structure and security.',
    ccaiSolution:
      'Whale Tracking in Terminal OS is a context rail for Decision Intelligence — never an auto-trade trigger from Scout content.',
  },
  {
    id: 'market_psychology',
    label: 'Market Psychology',
    productPaths: ['/ai-coach', '/terminalOS'],
    priorityBoost: 12,
    keywords: ['market psychology', 'behavioral finance', 'trader dna'],
    seedTitles: [
      'Market psychology: process over impulse',
      'Behavioral finance for on-chain traders',
    ],
    problem: 'Emotional bias destroys edge faster than bad indicators.',
    toolFailure: 'Most apps optimize for engagement, not discipline.',
    professionalApproach: 'Institutions measure process adherence.',
    ccaiSolution:
      'AI Coaching surfaces emotional-bias signals from Trader DNA — educational, never a promise of profit.',
  },
]

export const PRIORITY_CONFIDENCE_THRESHOLD = Number(process.env.SCOUT_PRIORITY_THRESHOLD ?? 62)

export const BANNED_HYPE =
  /\b(guaranteed|risk[- ]?free|100%\s*safe|moon|ape in|to the moon|get rich|easy money|sure shot|clickbait)\b/i

/** Product paths that must remain live — used for internal linking. */
export const SCOUT_PRODUCT_PATHS = [
  { href: '/terminalOS', anchor: 'Terminal OS' },
  { href: '/app', anchor: 'Open App' },
  { href: '/scanner', anchor: 'Security Scanner' },
  { href: '/discovery', anchor: 'Discovery Engine' },
  { href: '/execution', anchor: 'Secure Execution' },
  { href: '/ai-coach', anchor: 'AI Coaching' },
  { href: '/trade-like-me', anchor: 'Trade Like Me' },
  { href: '/market-intel', anchor: 'Market Intelligence' },
  { href: '/portfolio', anchor: 'Portfolio Intelligence' },
  { href: '/pricing', anchor: 'Pricing' },
  { href: '/docs', anchor: 'AI Gateway / Docs' },
  { href: '/security', anchor: 'Security Model' },
  { href: '/blog', anchor: 'Intelligence Blog' },
] as const

export function getPillar(id: EcosystemPillar | undefined): PillarDef {
  return ECOSYSTEM_PILLARS.find((p) => p.id === id) ?? ECOSYSTEM_PILLARS[0]!
}

/** Rotate ecosystem seed topics so every cycle reinforces Terminal OS. */
export function pickEcosystemSeeds(count: number, salt: string): PillarDef[] {
  const offset = Math.abs(
    [...salt].reduce((a, c) => a + c.charCodeAt(0), 0),
  ) % ECOSYSTEM_PILLARS.length
  const out: PillarDef[] = []
  for (let i = 0; i < Math.min(count, ECOSYSTEM_PILLARS.length); i++) {
    out.push(ECOSYSTEM_PILLARS[(offset + i) % ECOSYSTEM_PILLARS.length]!)
  }
  return out
}
