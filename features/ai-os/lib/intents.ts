import type { OsIntentId } from '../types'

export type OsIntent = {
  id: OsIntentId
  label: string
  prompt: string
}

export const OS_INTENTS: OsIntent[] = [
  {
    id: 'invest',
    label: 'I want to invest',
    prompt: 'Route me to the strongest Decision Engine opportunity.',
  },
  {
    id: 'passive',
    label: 'I want passive income',
    prompt: 'Prefer patience and capital preservation over forced entries.',
  },
  {
    id: 'monitor',
    label: 'I want AI to monitor opportunities',
    prompt: 'Watch markets continuously and surface only high-conviction Decisions.',
  },
  {
    id: 'protect',
    label: 'I want to protect my wallet',
    prompt: 'Prioritize risk, security band, and capital protection.',
  },
  {
    id: 'copy_strategy',
    label: 'I want to copy my own strategy',
    prompt: 'Use Trader DNA when available; teach the OS when it is not.',
  },
]
