import type { BotIntelligenceSnapshot } from '@/lib/bot-protection/intelligence'

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded border border-zinc-800 bg-[#111] p-4">
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{title}</h2>
      {children}
    </section>
  )
}

export function BotIntelligenceView({ snapshot }: { snapshot: BotIntelligenceSnapshot }) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Defense</p>
          <h1 className="font-mono text-lg font-semibold text-zinc-100">Bot Intelligence</h1>
          <p className="mt-1 max-w-xl font-mono text-[11px] text-zinc-500">
            Edge bot scores, progressive defense outcomes, and attacker aggregates. Search engines are never
            challenged.
          </p>
        </div>
        <div className="font-mono text-[11px] text-zinc-500">
          {snapshot.sample ? (
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
              sample
            </span>
          ) : (
            <span>as of {snapshot.generatedAt.slice(0, 19)}Z</span>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Blocked / challenged">
          <p className="font-mono text-2xl text-zinc-100">{snapshot.blockedTotal}</p>
        </Panel>
        <Panel title="Log sample size">
          <p className="font-mono text-2xl text-zinc-100">{snapshot.requestsSample.length}</p>
        </Panel>
        <Panel title="Score buckets">
          <p className="font-mono text-2xl text-zinc-100">{snapshot.scoreDistribution.length}</p>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Top attacking IPs">
          <ul className="space-y-1 font-mono text-[11px]">
            {snapshot.topIps.length === 0 ? (
              <li className="text-zinc-600">No events yet</li>
            ) : (
              snapshot.topIps.map((row) => (
                <li key={row.ip} className="flex justify-between gap-2 text-zinc-300">
                  <span className="truncate">{row.ip}</span>
                  <span className="text-zinc-500">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </Panel>
        <Panel title="Top ASNs">
          <ul className="space-y-1 font-mono text-[11px]">
            {snapshot.topAsns.length === 0 ? (
              <li className="text-zinc-600">No events yet</li>
            ) : (
              snapshot.topAsns.map((row) => (
                <li key={row.asn} className="flex justify-between gap-2 text-zinc-300">
                  <span className="truncate">{row.asn}</span>
                  <span className="text-zinc-500">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </Panel>
        <Panel title="Countries">
          <ul className="space-y-1 font-mono text-[11px]">
            {snapshot.topCountries.length === 0 ? (
              <li className="text-zinc-600">No events yet</li>
            ) : (
              snapshot.topCountries.map((row) => (
                <li key={row.country} className="flex justify-between gap-2 text-zinc-300">
                  <span>{row.country}</span>
                  <span className="text-zinc-500">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Bot score distribution">
        <ul className="grid gap-1 sm:grid-cols-2 font-mono text-[11px]">
          {snapshot.scoreDistribution.length === 0 ? (
            <li className="text-zinc-600">No events yet</li>
          ) : (
            snapshot.scoreDistribution.map((row) => (
              <li key={row.bucket} className="flex justify-between text-zinc-300">
                <span>{row.bucket}</span>
                <span className="text-zinc-500">{row.count}</span>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Recent block / challenge history">
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[10px] text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">IP</th>
                <th className="py-1 pr-2">Score</th>
                <th className="py-1 pr-2">Decision</th>
                <th className="py-1 pr-2">Reason</th>
                <th className="py-1">Path</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.requestsSample.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-zinc-600">
                    No blocked requests logged yet
                  </td>
                </tr>
              ) : (
                snapshot.requestsSample.map((e, i) => (
                  <tr key={`${e.timestamp}-${i}`} className="border-b border-zinc-900/80">
                    <td className="py-1 pr-2 whitespace-nowrap">{e.timestamp?.slice(0, 19)}</td>
                    <td className="py-1 pr-2">{e.ip ?? '—'}</td>
                    <td className="py-1 pr-2">{e.botScore}</td>
                    <td className="py-1 pr-2">{e.decision}</td>
                    <td className="py-1 pr-2 max-w-[12rem] truncate">{e.reason}</td>
                    <td className="py-1 max-w-[12rem] truncate">{e.path}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
