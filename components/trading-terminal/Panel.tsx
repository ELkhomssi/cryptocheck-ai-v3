'use client'

import type { ReactNode } from 'react'

type PanelState = 'ready' | 'loading' | 'empty' | 'error'

type Props = {
  title: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  state?: PanelState
  /** Intentional empty copy — never "Unavailable" / "Empty". */
  emptyMessage?: string
  errorMessage?: string
  flat?: boolean
}

/**
 * Shared terminal panel chrome: micro-label title + optional action.
 * Loading / empty / error are first-class — no dead widgets.
 */
export function Panel({
  title,
  action,
  children,
  className = '',
  bodyClassName = '',
  state = 'ready',
  emptyMessage = 'No data yet — awaiting feed.',
  errorMessage,
  flat = true,
}: Props) {
  return (
    <section
      className={`${flat ? 'tit-panel-flat' : 'tit-panel'} flex min-h-0 flex-col overflow-hidden ${className}`}
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[var(--tit-border)] px-2.5">
        <p className="tit-label">{title}</p>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      <div className={`tit-scroll min-h-0 flex-1 overflow-auto ${bodyClassName}`}>
        {state === 'loading' ? (
          <div className="space-y-1.5 p-2.5" aria-busy>
            <div className="tit-skeleton h-3 w-2/3" />
            <div className="tit-skeleton h-3 w-full" />
            <div className="tit-skeleton h-3 w-5/6" />
          </div>
        ) : null}
        {state === 'error' ? (
          <p className="p-2.5 text-[0.7rem] text-[var(--tit-neg)]" role="alert">
            {errorMessage || 'Feed error — retry when ready.'}
          </p>
        ) : null}
        {state === 'empty' ? (
          <p className="p-2.5 text-[0.7rem] text-[var(--tit-text-1)]">{emptyMessage}</p>
        ) : null}
        {state === 'ready' ? children : null}
      </div>
    </section>
  )
}
