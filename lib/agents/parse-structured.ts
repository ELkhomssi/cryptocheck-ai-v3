import type { AgentRunStructured } from '@/types/agents'

const DEFAULT_DISCLAIMER = 'Not financial advice · DYOR. Informational only.'

export function parseStructuredAgentOutput(raw: string): AgentRunStructured {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) text = fence[1].trim()

  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1))
      } catch {
        parsed = null
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      title: 'Agent output',
      summary: text.slice(0, 2000) || 'No structured output returned.',
      disclaimer: DEFAULT_DISCLAIMER,
    }
  }

  const o = parsed as Record<string, unknown>
  const sections = Array.isArray(o.sections)
    ? o.sections
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({
          heading: String(s.heading ?? 'Section').slice(0, 120),
          body: String(s.body ?? '').slice(0, 4000),
        }))
        .filter((s) => s.body)
    : undefined

  const signals = Array.isArray(o.signals)
    ? o.signals
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({
          symbol: typeof s.symbol === 'string' ? s.symbol : undefined,
          mint: typeof s.mint === 'string' ? s.mint : undefined,
          note: String(s.note ?? '').slice(0, 800),
          severity: typeof s.severity === 'string' ? s.severity : undefined,
        }))
        .filter((s) => s.note)
    : undefined

  const stats = Array.isArray(o.stats)
    ? o.stats
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({
          label: String(s.label ?? '').slice(0, 80),
          value: String(s.value ?? '').slice(0, 120),
        }))
        .filter((s) => s.label)
    : undefined

  const suggestions = Array.isArray(o.suggestions)
    ? o.suggestions
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s, i) => ({
          id: String(s.id ?? `suggestion-${i + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .slice(0, 64),
          title: String(s.title ?? 'Suggestion').slice(0, 120),
          detail: String(s.detail ?? '').slice(0, 2000),
        }))
        .filter((s) => s.detail)
    : undefined

  return {
    title: String(o.title ?? 'Agent report').slice(0, 160),
    summary: String(o.summary ?? '').slice(0, 4000) || 'No summary.',
    sections,
    signals,
    stats,
    suggestions,
    disclaimer:
      typeof o.disclaimer === 'string' && o.disclaimer.trim()
        ? o.disclaimer.trim().slice(0, 400)
        : DEFAULT_DISCLAIMER,
  }
}
