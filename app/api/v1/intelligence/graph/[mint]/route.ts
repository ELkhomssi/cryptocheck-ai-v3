import { NextResponse } from 'next/server'
import { buildRelationshipGraph } from '@/lib/services/whale/relationship-graph'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  try {
    const graph = await buildRelationshipGraph(params.mint)
    return NextResponse.json(graph)
  } catch (err) {
    console.error('[graph]', err)
    return NextResponse.json({
      nodes: [{ id: params.mint, label: `Token ${params.mint.slice(0, 6)}`, type: 'token', size: 20 }],
      edges: [],
    })
  }
}
