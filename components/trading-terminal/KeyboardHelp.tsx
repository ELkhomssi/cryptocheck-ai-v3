'use client'

const ROWS: Array<{ keys: string; action: string }> = [
  { keys: '⌘K / /', action: 'Focus mint search' },
  { keys: 'Intel rail', action: 'Market Intelligence center' },
  { keys: 'Charts rail', action: 'Primary chart desk' },
  { keys: 'B / S', action: 'Buy / Sell ticket' },
  { keys: 'O', action: 'Override soft coach interrupt' },
  { keys: 'W', action: 'Cycle watchlist' },
  { keys: 'P', action: 'Toggle positions drawer' },
  { keys: '↑ ↓ ↵', action: 'Navigate Discover · load' },
  { keys: 'T / R / V / H / M', action: 'Track / Brief / Verdict / Behavior / Marks' },
  { keys: '?', action: 'Toggle this help' },
  { keys: 'Esc', action: 'Close help / positions' },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function KeyboardHelp({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="tit-panel w-full max-w-md overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-4 py-3">
          <div>
            <p className="tit-display text-[0.9rem] font-semibold">Keyboard map</p>
            <p className="tit-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--tit-text-2)]">
              Desk shortcuts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tit-btn-ghost px-2 py-1 text-[0.7rem] text-[var(--tit-text-2)]"
          >
            Esc
          </button>
        </div>
        <table className="w-full text-left text-[0.78rem]">
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.keys} className="border-b border-[var(--tit-border-subtle)]">
                <td className="tit-mono px-4 py-2.5 pr-3 text-[var(--tit-accent-bright)]">
                  {r.keys}
                </td>
                <td className="px-4 py-2.5 text-[var(--tit-text-1)]">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
