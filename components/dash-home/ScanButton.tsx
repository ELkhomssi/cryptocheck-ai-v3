import { SlidersHorizontal } from 'lucide-react'

export type ScanButtonProps = {
  onClick: () => void
  disabled?: boolean
}

export function ScanButton({ onClick, disabled }: ScanButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-dash-chip border border-dash-hairline px-3 py-1.5 text-xs font-medium text-dash-tmid transition-colors duration-150 hover:border-white/20 hover:bg-dash-panel2 hover:text-dash-thi disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
    >
      <SlidersHorizontal className="h-3 w-3" />
      Scan
    </button>
  )
}
