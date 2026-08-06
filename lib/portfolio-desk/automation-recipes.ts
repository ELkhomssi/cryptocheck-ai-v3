/**
 * Shared Automation recipe catalog.
 * Maps UI recipes → real builtin agent IDs (lib/agents/roster.ts).
 * Single source for AutomationPanel + bridge + cron.
 */

import type { AgentActionType } from '@/types/agents'

export type AutomationRecipe = {
  id: string
  title: string
  blurb: string
  /** Exact builtin agent id from roster.ts */
  agentId: string
  action: AgentActionType
  /** Default schedule cadence when user enables unattended runs. */
  intervalMinutes: number
  module: 'research' | 'market' | 'portfolio' | 'security' | 'trading' | 'launch'
}

export const AUTOMATION_RECIPES: readonly AutomationRecipe[] = [
  {
    id: 'daily-outlook',
    title: 'Daily market outlook',
    blurb: 'Structured outlook from live screener + market context (Market Strategist).',
    agentId: 'market-strategist',
    action: 'report',
    intervalMinutes: 24 * 60,
    module: 'research',
  },
  {
    id: 'liquidity-watch',
    title: 'Liquidity change scan',
    blurb: 'Scan trending / new listings for liquidity structure changes (Research Analyst).',
    agentId: 'research-analyst',
    action: 'signals',
    intervalMinutes: 6 * 60,
    module: 'market',
  },
  {
    id: 'portfolio-audit',
    title: 'Portfolio risk audit',
    blurb: 'Concentration and risk pass over the connected wallet (Risk Manager).',
    agentId: 'risk-manager',
    action: 'analysis',
    intervalMinutes: 12 * 60,
    module: 'portfolio',
  },
  {
    id: 'whale-monitor',
    title: 'Whale / smart-money pulse',
    blurb: 'Smart-money leaning signals from live market feeds (Whale Analyst).',
    agentId: 'whale-analyst',
    action: 'signals',
    intervalMinutes: 4 * 60,
    module: 'market',
  },
] as const

export function getAutomationRecipe(id: string): AutomationRecipe | undefined {
  return AUTOMATION_RECIPES.find((r) => r.id === id)
}
