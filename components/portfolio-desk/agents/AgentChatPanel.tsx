'use client'

import { useEffect, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { StatusDot } from './StatusDot'
import type { RosterEmployeeView } from '@/types/agents'

type Msg = { role: 'user' | 'assistant'; text: string }

export function AgentChatPanel({
  employee,
  onClose,
}: {
  employee: RosterEmployeeView
  onClose: () => void
}) {
  const { walletAddress } = useSolana()
  const [draft, setDraft] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/agents/${encodeURIComponent(employee.id)}/run`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { available?: boolean }) => {
        if (!cancelled) setOnline(Boolean(body.available))
      })
      .catch(() => {
        if (!cancelled) setOnline(false)
      })
    return () => {
      cancelled = true
    }
  }, [employee.id])

  const run = async (prompt: string) => {
    const text = prompt.trim()
    if (!text || streaming) return
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    setDraft('')
    setStreaming(true)
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(employee.id)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          walletAddress: walletAddress ?? undefined,
        }),
      })
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 503) setOnline(false)
        setMsgs((m) => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'assistant',
            text: err.error || 'Agent unavailable.',
          }
          return next
        })
        return
      }
      setOnline(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const snapshot = acc
        setMsgs((m) => {
          const next = [...m]
          next[next.length - 1] = { role: 'assistant', text: snapshot }
          return next
        })
      }
    } catch {
      setMsgs((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', text: 'Network error talking to agent.' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="pd-panel" style={{ marginTop: 16 }}>
      <div className="pd-panel-head">
        <div>
          <h2>{employee.name}</h2>
          <div style={{ fontSize: 11, color: 'var(--pd-text-faint)', marginTop: 2 }}>{employee.role}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusDot online={online} />
          <button type="button" className="pd-tab" onClick={onClose} aria-label="Close chat">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 18px 18px' }}>
        {msgs.length ? (
          <div className="pd-chat">
            {msgs.map((m, i) => (
              <div key={i} className={`pd-chat-msg${m.role === 'user' ? ' user' : ''}`}>
                {m.text || (streaming && i === msgs.length - 1 ? '…' : '')}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--pd-text-dim)', marginBottom: 12 }}>
            Ask for setups grounded in live price and screener data. Nothing is invented.
          </div>
        )}

        <form
          className="pd-ask-box"
          onSubmit={(e) => {
            e.preventDefault()
            void run(draft)
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${employee.name}…`}
            aria-label={`Message ${employee.name}`}
            disabled={streaming || online === false}
          />
          <button
            type="submit"
            className="pd-ask-send"
            disabled={streaming || online === false || !draft.trim()}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </form>
        <div style={{ fontSize: 10.5, color: 'var(--pd-text-faint)', marginTop: 8 }}>
          Not financial advice · DYOR
        </div>
      </div>
    </div>
  )
}
