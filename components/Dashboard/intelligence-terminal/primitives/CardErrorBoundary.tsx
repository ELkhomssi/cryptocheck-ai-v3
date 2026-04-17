'use client'

/**
 * CardErrorBoundary — Phase 4D
 *
 * Wraps a single report card so one bad render (e.g. malformed
 * payload) doesn't blow up the whole grid.
 *
 * React still requires a class component for error boundaries.
 * On error: shows a minimal fallback card and logs to console.
 */

import { AlertOctagon } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from './Card'

type Props = { children: ReactNode; label?: string }
type State = { hasError: boolean }

export class CardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console-only — never surface raw errors to users.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        `[IntelligenceTerminal] Card "${this.props.label ?? 'unknown'}" crashed:`,
        error,
        info.componentStack
      )
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <Card accent="danger" className="p-5">
        <div className="flex items-start gap-3">
          <AlertOctagon
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
            aria-hidden
          />
          <div>
            <div className="font-mono-terminal text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300">
              Card Error
            </div>
            <p className="mt-1 text-xs text-slate-400">
              This panel failed to render. The rest of the report is still
              available.
            </p>
          </div>
        </div>
      </Card>
    )
  }
}
