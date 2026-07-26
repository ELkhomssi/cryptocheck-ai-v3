/**
 * POST /api/agents/custom — create a custom AI Employee (Phase 11 §6).
 * GET  /api/agents/custom — list available data sources for the builder.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createCustomEmployee } from '@/lib/agents/store'
import type { AgentActionType, AgentDataSource } from '@/types/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AVAILABLE_SOURCES: { id: AgentDataSource; label: string }[] = [
  { id: 'jupiter-price', label: 'Jupiter prices' },
  { id: 'birdeye-ohlcv', label: 'Birdeye OHLCV' },
  { id: 'birdeye-token', label: 'Birdeye token metrics' },
  { id: 'birdeye-screener', label: 'Market screener' },
  { id: 'birdeye-new-listings', label: 'New listings' },
  { id: 'raydium-pools', label: 'Raydium pools' },
  { id: 'helius-metadata', label: 'Helius / contract risk' },
  { id: 'portfolio-analytics', label: 'Portfolio analytics' },
  { id: 'portfolio-alerts', label: 'Portfolio alerts' },
  { id: 'news-sentiment', label: 'News / sentiment (when keyed)' },
]

export async function GET() {
  return NextResponse.json({
    dataSources: AVAILABLE_SOURCES,
    actionTypes: [
      { id: 'chat', label: 'Chat' },
      { id: 'report', label: 'Report' },
      { id: 'signals', label: 'Signals' },
      { id: 'analysis', label: 'Analysis' },
      { id: 'optimize', label: 'Optimize' },
    ] satisfies Array<{ id: AgentActionType; label: string }>,
  })
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string
    role?: string
    dataSources?: string[]
    actionType?: string
    instructions?: string
    walletAddress?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const name = body.name?.trim()
  const role = body.role?.trim()
  if (!name || !role) {
    return NextResponse.json({ error: 'name and role required' }, { status: 400 })
  }

  const allowed = new Set(AVAILABLE_SOURCES.map((s) => s.id))
  const dataSources = (body.dataSources ?? []).filter((s): s is AgentDataSource =>
    allowed.has(s as AgentDataSource),
  )
  if (!dataSources.length) {
    return NextResponse.json({ error: 'select at least one data source' }, { status: 400 })
  }

  const actionType = (body.actionType || 'report') as AgentActionType
  const validActions: AgentActionType[] = ['chat', 'report', 'signals', 'analysis', 'optimize']
  if (!validActions.includes(actionType)) {
    return NextResponse.json({ error: 'invalid actionType' }, { status: 400 })
  }

  const employee = await createCustomEmployee({
    name,
    role,
    dataSources,
    actionType,
    instructions: body.instructions?.trim() || '',
    walletAddress: body.walletAddress ?? null,
  })

  if (!employee) {
    return NextResponse.json(
      { error: 'Could not persist custom employee (check Supabase migration).' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    employee: {
      ...employee,
      systemPromptTemplate: '[custom]',
    },
  })
}
