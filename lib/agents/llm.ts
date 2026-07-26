/**
 * Shared LLM config for AI Employees / terminal coach.
 * Uses OPENAI_API_KEY (or legacy OPENAI_KEY) — never expose to the client.
 */

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_KEY?.trim() || null
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey())
}

/** Default chat/completions model for agent runs. */
export const AGENT_OPENAI_MODEL = 'gpt-4o' as const
