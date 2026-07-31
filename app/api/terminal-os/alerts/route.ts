import { NextRequest, NextResponse } from 'next/server'
import { listAlertRules, upsertAlertRule, listFiredAlerts } from '@/lib/terminal-os/alert-store'
import type { AlertCondition, AlertRule, AlertRuleType, AlertTargetRef } from '@/lib/terminal-os/alert-types'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TYPES = new Set<AlertRuleType>([
  'price',
  'whale_movement',
  'security_flag',
  'ai_signal',
  'portfolio_risk',
])

/** GET /api/terminal-os/alerts?wallet= — rules + fired history */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || (!isValidSolanaMint(wallet) && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }
  const [rules, fired] = await Promise.all([listAlertRules(wallet), listFiredAlerts(wallet)])
  return NextResponse.json({ rules, fired }, { headers: { 'cache-control': 'no-store' } })
}

/** POST /api/terminal-os/alerts — create rule */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  if (!wallet || (!isValidSolanaMint(wallet) && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }
  const type = String(body.type ?? 'price') as AlertRuleType
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  const condition = body.condition as AlertCondition | undefined
  const target = body.target as AlertTargetRef | undefined
  if (!condition?.field || !condition.operator || condition.value == null || !target?.id) {
    return NextResponse.json({ error: 'condition and target required' }, { status: 400 })
  }

  const rule: AlertRule = {
    id: typeof body.id === 'string' && body.id.length > 8 ? body.id : crypto.randomUUID(),
    wallet,
    type,
    condition,
    target: {
      kind: target.kind === 'wallet' ? 'wallet' : 'token',
      id: String(target.id),
      symbol: typeof target.symbol === 'string' ? target.symbol : undefined,
      chain: typeof target.chain === 'string' ? target.chain : undefined,
    },
    active: body.active !== false,
    createdAt: new Date().toISOString(),
  }
  await upsertAlertRule(rule)
  return NextResponse.json({ ok: true, rule }, { headers: { 'cache-control': 'no-store' } })
}
