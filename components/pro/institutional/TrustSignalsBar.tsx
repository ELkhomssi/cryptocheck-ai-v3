type Props = {
  rpcProvider: string
  lastUpdated: string
  cache?: string
  pipelineMs?: number
  responseTimeMs?: number
}

export function TrustSignalsBar({ rpcProvider, lastUpdated, cache, pipelineMs, responseTimeMs }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 18px',
        alignItems: 'center',
        padding: '12px 16px',
        borderRadius: 12,
        border: '0.5px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.35)',
        fontSize: 11,
        color: '#94a3b8',
      }}
    >
      <span>
        <span style={{ color: '#64748b' }}>RPC </span>
        <span style={{ color: '#cbd5e1', fontFamily: 'ui-monospace, monospace' }}>{rpcProvider}</span>
      </span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        <span style={{ color: '#64748b' }}>Updated </span>
        <time dateTime={lastUpdated} style={{ color: '#e2e8f0' }}>
          {lastUpdated}
        </time>
      </span>
      {cache ? (
        <>
          <span style={{ opacity: 0.35 }}>|</span>
          <span>
            Cache <span style={{ color: cache === 'hit' ? '#34d399' : '#fbbf24' }}>{cache.toUpperCase()}</span>
          </span>
        </>
      ) : null}
      {pipelineMs != null ? (
        <>
          <span style={{ opacity: 0.35 }}>|</span>
          <span>Pipeline {pipelineMs}ms</span>
        </>
      ) : null}
      {responseTimeMs != null ? (
        <>
          <span style={{ opacity: 0.35 }}>|</span>
          <span>API {responseTimeMs}ms</span>
        </>
      ) : null}
    </div>
  )
}
