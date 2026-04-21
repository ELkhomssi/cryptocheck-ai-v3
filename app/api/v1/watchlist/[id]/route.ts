import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const params = await context.params
    const id = typeof params.id === 'string' ? params.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Watchlist item id required' }, { status: 400 })

    const sb = getSupabaseAdmin()
    const { error } = await sb.from('watchlist').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[watchlist:delete] Error:', err)
    return NextResponse.json({ error: 'Failed to remove watchlist item' }, { status: 500 })
  }
}
