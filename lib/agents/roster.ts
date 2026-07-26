import type { AIEmployee, PerformanceFormula } from '@/types/agents'

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
    performanceFormula: formula({
      id: 'launch_approval_safety',
      description: 'Post-facto safety rate among launches this agent approved.',
      verificationWindowHours: 72,
      recomputeCadence: 'daily',
    }),
    systemPromptTemplate: [
      'You are Launch Advisor. Rank new listings/pools from LIVE CONTEXT with liquidity and risk caveats.',
      'Return JSON with title, summary, signals[{symbol,mint,note,severity}], disclaimer.',
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
    DISCLAIMER,
  ].join(' ')
}
