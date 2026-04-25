import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { intelCacheGetJson, intelCacheSetJson } from '@/lib/cache/intel-cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LINK_TTL_SECONDS = 15 * 60

type LinkCodePayload = {
  userId: string
  createdAt: string
  expiresAt: string
  used: boolean
}

function linkCodeKey(code: string): string {
  return `alerts:tg-link:${code}`
}

function makeCode(): string {
  return `cc_link_${randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('alert_preferences')
    .select('telegram_chat_id, telegram_linked_at, telegram_alerts_enabled, email_alerts_enabled, min_risk_change')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'Could not load alert preferences' }, { status: 500 })
  }

  return NextResponse.json({
    linked: Boolean(data?.telegram_chat_id),
    preferences: data ?? {
      telegram_chat_id: null,
      telegram_linked_at: null,
      telegram_alerts_enabled: false,
      email_alerts_enabled: true,
      min_risk_change: 10,
    },
  })
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const code = makeCode()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + LINK_TTL_SECONDS * 1000)
  const payload: LinkCodePayload = {
    userId: user.id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    used: false,
  }
  await intelCacheSetJson(linkCodeKey(code), payload, LINK_TTL_SECONDS)

  return NextResponse.json({
    code,
    expiresAt: payload.expiresAt,
    instructions: `Open @CryptoCheck_AI and send: /link ${code}`,
  })
}

/**
 * Bot callback endpoint (for the external Telegram bot backend).
 * POST body: { code: string, chatId: string }
 * Header: Authorization: Bearer ${TELEGRAM_LINK_SECRET}
 */
export async function PUT(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.TELEGRAM_LINK_SECRET?.trim()
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string; chatId?: string }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : ''
  if (!code || !chatId) {
    return NextResponse.json({ error: 'code and chatId are required' }, { status: 400 })
  }

  const key = linkCodeKey(code)
  const payload = await intelCacheGetJson<LinkCodePayload>(key)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 })
  }
  if (payload.used) {
    return NextResponse.json({ error: 'Code already used' }, { status: 409 })
  }
  if (Date.parse(payload.expiresAt) < Date.now()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 410 })
  }

  const sb = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await sb.from('alert_preferences').upsert(
    {
      user_id: payload.userId,
      telegram_chat_id: chatId,
      telegram_linked_at: now,
      telegram_alerts_enabled: true,
    },
    { onConflict: 'user_id' }
  )
  if (error) {
    return NextResponse.json({ error: 'Could not save Telegram link' }, { status: 500 })
  }

  await intelCacheSetJson(key, { ...payload, used: true }, 60)
  return NextResponse.json({ ok: true, linkedUserId: payload.userId })
}
