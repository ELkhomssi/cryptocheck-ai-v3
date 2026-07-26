'use client'

/**
 * Phase 16.3 / 16.9 — Intelligence Modules grid on Mission Control.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { IntelligenceModuleId, ModuleCardView } from '@/types/intelligence'
import { IntelligenceModuleCard } from './IntelligenceModuleCard'
import { ModuleDetailPanel } from './ModuleDetailPanel'
import { SystemStatusStrip } from './SystemStatusStrip'

type ModulesPayload = {
  modules: ModuleCardView[]
  overallHealth: { score: number | null; calibrating: boolean }
}

export function IntelligenceModulesGrid() {
  const [openId, setOpenId] = useState<IntelligenceModuleId | null>(null)

  const modulesQ = useQuery({
    queryKey: ['intelligence-modules'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/modules', { cache: 'no-store' })
      if (!res.ok) throw new Error('Modules unavailable')
      return (await res.json()) as ModulesPayload
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  if (openId) {
    return <ModuleDetailPanel moduleId={openId} onBack={() => setOpenId(null)} />
  }

  const modules = modulesQ.data?.modules ?? []
  const overall = modulesQ.data?.overallHealth ?? { score: null, calibrating: true }

  return (
    <div>
      <SystemStatusStrip
        modules={modules}
        overallHealth={overall}
        loading={modulesQ.isLoading}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, letterSpacing: '0.04em' }}>Intelligence Modules</h2>
        <span style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>
          Scores stay Calibrating until real thresholds are met
        </span>
      </div>

      {modulesQ.isError ? (
        <p style={{ fontSize: 13, color: 'var(--pd-negative)' }}>
          {(modulesQ.error as Error).message || 'Failed to load modules'}
        </p>
      ) : null}

      {modulesQ.isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pd-skeleton" style={{ height: 140 }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {modules.map((m) => (
            <IntelligenceModuleCard key={m.id} module={m} onOpen={setOpenId} />
          ))}
        </div>
      )}
    </div>
  )
}
