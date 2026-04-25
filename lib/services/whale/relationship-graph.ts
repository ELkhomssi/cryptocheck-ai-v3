import 'server-only'
import { fetchWhaleFlowForMint } from './fetch-whale-flow'
import { createClient } from '@supabase/supabase-js'

export type GraphNode = {
  id: string
  label: string
  type: 'token' | 'wallet'
  size: number
}

export type GraphEdge = {
  source: string
  target: string
  weight: number
  action: 'bought' | 'sold'
}

/**
 * Build a force-directed graph of wallet-token relationships.
 * Used by react-force-graph-2d in the UI.
 */
export async function buildRelationshipGraph(mint: string): Promise<{
  nodes: GraphNode[]
  edges: GraphEdge[]
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check cache
  const { data: cached } = await supabase
    .from('relationship_graphs')
    .select('*')
    .eq('mint', mint)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) return { nodes: cached.nodes, edges: cached.edges }

  // Build graph from whale flow
  const flow = await fetchWhaleFlowForMint(mint, { limit: 50 })

  const nodes: GraphNode[] = [
    { id: mint, label: `Token ${mint.slice(0, 6)}`, type: 'token', size: 20 },
  ]
  const edges: GraphEdge[] = []
  const walletIds = new Set<string>()

  for (const tx of flow) {
    if (!walletIds.has(tx.walletAddress)) {
      nodes.push({
        id: tx.walletAddress,
        label: `${tx.walletAddress.slice(0, 6)}... [${tx.walletTier}]`,
        type: 'wallet',
        size: Math.min(15, 5 + Math.log10(Math.max(1, tx.amountUsd ?? 1))),
      })
      walletIds.add(tx.walletAddress)
    }
    edges.push({
      source: tx.walletAddress,
      target: mint,
      weight: tx.amountUsd ?? 1,
      action: tx.action,
    })
  }

  // Cache 30 min
  await supabase.from('relationship_graphs').upsert({
    mint,
    nodes,
    edges,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })

  return { nodes, edges }
}
