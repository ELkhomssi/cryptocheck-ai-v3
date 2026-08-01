import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CreditCard,
  KeyRound,
  Layers,
  LayoutDashboard,
  Radar,
  Rocket,
  Scale,
  Scan,
  Shield,
  ShieldAlert,
  Webhook,
  Wallet,
  Activity,
} from 'lucide-react'

export type OperatorNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/** Operator console — denser ops IA (not customer-facing). */
export const OPERATOR_NAV: OperatorNavItem[] = [
  { href: '/operator', label: 'Console', icon: LayoutDashboard },
  { href: '/operator/credentials', label: 'Credentials', icon: KeyRound },
  { href: '/operator/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/operator/compliance', label: 'Compliance', icon: Scale },
  { href: '/operator/usage', label: 'Intelligence Ops', icon: BarChart3 },
  { href: '/operator/security', label: 'Sentinel', icon: Shield },
  { href: '/operator/bot-intelligence', label: 'Bot Intelligence', icon: ShieldAlert },
  { href: '/operator/batch', label: 'Batch Scan', icon: Layers },
  { href: '/operator/analysis', label: 'Analysis Console', icon: Scan },
  { href: '/operator/terminal', label: 'Dashboard Pro', icon: Radar },
  { href: '/operator/fees', label: 'Fee / Platform', icon: Wallet },
  { href: '/operator/launch', label: 'Launch Ops', icon: Rocket },
  { href: '/operator/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/operator/diagnostics', label: 'Diagnostics', icon: Activity },
]
