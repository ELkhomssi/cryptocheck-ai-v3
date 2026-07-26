'use client'

/**
 * LaunchLab gate (Phase 15.9 deferred).
 * Does not rebuild creation — links to existing /launchLab with honest status.
 */

export function LaunchLabPanel() {
  return (
    <section className="pd-panel" style={{ padding: 20 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>LaunchLab</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)', maxWidth: 560 }}>
        Full OS LaunchLab (create → deploy → liquidity → verification) ships in Phase 15.9 after
        Mission Control / Market / Automation are stable. Safety defaults — renounced mint/freeze
        by default, mandatory disclosure, no fake-backing copy, rate limits — will be enforced
        server-side.
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
        The existing LaunchLab surface remains reachable now:
      </p>
      <a href="/launchLab" className="pd-connect" style={{ display: 'inline-flex' }}>
        Open current LaunchLab
      </a>
    </section>
  )
}
