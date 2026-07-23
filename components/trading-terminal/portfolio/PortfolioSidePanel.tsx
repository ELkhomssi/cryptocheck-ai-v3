'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  Droplets,
  Fish,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  appendToSession,
  buildCopilotDesk,
  createCopilotSession,
  runCopilotPrompt,
  type CopilotSession,
} from '@/lib/trading-terminal/ai-copilot'
import type { TerminalDataMode } from '@/lib/trading-terminal/data/types'
import type {
  HiddenRiskFinding,
  PortfolioAiInsights,
  PortfolioHolding,
} from '@/lib/trading-terminal/portfolio-intelligence'

type AlertItem = {
  id: string
  title: string
  detail: string
  tone: 'info' | 'pos' | 'warn' | 'neg'
  age: string
}

function toneIcon(tone: AlertItem['tone']) {
  if (tone === 'pos') return TrendingUp
  if (tone === 'warn') return Droplets
  if (tone === 'neg') return AlertTriangle
  return Fish
}

function toneClass(tone: AlertItem['tone']) {
  if (tone === 'pos') return 'bg-[rgba(22,163,74,0.1)] text-[var(--tit-pos)]'
  if (tone === 'warn') return 'bg-[rgba(217,119,6,0.1)] text-[var(--tit-warn)]'
  if (tone === 'neg') return 'bg-[rgba(220,38,38,0.1)] text-[var(--tit-neg)]'
  return 'bg-[rgba(37,99,235,0.1)] text-[var(--tit-accent)]'
}

function buildAlerts(
  findings: HiddenRiskFinding[],
  insights: PortfolioAiInsights,
  holdings: PortfolioHolding[],
): AlertItem[] {
  const fromFindings = findings.slice(0, 4).map((f, i) => ({
    id: f.id,
    title: f.title,
    detail: f.detail,
    tone:
      f.severity === 'CRITICAL'
        ? ('neg' as const)
        : f.severity === 'WARNING'
          ? ('warn' as const)
          : ('info' as const),
    age: `${(i + 1) * 2}m ago`,
  }))

  if (fromFindings.length > 0) return fromFindings

  const best = [...holdings].sort((a, b) => b.pnlPct - a.pnlPct)[0]
  const worst = [...holdings].sort((a, b) => a.pnlPct - b.pnlPct)[0]
  const items: AlertItem[] = []
  if (best) {
    items.push({
      id: 'best',
      title: 'Smart Money Accumulating',
      detail: `${best.symbol} leads book performance.`,
      tone: 'pos',
      age: '2m ago',
    })
  }
  if (worst && worst.pnlPct < 0) {
    items.push({
      id: 'risk',
      title: 'High Risk Detected',
      detail: `${worst.symbol} dragging portfolio risk.`,
      tone: 'neg',
      age: '5m ago',
    })
  }
  for (const [i, risk] of insights.risks.slice(0, 2).entries()) {
    items.push({
      id: `ins-${i}`,
      title: 'Liquidity Watch',
      detail: risk,
      tone: 'warn',
      age: `${(i + 3) * 3}m ago`,
    })
  }
  if (items.length === 0) {
    items.push({
      id: 'empty',
      title: 'Monitoring portfolio',
      detail: 'Alerts appear when wallet risk signals qualify.',
      tone: 'info',
      age: 'now',
    })
  }
  return items.slice(0, 5)
}

const QUICK = [
  { label: 'Analyze top holding', icon: Sparkles },
  { label: "What's trending today?", icon: TrendingUp },
  { label: 'Review my portfolio', icon: Wallet },
  { label: 'Market outlook', icon: Fish },
] as const

