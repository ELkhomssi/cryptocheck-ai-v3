import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const params = await context.params
    const id = typeof params.id === 'string' ? params.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Watchlist item id required' }, { status: 400 })

    const sb = getSupabaseAdmin()
    const { error } = await sb.from('watchlist').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[watchlist:delete] Error:', err)
    return NextResponse.json({ error: 'Failed to remove watchlist item' }, { status: 500 })
  }
}

/**
 * PATCH /api/v1/watchlist/:id
 * Body: { is_favorite?: boolean, sort_order?: number }
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const params = await context.params
    const id = typeof params.id === 'string' ? params.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Watchlist item id required' }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as {
      is_favorite?: unknown
      sort_order?: unknown
    }

    const patch: { is_favorite?: boolean; sort_order?: number } = {}
    if (typeof body.is_favorite === 'boolean') patch.is_favorite = body.is_favorite
    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      patch.sort_order = Math.floor(body.sort_order)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Provide is_favorite and/or sort_order' },
        { status: 400 },
      )
    }

    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('watchlist')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select(
        'id, mint, symbol, name, last_risk_score, last_verdict, last_scanned_at, created_at, is_favorite, sort_order',
      )
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ item: data })
  } catch (err) {
    console.error('[watchlist:patch] Error:', err)
    return NextResponse.json({ error: 'Failed to update watchlist item' }, { status: 500 })
  }
}
