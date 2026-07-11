'use client'

import type { ReactNode } from 'react'
import type { FeedLoadState } from '@/lib/signals-dashboard/feed-load-state'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type FeedSectionStateProps = {
  state: FeedLoadState
  errorMessage?: string
  onRetry?: () => void
  /** Shown when state is `empty` (successful fetch, zero rows). */
  emptyMessage: string
  loadingSkeleton: ReactNode
  children: ReactNode
}

export function FeedSectionState({
  state,
  errorMessage,
  onRetry,
  emptyMessage,
  loadingSkeleton,
  children,
}: FeedSectionStateProps) {
  if (state === 'loading') {
    return <>{loadingSkeleton}</>
  }

  if (state === 'error') {
    return (
      <div className="rounded-dash-inner border border-dash-red/40 bg-dash-red/5 px-4 py-5 text-center">
        <div className="mx-auto flex max-w-md flex-col items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-dash-red" aria-hidden />
          <p className="text-sm font-medium text-dash-thi">Feed unavailable</p>
          <p className="text-xs text-dash-tmid">
            {errorMessage ?? 'Could not reach the signal history API. This is not the same as an empty feed.'}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 inline-flex items-center gap-1.5 rounded-dash-chip border border-dash-innerline px-3 py-1.5 text-xs font-medium text-dash-thi transition-colors hover:bg-dash-panel2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-6 text-center">
        <p className="text-xs text-dash-tlo">{emptyMessage}</p>
      </div>
    )
  }

  return <>{children}</>
}
