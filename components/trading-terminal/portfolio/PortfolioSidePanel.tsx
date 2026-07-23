'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  Droplets,
  Fish,
  Newspaper,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { useSolana } from '@/components/SolanaProvider'
import {
  appendToSession,
  buildCopilotDesk,
  createCopilotSession,
  runCopilotPrompt,
  type CopilotSession,
} from '@/lib/trading-terminal/ai-copilot'
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
  mint?: string
  symbol?: string
}

function toneIcon(tone: AlertItem['tone']) {
  if (tone === 'pos') return TrendingUp
  if (tone === 'warn') return Droplets
  if (tone === 'neg') return AlertTriangle
  return Fish
}

function toneClass(tone: AlertItem['tone']) {
  if (tone === 'pos') return 'bg-[rgba(30,154,99,0.12)] text-[var(--tit-pos)]'
  if (tone === 'warn') return 'bg-[rgba(169,120,46,0.12)] text-[var(--tit-accent-bright)]'
  if (tone === 'neg') return 'bg-[rgba(209,74,56,0.12)] text-[var(--tit-neg)]'
  return 'bg-[rgba(110,95,224,0.12)] text-[var(--tit-chain)]'
}

function relativeAge(iso?: string | null): string {
  if (!iso) return 'now'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'now'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function buildAlerts(
  findings: HiddenRiskFinding[],
  signals: UnifiedSignal[],
  holdings: PortfolioHolding[],
): AlertItem[] {
  const fromSignals: AlertItem[] = signals.slice(0, 8).map((s) => {
    const verdict = String(s.verdict ?? '').toUpperCase()
    const tone: AlertItem['tone'] =
      verdict.includes('DANGER') || verdict.includes('HIGH') || verdict.includes('BLOCK')
        ? 'neg'
        : verdict.includes('CAUTION')
          ? 'warn'
          : s.type?.toLowerCase().includes('buy')
            ? 'pos'
            : 'info'
    return {
      id: s.id,
      title: s.tokenSymbol || s.label || 'Signal',
      detail: `${s.type} · ${s.sourceTag}${s.scoreValue != null ? ` · score ${Math.round(s.scoreValue)}` : ''}`,
      tone,
      age: relativeAge(s.msgTimestamp || s.ingestTimestamp),
      mint: s.contractAddress ?? undefined,
      symbol: s.tokenSymbol || s.label || undefined,
    }
  })

  const fromFindings: AlertItem[] = findings.slice(0, 4).map((f) => ({
    id: f.id,
    title: f.title,
    detail: f.detail,
    tone:
      f.severity === 'CRITICAL' ? 'neg' : f.severity === 'WARNING' ? 'warn' : 'info',
    age: 'live',
    mint: f.mint ?? undefined,
    symbol: f.symbol ?? undefined,
  }))

  const merged = [...fromSignals, ...fromFindings]
  if (merged.length) return merged.slice(0, 10)

  if (holdings.length) {
    return [
      {
        id: 'watch',
        title: 'Monitoring portfolio',
        detail: `${holdings.length} holdings scanned — waiting for live signal events.`,
        tone: 'info',
        age: 'now',
      },
    ]
  }

  return [
    {
      id: 'empty',
      title: 'No live alerts yet',
      detail: 'Connect a wallet and wait for signal / risk events. Nothing is fabricated.',
      tone: 'info',
      age: 'now',
    },
  ]
}

const QUICK = [
  {
    label: 'Analyze top holding',
    sub: 'Get AI insights and risk analysis',
    icon: Sparkles,
  },
  {
    label: "What's trending today?",
    sub: 'See top narratives and tokens',
    icon: TrendingUp,
  },
  {
    label: 'Review my portfolio',
    sub: 'AI-powered portfolio review',
    icon: Wallet,
  },
  {
    label: 'Market outlook',
    sub: 'Get AI market predictions',
    icon: Newspaper,
  },
] as const

function greetHour(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function PortfolioSidePanel({
  mode = 'live',
  findings,
  insights,
  holdings,
  signals = [],
  onAnalyzeSymbol,
}: {
  mode?: 'demo' | 'live'
  findings: HiddenRiskFinding[]
  insights: PortfolioAiInsights
  holdings: PortfolioHolding[]
  signals?: UnifiedSignal[]
  onAnalyzeSymbol?: (symbol: string, mint: string) => void
}) {
  const { shortAddr, isConnected } = useSolana()
  const alerts = useMemo(
    () => buildAlerts(findings, signals, holdings),
    [findings, signals, holdings],
  )
  const seed = useMemo(() => buildCopilotDesk(mode), [mode])
  const [sessions, setSessions] = useState<CopilotSession[]>(seed.sessions)
  const [activeId, setActiveId] = useState<string | null>(seed.sessions[0]?.id ?? null)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null
  const lastAi = active?.responses.at(-1)
  const top = holdings[0]
  const name = isConnected && shortAddr ? shortAddr : 'trader'

  const run = (prompt: string) => {
    const text = prompt.trim()
    if (!text) return
    startTransition(() => {
      setSessions((prev) => {
        let list = prev
        let sess = list.find((s) => s.id === activeId) ?? list[0]
        if (!sess) {
          sess = createCopilotSession(false)
          list = [sess]
        }
        const response = runCopilotPrompt({
          prompt: text,
          dataMode: 'live',
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
    <aside className="tit-port-side flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="tit-port-panel-head" style={{ padding: '0 4px 14px', border: 'none' }}>
        <h2>AI Alerts</h2>
        <span className="tit-port-panel-link">
          {signals.length ? `${signals.length} feed` : 'View all'}
        </span>
      </div>

      <div className="mb-2">
        {alerts.map((a) => {
          const Icon = toneIcon(a.tone)
          return (
            <button
              key={a.id}
              type="button"
              className="tit-alert-item"
              disabled={!a.mint}
              onClick={() => {
                if (a.mint && a.symbol) onAnalyzeSymbol?.(a.symbol, a.mint)
              }}
            >
              <div className={`tit-al-icon ${toneClass(a.tone)}`}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="tit-al-title">{a.title}</div>
                <div className="tit-al-desc">{a.detail}</div>
              </div>
              <div className="tit-al-time">{a.age}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <div className="tit-port-panel-head" style={{ padding: '0 4px 0', border: 'none' }}>
          <h2>AI Coach</h2>
          <span className="tit-coach-status">
            <span className="dot" />
            Online
          </span>
        </div>
        <div className="tit-coach-greet">
          {greetHour()}, {name}
        </div>
        <div className="tit-coach-sub">How can I help you today?</div>

        {QUICK.map((q) => {
          const Icon = q.icon
          const title =
            q.label === 'Analyze top holding' && top ? `Analyze ${top.symbol}` : q.label
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
              className="tit-coach-action"
              onClick={() => {
                if (q.label === 'Analyze top holding' && top) {
                  onAnalyzeSymbol?.(top.symbol, top.mint)
                }
                run(prompt)
              }}
            >
              <div className="tit-ca-icon">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </div>
              <div>
                <div className="tit-ca-title">{title}</div>
                <div className="tit-ca-sub">{q.sub}</div>
              </div>
            </button>
          )
        })}

        {lastAi ? (
          <div className="mt-3 rounded-[6px] border border-[var(--tit-border)] bg-[var(--tit-bg-3)] p-3">
            <p className="text-[12.5px] font-medium leading-relaxed text-[var(--tit-text-0)]">
              {lastAi.summary}
            </p>
            {lastAi.insufficientData ? (
              <p className="mt-1 text-[11px] font-semibold text-[var(--tit-warn)]">
                Insufficient live data — answer withheld rather than invented.
              </p>
            ) : null}
          </div>
        ) : insights.suggestedActions[0] ? (
          <p className="mt-2 px-1 text-[11.5px] text-[var(--tit-text-2)]">
            {insights.suggestedActions[0]}
          </p>
        ) : null}

        <form
          className="tit-ask-box"
          onSubmit={(e) => {
            e.preventDefault()
            run(draft)
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask me anything…"
            aria-label="Ask AI Coach"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="tit-ask-send"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </form>
        <div className="tit-ask-note">AI responses are not financial advice.</div>
      </div>
    </aside>
  )
}
