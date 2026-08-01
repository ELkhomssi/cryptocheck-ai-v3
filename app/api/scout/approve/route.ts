import { NextRequest, NextResponse } from 'next/server'
import { approveScoutArticle } from '@/lib/scout/pipeline'
import { isOperatorUser } from '@/lib/operator/require-operator'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/scout/approve — approval-based publish to blog. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isOperatorUser(user.id, user.email))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { articleId?: string }
  if (!body.articleId) {
    return NextResponse.json({ error: 'articleId_required' }, { status: 400 })
  }

  try {
    const article = await approveScoutArticle(body.articleId)
    if (!article) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, article })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'approve_failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
