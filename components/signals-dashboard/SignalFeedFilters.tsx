'use client'

import type { SignalChain, SignalFeedFilter, SourceTag, SubjectType } from '@cryptocheck/signal-contracts'

type Props = {
  filter: SignalFeedFilter
  onChange: (f: SignalFeedFilter) => void
  tier: 'free' | 'premium'
}

const SOURCE_CHIPS: { id: SourceTag | 'all'; label: string; activeClass: string }[] = [
  { id: 'all', label: 'All', activeClass: 'border-rd-green/50 bg-rd-green/15 text-rd-green' },
  {
    id: 'telegram',
    label: 'Telegram',
    activeClass: 'border-sky-400/50 bg-sky-400/15 text-sky-300',
  },
  {
    id: 'txodds',
    label: 'TxODDS',
    activeClass: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  },
]

const SUBJECT_CHIPS: { id: SubjectType | 'all'; label: string; activeClass: string }[] = [
  { id: 'all', label: 'All types', activeClass: 'border-rd-green/50 bg-rd-green/15 text-rd-green' },
  { id: 'token', label: 'Tokens', activeClass: 'border-rd-green/50 bg-rd-green/15 text-rd-green' },
  {
    id: 'match_event',
    label: 'Sports',
    activeClass: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  },
]

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: T
  options: { id: T; label: string; activeClass: string }[]
  onSelect: (id: T) => void
}) {
  return (
    <div className="min-w-0 sm:basis-full">
      <p className="rd-label mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              aria-pressed={active}
              className={`rounded-rd-sm border px-3 py-1.5 font-rd-display text-[0.58rem] font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50 ${
                active
                  ? opt.activeClass
                  : 'border-white/10 bg-rd-navy/60 text-rd-mid hover:border-white/20 hover:text-rd-hi'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SignalFeedFilters({ filter, onChange, tier }: Props) {
  const premiumLocked = tier === 'free'
  const sourceValue = filter.sourceTag ?? 'all'
  const subjectValue = filter.subjectType ?? 'all'
  const showTokenFilters = subjectValue !== 'match_event'

  return (
    <div className="rd-panel flex flex-col gap-3 p-3">
      <ChipGroup
        label="Source"
        value={sourceValue}
        options={SOURCE_CHIPS}
        onSelect={(id) =>
          onChange({
            ...filter,
            sourceTag: id === 'all' ? undefined : id,
          })
        }
      />

      <ChipGroup
        label="Subject"
        value={subjectValue}
        options={SUBJECT_CHIPS}
        onSelect={(id) => {
          const next: SignalFeedFilter = {
            ...filter,
            subjectType: id === 'all' ? undefined : id,
          }
          // Clear token-only filters when viewing sports only
          if (id === 'match_event') {
            next.chain = undefined
            next.minVerdict = undefined
            next.minSourceCount = undefined
          }
          onChange(next)
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[140px] flex-1">
          <label className="rd-label" htmlFor="sig-filter-search">
            Search
          </label>
          <input
            id="sig-filter-search"
            value={filter.search ?? ''}
            onChange={(e) => onChange({ ...filter, search: e.target.value || undefined })}
            placeholder={
              subjectValue === 'match_event'
                ? 'Team, match, market…'
                : subjectValue === 'token'
                  ? 'Symbol or mint…'
                  : 'Symbol, mint, team…'
            }
            className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm text-rd-hi"
          />
        </div>

        {showTokenFilters ? (
          <>
            <div>
              <label className="rd-label" htmlFor="sig-filter-chain">
                Chain
              </label>
              <select
                id="sig-filter-chain"
                value={filter.chain ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    chain: (e.target.value || undefined) as SignalChain | undefined,
                  })
                }
                className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 text-sm text-rd-hi disabled:opacity-50"
                disabled={premiumLocked}
              >
                <option value="">All</option>
                <option value="solana">Solana</option>
                <option value="ethereum">Ethereum</option>
                <option value="base">Base</option>
              </select>
            </div>

            <div>
              <label className="rd-label" htmlFor="sig-filter-verdict">
                Min verdict
              </label>
              <select
                id="sig-filter-verdict"
                value={filter.minVerdict ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    minVerdict: (e.target.value || undefined) as SignalFeedFilter['minVerdict'],
                  })
                }
                className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 text-sm text-rd-hi disabled:opacity-50"
                disabled={premiumLocked}
              >
                <option value="">Any</option>
                <option value="safe">Safe</option>
                <option value="caution">Caution+</option>
                <option value="danger">Danger+</option>
              </select>
            </div>

            <div>
              <label className="rd-label" htmlFor="sig-filter-sources">
                Min sources
              </label>
              <input
                id="sig-filter-sources"
                type="number"
                min={1}
                value={filter.minSourceCount ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    minSourceCount: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="mt-1 w-24 rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm text-rd-hi disabled:opacity-50"
                disabled={premiumLocked}
              />
            </div>
          </>
        ) : null}
      </div>

      {premiumLocked ? (
        <p className="text-xs text-rd-lo">
          Free tier: SAFE tokens · 2+ sources · 90s delay. Source &amp; subject filters are open.
          Upgrade for real-time token filters.
        </p>
      ) : (
        <p className="text-xs text-rd-lo">
          Sports rows are informational only — not swap recommendations.
        </p>
      )}
    </div>
  )
}