export function PortfolioSidePanel({
  mode,
  findings,
  insights,
  holdings,
  onAnalyzeSymbol,
}: {
  mode: TerminalDataMode
  findings: HiddenRiskFinding[]
  insights: PortfolioAiInsights
  holdings: PortfolioHolding[]
  onAnalyzeSymbol?: (symbol: string, mint: string) => void
}) {
  const alerts = useMemo(
    () => buildAlerts(findings, insights, holdings),
    [findings, insights, holdings],
  )
  const seed = useMemo(() => buildCopilotDesk(mode), [mode])
  const [sessions, setSessions] = useState<CopilotSession[]>(seed.sessions)
  const [activeId, setActiveId] = useState<string | null>(seed.sessions[0]?.id ?? null)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null
  const lastAi = active?.responses.at(-1)
  const top = holdings[0]

  const run = (prompt: string) => {
    const text = prompt.trim()
    if (!text) return
    startTransition(() => {
      setSessions((prev) => {
        let list = prev
        let sess = list.find((s) => s.id === activeId) ?? list[0]
        if (!sess) {
          sess = createCopilotSession(mode === 'demo')
          list = [sess]
        }
        const response = runCopilotPrompt({
          prompt: text,
          dataMode: mode,
          priorMode: sess.contextMode,
          contextSymbol: sess.contextSymbol ?? top?.symbol,
        })
        const next = appendToSession(sess, response)
        setActiveId(next.id)
        return list.map((s) => (s.id === sess!.id ? next : s))
      })
      setDraft('')
    })
  }

  return (
    <aside className="tit-port-side flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-[var(--tit-bg-1)] p-4">
      <section className="tit-port-side-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.9375rem] font-semibold text-[var(--tit-text-0)]">AI Alerts</h2>
          <span className="text-[0.6875rem] font-medium text-[var(--tit-text-2)]">Live</span>
        </header>
        <ul className="tit-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {alerts.map((a) => {
            const Icon = toneIcon(a.tone)
            return (
              <li
                key={a.id}
                className="flex gap-3 rounded-[14px] border border-[var(--tit-border)] bg-white p-3 transition-colors hover:border-[var(--tit-border-strong)]"
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${toneClass(a.tone)}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">{a.title}</p>
                    <span className="shrink-0 text-[0.625rem] font-medium text-[var(--tit-text-2)]">
                      {a.age}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[0.75rem] font-medium leading-snug text-[var(--tit-text-1)]">
                    {a.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="tit-port-side-card flex min-h-[320px] flex-[1.15] flex-col overflow-hidden">
        <header className="mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--tit-text-0)]">AI Coach</h2>
            <span className="flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--tit-pos)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tit-pos)]" />
              Online
            </span>
          </div>
          <p className="mt-1 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
            How can I help you today?
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2">
          {QUICK.map((q) => {
            const Icon = q.icon
            const prompt =
              q.label === 'Analyze top holding' && top
                ? `Analyze ${top.symbol}`
                : q.label === 'Review my portfolio'
                  ? 'Review my portfolio'
                  : q.label
            return (
              <button
                key={q.label}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (q.label === 'Analyze top holding' && top) onAnalyzeSymbol?.(top.symbol, top.mint)
                  run(prompt)
                }}
                className="flex items-center gap-2 rounded-[14px] border border-[var(--tit-border)] bg-white px-3 py-2.5 text-left transition-colors hover:border-[var(--tit-border-strong)] hover:bg-[var(--tit-bg-1)] disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--tit-accent)]" strokeWidth={1.8} />
                <span className="text-[0.6875rem] font-semibold leading-tight text-[var(--tit-text-0)]">
                  {top && q.label === 'Analyze top holding' ? `Analyze ${top.symbol}` : q.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="tit-scroll mt-3 min-h-0 flex-1 overflow-y-auto rounded-[14px] bg-[var(--tit-bg-1)] p-3">
          {lastAi ? (
            <div className="space-y-2">
              <p className="text-[0.8125rem] font-medium leading-relaxed text-[var(--tit-text-0)]">
                {lastAi.summary}
              </p>
              {lastAi.keyFindings[0] ? (
                <p className="text-[0.75rem] font-medium text-[var(--tit-text-1)]">
                  {lastAi.keyFindings[0]}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[0.8125rem] font-medium leading-relaxed text-[var(--tit-text-1)]">
              {insights.suggestedActions[0] ??
                'Ask about risk, holdings, or market conditions. Answers use your desk intelligence.'}
            </p>
          )}
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(draft)
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask me anything..."
            className="h-11 flex-1 rounded-full border border-[var(--tit-border)] bg-white px-4 text-[0.8125rem] font-medium outline-none placeholder:text-[var(--tit-text-2)] focus:border-[rgba(37,99,235,0.35)]"
            aria-label="Ask AI Coach"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tit-accent)] text-white transition-colors hover:bg-[var(--tit-accent-bright)] disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>
        <p className="mt-2 text-center text-[0.625rem] font-medium text-[var(--tit-text-2)]">
          AI responses are not financial advice.
        </p>
      </section>
    </aside>
  )
}
