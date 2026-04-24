'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { GlassCard } from '../shared/GlassCard'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type GraphData = {
  nodes: Array<{ id: string; label: string; type: 'token' | 'wallet'; size: number }>
  edges: Array<{ source: string; target: string; weight: number; action: 'bought' | 'sold' }>
}

export function RelationshipGraphPanel({ mint }: { mint: string }) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] })

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch(`/api/v1/intelligence/graph/${mint}`, { cache: 'no-store' })
        const json = (await res.json()) as GraphData
        if (active && json?.nodes && json?.edges) setGraph(json)
      } catch {
        if (active) setGraph({ nodes: [{ id: mint, label: mint.slice(0, 6), type: 'token', size: 20 }], edges: [] })
      }
    }
    if (mint?.length >= 32) void load()
    return () => {
      active = false
    }
  }, [mint])

  return (
    <GlassCard title="Relationship Graph">
      <div className="h-56">
        <ForceGraph2D
          graphData={{ nodes: graph.nodes, links: graph.edges }}
          nodeLabel={(n) => (n as { label: string }).label}
          nodeAutoColorBy="type"
          nodeVal={(n) => (n as { size: number }).size}
          linkColor={(l) => ((l as { action: string }).action === 'bought' ? '#00D4AA' : '#F59E0B')}
          backgroundColor="#0B1220"
        />
      </div>
    </GlassCard>
  )
}
