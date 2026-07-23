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
  if (tone === 'pos') return 'tit-al-pos'
  if (tone === 'warn') return 'tit-al-warn'
  if (tone === 'neg') return 'tit-al-neg'
  return 'tit-al-info'
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

function polishTitle(s: UnifiedSignal): string {
  const type = String(s.type ?? '').toLowerCase()
  const verdict = String(s.verdict ?? '').toUpperCase()
  if (verdict.includes('DANGER') || verdict.includes('HIGH')) return 'High Risk Detected'
  if (type.includes('whale')) return 'Whale Activity'
  if (type.includes('liq')) return 'Liquidity Increased'
  if (type.includes('dev')) return 'Dev Wallet Activity'
  if (type.includes('buy') || type.includes('accum')) return 'Smart Money Accumulating'
  const sym = s.tokenSymbol || s.label
  if (sym) return `${sym} signal`
  return 'Market signal'
}

function polishDetail(s: UnifiedSignal): string {
  const parts = [
    s.type,
    s.sourceTag,
    s.scoreValue != null ? `score ${Math.round(s.scoreValue)}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
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
      title: polishTitle(s),
      detail: polishDetail(s),
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

  const merged = [...fromFindings, ...fromSignals]
  if (merged.length) return merged.slice(0, 8)

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
      detail: 'Connect a wallet and wait for signal / risk events.',
      tone: 'info',
      age: 'now',
    },
  ]
}

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

  const quick = [
    {
      label: top ? `Analyze ${top.symbol}` : 'Analyze top holding',
      sub: 'Get AI insights and risk analysis',
      icon: Sparkles,
      prompt: top ? `Analyze ${top.symbol}` : 'Analyze my top holding',
      runAnalyze: Boolean(top),
    },
    {
      label: "What's trending today?",
      sub: 'See top narratives and tokens',
      icon: TrendingUp,
      prompt: "What's trending today?",
      runAnalyze: false,
    },
    {
      label: 'Review my portfolio',
      sub: 'AI-powered portfolio review',
      icon: Wallet,
      prompt: 'Review my portfolio',
      runAnalyze: false,
    },
    {
      label: 'Market outlook',
      sub: 'Get AI market predictions',
      icon: Newspaper,
      prompt: 'Market outlook',
      runAnalyze: false,
    },
  ] as const

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
      <div className="tit-port-aside-head">
        <h2>AI Alerts</h2>
        <button type="button" className="tit-port-panel-link">
          View all
        </button>
      </div>

      <div className="tit-port-alerts">
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

      <div className="tit-coach">
        <div className="tit-port-aside-head">
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

        {quick.map((q) => {
          const Icon = q.icon
          return (
            <button
              key={q.label}
              type="button"
              disabled={pending}
              className="tit-coach-action"
              onClick={() => {
                if (q.runAnalyze && top) onAnalyzeSymbol?.(top.symbol, top.mint)
                run(q.prompt)
              }}
            >
              <div className="tit-ca-icon">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </div>
              <div>
                <div className="tit-ca-title">{q.label}</div>
                <div className="tit-ca-sub">{q.sub}</div>
              </div>
            </button>
          )
        })}

        {lastAi ? (
          <div className="tit-coach-reply">
            <p>{lastAi.summary}</p>
            {lastAi.insufficientData ? (
              <p className="tit-coach-warn">
                Insufficient live data — answer withheld rather than invented.
              </p>
            ) : null}
          </div>
        ) : insights.suggestedActions[0] ? (
          <p className="tit-coach-hint">{insights.suggestedActions[0]}</p>
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
