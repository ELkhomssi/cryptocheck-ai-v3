import type {
  SignalChain,
  SignalFeedFilter,
  SourceTag,
  SubjectType,
  UnifiedSignal,
  UnifiedVerdict,
} from '@cryptocheck/signal-contracts'

const VERDICT_RANK: Record<UnifiedVerdict, number> = {
  scanning: 0,
  'n/a': 0,
  safe: 1,
  caution: 2,
  danger: 3,
}

export function parseSignalFeedFilter(raw: unknown): SignalFeedFilter {
  if (!raw || typeof raw !== 'object') return {}
  const f = raw as Record<string, unknown>
  const filter: SignalFeedFilter = {}
  if (
    f.chain === 'solana' ||
    f.chain === 'ethereum' ||
    f.chain === 'base' ||
    f.chain === 'bsc' ||
    f.chain === 'arbitrum'
  ) {
    filter.chain = f.chain
  }
  if (f.minVerdict === 'safe' || f.minVerdict === 'caution' || f.minVerdict === 'danger') {
    filter.minVerdict = f.minVerdict
  }
  if (typeof f.minSourceCount === 'number' && f.minSourceCount > 0) {
    filter.minSourceCount = Math.floor(f.minSourceCount)
  }
  if (typeof f.minLiquidityUsd === 'number' && f.minLiquidityUsd > 0) {
    filter.minLiquidityUsd = f.minLiquidityUsd
  }
  if (typeof f.search === 'string' && f.search.trim()) {
    filter.search = f.search.trim().toLowerCase()
  }
  if (f.sourceTag === 'telegram' || f.sourceTag === 'txodds' || f.sourceTag === 'all') {
    filter.sourceTag = f.sourceTag
  }
  if (f.subjectType === 'token' || f.subjectType === 'match_event') {
    filter.subjectType = f.subjectType
  }
  return filter
}

export function parseSignalFeedFilterFromSearch(params: URLSearchParams): SignalFeedFilter {
  return parseSignalFeedFilter({
    chain: params.get('chain') ?? undefined,
    minVerdict: params.get('minVerdict') ?? undefined,
    minSourceCount: params.get('minSourceCount') ? Number(params.get('minSourceCount')) : undefined,
    search: params.get('search') ?? undefined,
    sourceTag: params.get('sourceTag') ?? undefined,
    subjectType: params.get('subjectType') ?? undefined,
  })
}

export function effectiveSignalFeedFilter(
  tier: 'free' | 'premium',
  requested: SignalFeedFilter,
): SignalFeedFilter {
  if (tier === 'premium') return requested
  // Bootstrap default: 1 source is enough until multi-channel overlap is common.
  // Raise back to 2 via SIGNAL_FREE_MIN_SOURCE_COUNT=2 when feed is healthy.
  // Note: this env is read by the Next.js history API (Vercel), not the droplet gate.
  const freeMinSources = Math.max(1, Number(process.env.SIGNAL_FREE_MIN_SOURCE_COUNT ?? 1) || 1)
  return {
    ...requested,
    // VERDICT_RANK: safe=1 < caution=2 < danger=3 — minVerdict means "rank ≥ X"
    // (exclude scanning). 'safe' keeps safe+caution+danger. 'caution' would DROP safe.
    minVerdict: requested.minVerdict ?? 'safe',
    minSourceCount: Math.max(requested.minSourceCount ?? 0, freeMinSources),
  }
}

export function rowToUnifiedSignal(row: Record<string, unknown>): UnifiedSignal {
  const sourceTag = (row.source_tag as SourceTag | undefined) ?? 'telegram'
  const sourceRef =
    row.source_ref != null ? String(row.source_ref) : String(row.source_message_id ?? row.id)
  const subjectType = (row.subject_type as SubjectType | undefined) ?? 'token'
  const sources = Array.isArray(row.sources)
    ? (row.sources as string[])
    : [String(row.source_channel ?? sourceTag)]

  const signal: UnifiedSignal = {
    id: String(row.id),
    sourceTag,
    sourceRef,
    subjectType,
    label: String(row.label ?? row.token_symbol ?? '—'),
    type: String(row.event_type ?? row.signal_type ?? 'mention'),
    value: row.price != null ? Number(row.price) : undefined,
    msgTimestamp: String(row.msg_timestamp),
    ingestTimestamp: String(row.ingest_timestamp),
    confidence: Number(row.confidence ?? 1),
    verdict: (row.sentinel_verdict as UnifiedSignal['verdict']) ?? 'scanning',
    scoreValue:
      row.score_value != null
        ? Number(row.score_value)
        : row.neural_score != null
          ? Number(row.neural_score)
          : undefined,
    rawPayload:
      row.raw_payload && typeof row.raw_payload === 'object'
        ? (row.raw_payload as Record<string, unknown>)
        : {
            text: row.raw_text,
            parseMethod: row.parse_method,
            channel: row.source_channel,
          },
    sources,
    sourceCount: Number(row.source_count ?? sources.length),
    sample: row.sample === true,
    dropped: row.dropped === true,
    dropReason: row.drop_reason != null ? String(row.drop_reason) : undefined,
  }

  if (subjectType === 'token') {
    signal.chain = row.chain != null ? (row.chain as SignalChain) : undefined
    signal.contractAddress = row.contract_address != null ? String(row.contract_address) : undefined
    signal.tokenSymbol = row.token_symbol != null ? String(row.token_symbol) : signal.label
  } else {
    signal.matchId = row.match_id != null ? String(row.match_id) : undefined
    signal.teams =
      row.teams && typeof row.teams === 'object'
        ? (row.teams as UnifiedSignal['teams'])
        : undefined
    signal.score =
      row.score && typeof row.score === 'object'
        ? (row.score as UnifiedSignal['score'])
        : undefined
    signal.market = row.market != null ? String(row.market) : undefined
  }

  return signal
}

export function filterUnifiedSignals(
  rows: UnifiedSignal[],
  filter: SignalFeedFilter,
): UnifiedSignal[] {
  return rows.filter((signal) => {
    if (signal.dropped || signal.sample) return false

    if (filter.sourceTag && filter.sourceTag !== 'all' && signal.sourceTag !== filter.sourceTag) {
      return false
    }
    if (filter.subjectType && signal.subjectType !== filter.subjectType) return false
    if (filter.chain && signal.subjectType === 'token' && signal.chain !== filter.chain) {
      return false
    }

    if (signal.subjectType === 'token') {
      if (filter.minSourceCount && (signal.sourceCount ?? 0) < filter.minSourceCount) {
        return false
      }
      if (filter.minVerdict) {
        if (VERDICT_RANK[signal.verdict] < VERDICT_RANK[filter.minVerdict]) return false
      }
      if (filter.minLiquidityUsd && signal.verdict === 'scanning') return false
    }

    if (filter.search) {
      const hay = [
        signal.label,
        signal.tokenSymbol,
        signal.contractAddress,
        signal.matchId,
        signal.teams?.home,
        signal.teams?.away,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(filter.search)) return false
    }

    return true
  })
}
