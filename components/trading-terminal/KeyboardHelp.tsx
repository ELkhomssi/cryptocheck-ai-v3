'use client'

const ROWS: Array<{ keys: string; action: string }> = [
  { keys: '⌘K / /', action: 'Focus mint search' },
  { keys: '1 2 4 6', action: 'Chart layout mode' },
  { keys: 'B / S', action: 'Buy / Sell ticket' },
  { keys: 'O', action: 'Override soft coach interrupt' },
  { keys: 'C', action: 'Collapse coach rail body' },
  { keys: '⌘D', action: 'Toggle Discover rail' },
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="tit-panel w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="tit-label">Keyboard map</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
          >
            Esc
          </button>
        </div>
        <table className="w-full text-left text-xs">
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.keys} className="border-b border-white/[0.04]">
                <td className="tit-mono py-1.5 pr-3 text-[var(--tit-ember)]">{r.keys}</td>
                <td className="py-1.5 text-[var(--tit-text-1)]">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
