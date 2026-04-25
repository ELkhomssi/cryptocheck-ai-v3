import WatchlistPanel from '@/components/watchlist/WatchlistPanel'

export const dynamic = 'force-dynamic'

export default function DashboardWatchlistPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">PRO Surface</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Watchlist alerts</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Curate tokens to monitor and receive risk movement alerts across your portfolio.
        </p>
      </header>
      <WatchlistPanel audience="dashboard" />
    </div>
  )
}
