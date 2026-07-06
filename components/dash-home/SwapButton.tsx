import { Zap } from 'lucide-react'

export type SwapButtonProps = {
  onClick: () => void
  disabled?: boolean
  title?: string
}

export function SwapButton({ onClick, disabled, title }: SwapButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 rounded-dash-chip bg-dash-green px-3 py-1.5 text-xs font-bold text-dash-bg transition-colors duration-150 hover:bg-dash-greenHi disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
    >
      <Zap className="h-3 w-3" />
      Swap
    </button>
  )
}
