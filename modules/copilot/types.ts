export type CopilotAction = 'BUY' | 'WAIT' | 'AVOID'

export type CopilotDecisionJson = {
  action: CopilotAction
  confidence: number
  entry_range: [number, number]
  exit_window: string
  reasoning: string
}
