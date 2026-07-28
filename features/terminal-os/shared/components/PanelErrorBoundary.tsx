'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

interface State {
  error: string | null
}

/** Per-panel error boundary — one crash must not take down the terminal */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(err: Error): State {
    return { error: err.message || 'Panel failed' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[terminal-os] ${this.props.title}`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="tos-panel">
          <div className="tos-error">
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--tos-text-primary)' }}>
              {this.props.title} unavailable
            </div>
            <p style={{ marginBottom: 12 }}>{this.state.error}</p>
            <button
              type="button"
              className="tos-btn tos-btn-ghost"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
