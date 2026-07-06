import type { LucideIcon } from 'lucide-react'

export type SectionHeaderProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  titleClassName?: string
  action?: React.ReactNode
}

export function SectionHeader({ icon: Icon, title, subtitle, titleClassName = 'text-dash-green', action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-dash-green" strokeWidth={2} />
        <div>
          <p className={`text-[13px] font-semibold ${titleClassName}`}>{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-dash-tmid">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}
