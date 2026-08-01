/**
 * Simple Mode vocabulary — never import this into Pro Mode components.
 */

import type { AttentionEngineId } from '../types'

export const SIMPLE_VOCAB = {
  connectWallet: 'Secure Account',
  quickSwap: 'AI Execution',
  execute: 'Execute',
  estimatedTotalCost: 'Estimated total cost',
  viewDetails: 'View details',
  advanced: 'Advanced',
  disconnect: 'Sign out',
} as const

export const SIMPLE_ENGINE_LABEL: Record<AttentionEngineId, string> = {
  'decision-engine': 'AI Decision',
  'explainable-ai': 'AI Reasoning',
  'security-scanner': 'Security',
  'market-intelligence': 'Market Watch',
  'wallet-intelligence': 'Wallet Watch',
  'portfolio-intelligence': 'Your Capital',
  'automation-engine': 'Automation',
  'ai-coach': 'AI Coach',
}

export type SimpleWorkspaceId = 'home' | 'employees' | 'coach' | 'discovery' | 'execution'

export const SIMPLE_WORKSPACES: {
  id: SimpleWorkspaceId
  label: string
  question: string
}[] = [
  {
    id: 'home',
    label: 'Home',
    question: 'What deserves your attention right now?',
  },
  {
    id: 'employees',
    label: 'AI Employees',
    question: 'What are your AI employees seeing?',
  },
  {
    id: 'coach',
    label: 'AI Coach',
    question: 'What happened, why, and what should you do?',
  },
  {
    id: 'discovery',
    label: 'Discovery',
    question: 'Which high-conviction opportunities deserve a look?',
  },
  {
    id: 'execution',
    label: 'Execution',
    question: 'Should you approve this AI recommendation?',
  },
]

/** Engine → workspace membership for filtered views (no duplicated ranking). */
export const WORKSPACE_ENGINES: Record<
  Exclude<SimpleWorkspaceId, 'home' | 'execution'>,
  AttentionEngineId[]
> = {
  employees: [
    'decision-engine',
    'market-intelligence',
    'wallet-intelligence',
    'security-scanner',
    'automation-engine',
  ],
  coach: ['ai-coach', 'portfolio-intelligence', 'explainable-ai'],
  /** High-conviction list = Decision objects only (no market shadow ranking) */
  discovery: ['decision-engine'],
}
