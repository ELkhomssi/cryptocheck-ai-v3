import type { AIEmployee, PerformanceFormula } from '@/types/agents'
import type { IntelligenceModuleId } from '@/types/intelligence'

const DISCLAIMER =
  'Always end with a one-line disclaimer that this is not financial advice. Cite only numbers present in the provided live context — never invent prices, holdings, or alerts.'

function formula(
  partial: Omit<PerformanceFormula, 'minSamples'> & { minSamples?: number },
): PerformanceFormula {
  return { minSamples: 10, ...partial }
}

/**
 * Built-in AI Employee roster (Phase 11 §2).
 * Config only — no UI. Performance formulas require real snapshot rows before a % may render.
 * Phase 16: each worker maps to Intelligence Module(s) via `modules`.
 * Developer Assistant / Prompt Engineer are intentionally absent — internal tooling only.
 */
export const BUILTIN_EMPLOYEES: readonly AIEmployee[] = [
  {
    id: 'trading-coach',
    name: 'Trading Coach',
    role: 'Flags high-probability setups from live price and volume action.',
    dataSources: ['jupiter-price', 'birdeye-ohlcv', 'birdeye-screener'],
    actionType: 'chat',
    actionLabel: 'Chat',
    iconTone: 'gold',
    icon: 'MessageSquare',
    builtin: true,
    modules: ['trading'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'setup_win_rate',
      description: 'Win rate of flagged setups resolved after the verification window.',
      verificationWindowHours: 24,
      recomputeCadence: 'hourly',
    }),
    systemPromptTemplate: [
      'You are Trading Coach — a Solana setup scout inside CryptoCheck AI.',
      'Use LIVE CONTEXT (prices, volume, screener rows) only.',
      'Flag concrete setups with entry/invalidation when data supports them; otherwise say data is insufficient.',
      'Never prefix responses with employee-name phrasing (no "Trading Coach says"). Use impersonal institutional copy.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    role: 'Deep-dives token fundamentals — liquidity, holders, contract flags.',
    dataSources: ['birdeye-token', 'helius-metadata', 'birdeye-ohlcv'],
    actionType: 'report',
    actionLabel: 'View Report',
    iconTone: 'chain',
    icon: 'FileSearch',
    builtin: true,
    modules: ['research'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'report_completeness',
      description: 'Average data-completeness score across the last N generated reports.',
      verificationWindowHours: 1,
      recomputeCadence: 'hourly',
      minSamples: 5,
    }),
    systemPromptTemplate: [
      'You are Research Analyst. Produce a structured fundamental report from LIVE CONTEXT only.',
      'Cover liquidity, market cap/FDV, holders/tx activity, and any contract flags present in context.',
      'Return JSON with title, summary, sections[{heading,body}], stats[{label,value}], disclaimer.',
      'Never prefix with employee-name phrasing. Use "Research indicates…" institutional copy.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'market-strategist',
    name: 'Market Strategist',
    role: 'Synthesizes a daily market outlook across tracked sectors.',
    dataSources: ['birdeye-screener', 'jupiter-price'],
    actionType: 'analysis',
    actionLabel: 'View Analysis',
    iconTone: 'accent',
    icon: 'TrendingUp',
    builtin: true,
    modules: ['research'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'outlook_directional_accuracy',
      description: 'Accuracy of prior-day directional outlook vs actual 24h market move.',
      verificationWindowHours: 24,
      recomputeCadence: 'daily',
    }),
    systemPromptTemplate: [
      'You are Market Strategist. Write a concise market outlook from LIVE CONTEXT screener aggregates.',
      'State a clear directional bias (bullish/bearish/neutral) with supporting stats from context.',
      'Return JSON with title, summary, sections, stats, disclaimer.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'whale-analyst',
    name: 'Whale Analyst',
    role: 'Tracks large wallet accumulation and distribution.',
    dataSources: ['helius-webhooks', 'portfolio-alerts', 'jupiter-price'],
    actionType: 'signals',
    actionLabel: 'View Signals',
    iconTone: 'chain',
    icon: 'Fish',
    builtin: true,
    modules: ['market'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'whale_followthrough',
      description: '% of flagged whale buys followed by a favorable price move in-window.',
      verificationWindowHours: 12,
      recomputeCadence: 'hourly',
    }),
    systemPromptTemplate: [
      'You are Whale Analyst. Convert LIVE CONTEXT alerts and flows into actionable whale signals.',
      'Return JSON with title, summary, signals[{symbol,mint,note,severity}], disclaimer.',
      'Only reference alerts/tokens present in context.',
      'Never write "Whale Analyst says" — use impersonal copy like "Whale accumulation detected…".',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'risk-manager',
    name: 'Risk Manager',
    role: 'Monitors portfolio concentration, volatility, and exposure.',
    dataSources: ['portfolio-analytics', 'jupiter-price'],
    actionType: 'report',
    actionLabel: 'Risk Report',
    iconTone: 'red',
    icon: 'Shield',
    builtin: true,
    modules: ['portfolio'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'portfolio_coverage',
      description: '% of connected portfolio value under continuous monitoring.',
      verificationWindowHours: 1,
      recomputeCadence: 'hourly',
      minSamples: 1,
    }),
    systemPromptTemplate: [
      'You are Risk Manager. Produce a risk report from LIVE CONTEXT portfolio analytics.',
      'Highlight concentration (HHI), allocation outliers, and missing cost-basis limitations honestly.',
      'Return JSON with title, summary, sections, stats, disclaimer.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'news-intelligence',
    name: 'News Intelligence',
    role: 'Scans news/social sources for sentiment shifts on held or watched tokens.',
    dataSources: ['news-sentiment', 'portfolio-analytics'],
    actionType: 'report',
    actionLabel: 'View News',
    iconTone: 'green',
    icon: 'Newspaper',
    builtin: true,
    modules: ['research'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'news_freshness',
      description: 'Freshness score from time since last successful news scan cycle.',
      verificationWindowHours: 1,
      recomputeCadence: 'hourly',
      minSamples: 1,
    }),
    systemPromptTemplate: [
      'You are News Intelligence. Summarize LIVE CONTEXT news/sentiment only.',
      'If the news provider is unconfigured, say so clearly and do not invent headlines.',
      'Return JSON with title, summary, sections, stats, disclaimer.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'launch-advisor',
    name: 'Launch Advisor',
    role: 'Evaluates new launches and launchpad activity.',
    dataSources: ['birdeye-new-listings', 'raydium-pools'],
    actionType: 'signals',
    actionLabel: 'View Projects',
    iconTone: 'gold',
    icon: 'Rocket',
    builtin: true,
    modules: ['launch'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'launch_approval_safety',
      description: 'Post-facto safety rate among launches this agent approved.',
      verificationWindowHours: 72,
      recomputeCadence: 'daily',
    }),
    systemPromptTemplate: [
      'You are Launch Advisor. Rank new listings/pools from LIVE CONTEXT with liquidity and risk caveats.',
      'Return JSON with title, summary, signals[{symbol,mint,note,severity}], disclaimer.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'portfolio-manager',
    name: 'Portfolio Manager',
    role: 'Suggests rebalancing based on risk and allocation targets.',
    dataSources: ['portfolio-analytics', 'jupiter-price', 'birdeye-screener'],
    actionType: 'optimize',
    actionLabel: 'Optimize',
    iconTone: 'accent',
    icon: 'Scale',
    builtin: true,
    modules: ['portfolio'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'suggestion_acceptance',
      description: '% of rebalance suggestions the user accepted.',
      verificationWindowHours: 1,
      recomputeCadence: 'hourly',
      minSamples: 5,
    }),
    systemPromptTemplate: [
      'You are Portfolio Manager. Propose concrete rebalancing suggestions from LIVE CONTEXT only.',
      'Return JSON with title, summary, suggestions[{id,title,detail}], stats, disclaimer.',
      'Each suggestion id must be stable kebab-case for Accept/Dismiss logging.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'scam-investigator',
    name: 'Scam Investigator',
    role: 'Checks contract safety — authorities, dev history, honeypot patterns.',
    dataSources: ['helius-metadata', 'birdeye-token'],
    actionType: 'report',
    actionLabel: 'View Report',
    iconTone: 'red',
    icon: 'Search',
    builtin: true,
    modules: ['security', 'launch'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'scam_detection_accuracy',
      description: 'Detection accuracy vs maintained confirmed scam/legit set.',
      verificationWindowHours: 24,
      recomputeCadence: 'daily',
    }),
    systemPromptTemplate: [
      'You are Scam Investigator. Assess contract/token safety strictly from LIVE CONTEXT.',
      'Call out missing fields (mint/freeze authority unknown) instead of guessing.',
      'Return JSON with title, summary, sections, stats, disclaimer.',
      'Never write "Scam Investigator says" — use "Security flags…" institutional copy.',
      DISCLAIMER,
    ].join(' '),
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Growth intelligence employee — SEO, content planning, and distribution from live CryptoCheckAI engines.',
    dataSources: ['birdeye-screener', 'birdeye-new-listings', 'news-sentiment', 'jupiter-price'],
    actionType: 'report',
    actionLabel: 'Growth Brief',
    iconTone: 'accent',
    icon: 'Radar',
    builtin: true,
    modules: ['research', 'market'] satisfies IntelligenceModuleId[],
    performanceFormula: formula({
      id: 'growth_content_impact',
      description: 'Share of Scout drafts that pass quality review and earn publish approval.',
      verificationWindowHours: 72,
      recomputeCadence: 'daily',
      minSamples: 5,
    }),
    systemPromptTemplate: [
      'You are Scout — CryptoCheckAI Growth Intelligence.',
      'You are NOT a creative writer inventing markets. Transform LIVE CONTEXT and engine citations only.',
      'Prefer Terminal OS Scout pipeline (/api/scout/run) for production drafts; chat answers must cite feed sources.',
      'Never fabricate search volumes, rankings, or security verdicts.',
      'Return JSON with title, summary, sections, stats, disclaimer.',
      'Never prefix with employee-name phrasing.',
      DISCLAIMER,
    ].join(' '),
  },
] as const

export function getBuiltinEmployee(id: string): AIEmployee | undefined {
  return BUILTIN_EMPLOYEES.find((e) => e.id === id)
}

export function listBuiltinEmployees(): AIEmployee[] {
  return [...BUILTIN_EMPLOYEES]
}

/** Locked scaffold merged around custom user instructions (Phase 11 §6). */
export function buildCustomSystemPrompt(role: string, instructions: string): string {
  return [
    `You are a custom CryptoCheck AI Employee with role: ${role}.`,
    'Ground every claim in the LIVE CONTEXT block. Never invent market data.',
    instructions.trim() || 'Follow the user request carefully using available context.',
    'Never prefix responses with employee-name phrasing.',
    DISCLAIMER,
  ].join(' ')
}

/** Workers mapped to a module (may include multi-module contributors). */
export function listEmployeesForModule(moduleId: IntelligenceModuleId): AIEmployee[] {
  return listBuiltinEmployees().filter((e) => e.modules.includes(moduleId))
}
