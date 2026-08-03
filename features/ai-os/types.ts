/**
 * AI Operating System — presentation contracts.
 * Intelligence is the interface; no dashboard chrome types.
 */

export type GatewayPhase = 'briefing' | 'awaiting_approval' | 'execute' | 'idle'

export type CoachMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  at: string
}

export type MissionControlNode = {
  id: string
  label: string
  status: 'live' | 'idle' | 'waiting' | 'offline' | 'calibrating'
  detail: string | null
}
