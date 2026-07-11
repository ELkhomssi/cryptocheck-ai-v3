'use client'

import type { SourceTag, UnifiedSignal, UnifiedVerdict } from '@cryptocheck/signal-contracts'

export function truncateCa(ca: string): string {
  if (ca.length <= 12) return ca
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`
}

export function formatAge(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

export function verdictClasses(v: UnifiedVerdict): string {
  if (v === 'safe') return 'border-rd-safe/50 bg-rd-safe/10 text-rd-safe'
  if (v === 'caution') return 'border-rd-caution/50 bg-rd-caution/10 text-rd-caution'
  if (v === 'danger') return 'border-rd-danger/50 bg-rd-danger/10 text-rd-danger'
  if (v === 'n/a') return 'border-white/15 bg-white/[0.04] text-rd-mid'
  return 'border-white/20 bg-white/5 text-rd-mid motion-safe:animate-pulse'
}

export function eventTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').toUpperCase()
}

export function sourceTagLabel(tag: SourceTag | string): string {
  if (tag === 'telegram') return 'Telegram'
  if (tag === 'txodds') return 'TxODDS'
  return String(tag)
}

export function sourceBadgeClasses(tag: SourceTag | string): string {
  if (tag === 'telegram') return 'border-sky-400/40 bg-sky-400/10 text-sky-300'
  if (tag === 'txodds') return 'border-amber-400/40 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/5 text-rd-lo'
}

export function sourcesLabel(signal: UnifiedSignal): string {
  if (signal.sourceTag === 'txodds') return 'TxODDS'
  if ((signal.sourceCount ?? 0) <= 1) return signal.sources?.[0] ?? sourceTagLabel(signal.sourceTag)
  return `${signal.sourceCount} ch`
}

/** Swap only for actionable token signals — never match_event. */
export function canSwapSignal(signal: UnifiedSignal): boolean {
  return (
    signal.subjectType === 'token' &&
    signal.chain === 'solana' &&
    Boolean(signal.contractAddress) &&
    !signal.dropped &&
    !signal.sample &&
    signal.verdict !== 'scanning'
  )
}

/** Client-side filter for instant chip UX (server still enforces). */
export function matchesFeedFilter(signal: UnifiedSignal, filter: {
  sourceTag?: SourceTag | 'all'
  subjectType?: 'token' | 'match_event' | 'all'
  search?: string
}): boolean {
  if (signal.dropped || signal.sample) return false
  if (filter.sourceTag && filter.sourceTag !== 'all' && signal.sourceTag !== filter.sourceTag) {
    return false
  }
  if (
    filter.subjectType &&
    filter.subjectType !== 'all' &&
    signal.subjectType !== filter.subjectType
  ) {
    return false
  }
  if (filter.search) {
    const hay = [
      signal.label,
      signal.tokenSymbol,
      signal.contractAddress,
      signal.matchId,
      signal.teams?.home,
      signal.teams?.away,
      signal.market,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!hay.includes(filter.search.toLowerCase())) return false
  }
  return true
}
