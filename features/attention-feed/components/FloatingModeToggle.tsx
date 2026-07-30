'use client'

import { usePresentationModeStore } from '../stores/presentation-mode'

/**
 * Floating mode switch — lives outside Pro Mode components (no TopBar / LeftRail edits).
 */
export function FloatingModeToggle() {
  const mode = usePresentationModeStore((s) => s.mode)
  const forced = usePresentationModeStore((s) => s.forced)
  const setMode = usePresentationModeStore((s) => s.setMode)

  return (
    <div className="sm-mode-toggle" role="group" aria-label="Presentation mode">
      <button
        type="button"
        className="sm-mode-btn"
        data-active={mode === 'simple'}
        onClick={() => setMode('simple')}
      >
        Simple
      </button>
      <button
        type="button"
        className="sm-mode-btn"
        data-active={mode === 'pro'}
        onClick={() => setMode('pro')}
      >
        Pro
      </button>
      {forced ? <span className="sm-mode-forced">Demo lock</span> : null}
    </div>
  )
}
