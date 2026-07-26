'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Search } from 'lucide-react'
import type { ScreenerRow } from '@/lib/providers/types'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

type TokenSearchProps = {
  placeholder?: string
  /** Controlled query (optional). */
  value?: string
  onQueryChange?: (q: string) => void
  onSelect: (row: ScreenerRow) => void
  /** When true, selecting a hit also fills the input with the mint. */
  fillMintOnSelect?: boolean
  autoFocus?: boolean
  className?: string
  inputRef?: RefObject<HTMLInputElement | null>
  showShortcut?: boolean
}

export function TokenSearch({
  placeholder = 'Search symbol, name, or mint…',
  value,
  onQueryChange,
  onSelect,
  fillMintOnSelect = false,
  autoFocus,
  className,
  inputRef: externalRef,
  showShortcut = false,
}: TokenSearchProps) {
  const listId = useId()
  const localRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? localRef
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(value ?? '')
  const [hits, setHits] = useState<ScreenerRow[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (value != null && value !== draft) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync controlled value only
  }, [value])

  useEffect(() => {
    const q = draft.trim()
    if (q.length < 1) {
      setHits([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    const handle = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/market/screener/search?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (!res.ok) {
          setHits([])
          return
        }
        const body = (await res.json()) as { hits?: ScreenerRow[] }
        if (ac.signal.aborted) return
        setHits(body.hits ?? [])
        setActive(0)
        setOpen(true)
      } catch {
        if (!ac.signal.aborted) setHits([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(handle)
      ac.abort()
    }
  }, [draft])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (row: ScreenerRow) => {
    onSelect(row)
    if (fillMintOnSelect) {
      setDraft(row.mint)
      onQueryChange?.(row.mint)
    }
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div className="pd-search" style={{ maxWidth: 'none', width: '100%' }}>
        <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden />
        <input
          ref={inputRef}
          value={draft}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && hits.length > 0}
          role="combobox"
          onChange={(e) => {
            const next = e.target.value
            setDraft(next)
            onQueryChange?.(next)
            setOpen(true)
          }}
          onFocus={() => {
            if (hits.length) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!open || !hits.length) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const row = hits[active]
              if (row) pick(row)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {loading ? (
          <span style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>…</span>
        ) : showShortcut ? (
          <span className="pd-kbd">⌘K</span>
        ) : null}
      </div>

      {open && draft.trim() && (hits.length > 0 || (!loading && draft.trim().length > 0)) ? (
        <ul
          id={listId}
          role="listbox"
          className="pd-token-suggest"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: 6,
            listStyle: 'none',
            maxHeight: 320,
            overflow: 'auto',
            background: 'var(--pd-bg-elevated)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-md)',
            boxShadow: 'var(--pd-shadow)',
          }}
        >
          {hits.length === 0 ? (
            <li
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--pd-text-faint)',
              }}
            >
              No tokens matched. Paste a full mint address to try exact lookup.
            </li>
          ) : (
            hits.map((row, i) => (
              <li key={row.mint} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(row)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 'var(--pd-radius)',
                    background: i === active ? 'var(--pd-accent-soft)' : 'transparent',
                    color: 'var(--pd-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  {row.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.logoUrl}
                      alt=""
                      width={24}
                      height={24}
                      style={{ borderRadius: 999, objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: 'var(--pd-surface-2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: 'var(--pd-text-faint)',
                      }}
                    >
                      {(row.symbol || '?').slice(0, 2)}
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>
                      {row.symbol || '—'}{' '}
                      <span style={{ fontWeight: 500, color: 'var(--pd-text-dim)' }}>
                        {row.name || ''}
                      </span>
                    </span>
                    <span
                      className="pd-num"
                      style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}
                    >
                      {row.mint.slice(0, 6)}…{row.mint.slice(-6)}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', fontSize: 12 }}>
                    <span className="pd-num" style={{ display: 'block' }}>
                      {row.priceUsd > 0 ? formatUsd(row.priceUsd, row.priceUsd < 1) : '—'}
                    </span>
                    <span className="pd-num" style={{ color: 'var(--pd-text-faint)' }}>
                      {formatPct(row.change24hPct)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
