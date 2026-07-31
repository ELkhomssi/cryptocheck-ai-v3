'use client'

import { useState, type FormEvent } from 'react'

/**
 * Compact Ask AI — the only persistent chrome beyond the Attention Feed.
 * Ties to AI Coaching philosophy; no sidebar of panels.
 */
export function AskAiInput({ onAsk }: { onAsk?: (q: string) => void }) {
  const [q, setQ] = useState('')
  const [echo, setEcho] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    onAsk?.(trimmed)
    setEcho(
      `AI Coaching received: “${trimmed}”. Open Pro Mode Trade Like Me / Coach panels for full desk depth — Simple Mode keeps the feed decisive.`,
    )
    setQ('')
  }

  return (
    <div className="sm-ask">
      <form onSubmit={submit} className="sm-ask-form">
        <label htmlFor="sm-ask-input" className="sm-ask-label">
          Ask AI
        </label>
        <input
          id="sm-ask-input"
          className="sm-ask-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Why this? What should I do next?"
          autoComplete="off"
        />
        <button type="submit" className="sm-btn sm-btn-primary">
          Ask
        </button>
      </form>
      {echo ? <p className="sm-ask-echo">{echo}</p> : null}
    </div>
  )
}
