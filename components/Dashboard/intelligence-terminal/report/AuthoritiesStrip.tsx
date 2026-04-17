'use client'

/**
 * AuthoritiesStrip — Phase 4C (v2 only)
 *
 * Three status pills: Mint / Freeze / Update authority. Green +
 * check when renounced; amber + warn icon when still held; slate
 * + dash when unknown.
 */

import { AlertTriangle, Check, HelpCircle } from 'lucide-react'
import type {
  AuthorityField,
  TokenIntelligenceReport,
} from '@/lib/types/intelligence'
import { Card } from '../primitives/Card'

type AuthorityState = 'renounced' | 'held' | 'unknown'

function stateFor(f: AuthorityField | null | undefined): AuthorityState {
  if (f == null) return 'unknown'
  if (f.renounced) return 'renounced'
  return 'held'
}

const STATE_STYLES: Record<
  AuthorityState,
  { pill: string; label: string; icon: typeof Check }
> = {
  renounced: {
    pill: 'border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#00d4aa]',
    label: 'Renounced',
    icon: Check,
  },
  held: {
    pill: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    label: 'Active',
    icon: AlertTriangle,
  },
  unknown: {
    pill: 'border-white/10 bg-white/5 text-slate-400',
    label: 'Unknown',
    icon: HelpCircle,
  },
}

function AuthorityPill({
  name,
  state,
}: {
  name: string
  state: AuthorityState
}) {
  const style = STATE_STYLES[state]
  const Icon = style.icon
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 ${style.pill}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">
          {name}
        </div>
        <div className="font-mono text-xs font-semibold">{style.label}</div>
      </div>
    </div>
  )
}

export function AuthoritiesStrip({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  return (
    <Card className="px-5 py-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Authorities
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <AuthorityPill name="Mint" state={stateFor(report.mintAuthority)} />
        <AuthorityPill name="Freeze" state={stateFor(report.freezeAuthority)} />
        <AuthorityPill
          name="Update"
          state={stateFor(report.updateAuthority)}
        />
      </div>
    </Card>
  )
}
