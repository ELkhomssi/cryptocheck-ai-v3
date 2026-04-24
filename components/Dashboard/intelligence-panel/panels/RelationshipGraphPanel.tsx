'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type GraphNode = { id: string; label: string; type: 'token' | 'wallet'; size: number }
type GraphEdge = { source: string; target: string; weight: number; action: 'bought' | 'sold' }
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

function drawGlowingNode(
  node: GraphNode & { x?: number; y?: number },
  ctx: CanvasRenderingContext2D,
  _globalScale: number
) {
  const { x, y } = node
  if (x == null || y == null) return
  const base = Math.max(5, Math.sqrt(node.size || 4) * 2.4)
  const isToken = node.type === 'token'
  const core = isToken ? '#22d3ee' : '#e879f9'
  const outer = isToken ? 'rgba(34,211,238,0.35)' : 'rgba(232,121,249,0.35)'

  ctx.beginPath()
  ctx.arc(x, y, base + 10, 0, 2 * Math.PI)
  ctx.fillStyle = outer
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, base + 4, 0, 2 * Math.PI)
  ctx.strokeStyle = isToken ? 'rgba(16,185,129,0.5)' : 'rgba(244,114,182,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, base, 0, 2 * Math.PI)
  const g = ctx.createRadialGradient(x - base * 0.3, y - base * 0.3, 0, x, y, base)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.35, core)
  g.addColorStop(1, isToken ? '#065f46' : '#701a75')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 1.25
  ctx.stroke()

  const label = (node.label || '').slice(0, 14)
  if (label) {
    ctx.font = '600 10px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(226,232,240,0.95)'
    ctx.fillText(label, x, y + base + 4)
  }
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
        if (active) setGraph({ nodes: [{ id: mint, label: mint.slice(0, 6), type: 'token', size: 22 }], edges: [] })
      }
    }
    if (mint?.length >= 32) void load()
    return () => {
      active = false
    }
  }, [mint])

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawGlowingNode(node as GraphNode, ctx, globalScale)
    },
    []
  )

  const nodePointerAreaPaint = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode & { x?: number; y?: number }
      const { x, y } = n
      if (x == null || y == null) return
      const base = Math.max(5, Math.sqrt(n.size || 4) * 2.4)
      ctx.beginPath()
      ctx.arc(x, y, base + 8, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    },
    []
  )

  return (
    <NeonForensicPanel title="Relationship Graph" badge="Force layout" tone="neutral">
      <div className="h-64 overflow-hidden rounded-xl border border-white/[0.06] bg-[#020617] shadow-[inset_0_0_40px_rgba(34,211,238,0.06)]">
        <ForceGraph2D
          graphData={{ nodes: graph.nodes, links: graph.edges }}
          nodeLabel={(n) => (n as GraphNode).label}
          nodeVal={(n) => (n as GraphNode).size}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkColor={(l) => ((l as GraphEdge).action === 'bought' ? '#34d399' : '#fb923c')}
          linkWidth={(l) => Math.max(0.6, Math.min(3, (l as GraphEdge).weight ?? 1))}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={() => 0.006}
          linkDirectionalParticleColor={(l) => ((l as GraphEdge).action === 'bought' ? '#6ee7b7' : '#fdba74')}
          backgroundColor="#020617"
          cooldownTicks={120}
          d3VelocityDecay={0.35}
        />
      </div>
      <p className="mt-3 text-sm text-slate-500">
        <span className="font-mono-terminal text-cyan-400/80">Cyan</span> — token hub ·{' '}
        <span className="font-mono-terminal text-fuchsia-400/80">Fuchsia</span> — wallets · Edges show flow direction.
      </p>
    </NeonForensicPanel>
  )
}
