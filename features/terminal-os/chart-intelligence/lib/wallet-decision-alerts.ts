/**
 * Wallet × Decision × whale evidence → chart workspace alert rows.
 * Presentation join only — never invents BUY/EXIT. Action labels come from published Decision.
 */

import type { Decision } from '@cryptocheck/decision-contracts'

export type WalletHoldingLite = {
  mint: string
  symbol: string
  change24hPct: number | null
  valueUsd?: number | null
}

export type WhaleLite = {
  assetSymbol: string
  action?: string | null
  usdValue?: number | null
}

export type WalletDecisionAlert = {
  id: string
  kind: 'exit' | 'entry' | 'watch'
  mint: string
  symbol: string
  /** Human line — Decision action when present; honest watch otherwise */
  headline: string
  evidence: string[]
  confidence: number | null
  decisionId: string | null
}

function tokenSubject(d: Decision): { mint: string; symbol: string } | null {
  if (d.subject?.kind !== 'token') return null
  const mint = d.subject.address || d.subject.symbol
  if (!mint) return null
  return { mint, symbol: d.subject.symbol || mint.slice(0, 6) }
}

function whaleHitsForSymbol(whales: WhaleLite[], symbol: string): WhaleLite[] {
  const s = symbol.toUpperCase()
  return whales.filter((w) => (w.assetSymbol || '').toUpperCase() === s)
}

function isBuySideWhale(w: WhaleLite): boolean {
  const side = (w.action || '').toLowerCase()
  return side === 'buy' || side.includes('buy') || side.includes('accumul')
}

/**
 * Build alerts for chart workspace top strip.
 * - exit: Decision SELL|EXIT on a held mint (evidence may include negative 24h %)
 * - entry: Decision BUY with whale-buy and/or positive 24h evidence when available
 * - watch: held mint dropping hard with NO Decision yet — observation only, not an exit command
 */
export function buildWalletDecisionAlerts(opts: {
  holdings: WalletHoldingLite[]
  decisions: Decision[]
  whales: WhaleLite[]
  /** Absolute 24h % drop threshold for watch-only rows (no Decision) */
  watchDropPct?: number
  limit?: number
}): WalletDecisionAlert[] {
  const watchDrop = opts.watchDropPct ?? 8
  const limit = opts.limit ?? 8
  const holdings = opts.holdings.filter((h) => h.mint)
  const byMint = new Map(holdings.map((h) => [h.mint, h]))
  const bySymbol = new Map(holdings.map((h) => [h.symbol.toUpperCase(), h]))

  const out: WalletDecisionAlert[] = []
  const seen = new Set<string>()

  for (const d of opts.decisions) {
    const sub = tokenSubject(d)
    if (!sub) continue
    const held =
      byMint.get(sub.mint) ||
      bySymbol.get(sub.symbol.toUpperCase()) ||
      null
    // Entry alerts: BUY Decision may target a token not yet held (opportunity to enter)
    // Exit alerts: require holding when possible; still show EXIT/SELL if mint matches focused holdings set
    const chg = held?.change24hPct ?? null
    const whales = whaleHitsForSymbol(opts.whales, sub.symbol)
    const buyWhales = whales.filter(isBuySideWhale)

    if (d.action === 'EXIT' || d.action === 'SELL') {
      if (!held && holdings.length > 0) {
        // Only surface exit if user holds it (or no holdings loaded yet — skip)
        continue
      }
      if (!held) continue
      const evidence: string[] = [
        `Published Decision: ${d.action}`,
        typeof chg === 'number' && Number.isFinite(chg)
          ? `Holding 24h ${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`
          : 'Holding 24h change unavailable',
      ]
      if (d.reasoning) evidence.push(String(d.reasoning).slice(0, 120))
      const id = `exit:${d.id}:${held.mint}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        kind: 'exit',
        mint: held.mint,
        symbol: held.symbol || sub.symbol,
        headline: `${d.action} $${held.symbol || sub.symbol} — Decision says exit / reduce`,
        evidence,
        confidence:
          typeof d.confidence === 'number' && Number.isFinite(d.confidence)
            ? Math.round(d.confidence)
            : null,
        decisionId: d.id,
      })
    }

    if (d.action === 'BUY') {
      const evidence: string[] = [`Published Decision: BUY`]
      if (typeof chg === 'number' && Number.isFinite(chg)) {
        evidence.push(`Price 24h ${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`)
      }
      if (buyWhales.length) {
        evidence.push(
          `Whale buy evidence: ${buyWhales.length} movement(s)` +
            (buyWhales[0]?.usdValue
              ? ` · ~$${Math.round(buyWhales[0].usdValue!).toLocaleString()}`
              : ''),
        )
      } else if (whales.length) {
        evidence.push(`Whale tape present (${whales.length}) — side not clearly buy`)
      } else {
        evidence.push('Whale evidence unavailable this cycle')
      }
      if (d.reasoning) evidence.push(String(d.reasoning).slice(0, 120))

      const rising = typeof chg === 'number' && chg > 0
      const whaleBuy = buyWhales.length > 0
      const id = `entry:${d.id}:${sub.mint}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        kind: 'entry',
        mint: sub.mint,
        symbol: sub.symbol,
        headline:
          whaleBuy || rising
            ? `BUY $${sub.symbol} — Decision + ${whaleBuy ? 'whale buy' : 'rising'} evidence`
            : `BUY $${sub.symbol} — Decision published (awaiting whale/rise evidence)`,
        evidence,
        confidence:
          typeof d.confidence === 'number' && Number.isFinite(d.confidence)
            ? Math.round(d.confidence)
            : null,
        decisionId: d.id,
      })
    }
  }

  // Watch-only: sharp drop on a holding with no EXIT/SELL Decision yet
  for (const h of holdings) {
    const chg = h.change24hPct
    if (chg == null || !Number.isFinite(chg) || chg > -watchDrop) continue
    const hasExit = out.some(
      (a) => a.kind === 'exit' && (a.mint === h.mint || a.symbol.toUpperCase() === h.symbol.toUpperCase()),
    )
    if (hasExit) continue
    const id = `watch:${h.mint}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      kind: 'watch',
      mint: h.mint,
      symbol: h.symbol,
      headline: `$${h.symbol} down ${chg.toFixed(1)}% — awaiting Decision (not an auto-exit)`,
      evidence: [
        'Observation from live holdings 24h change',
        'No published EXIT/SELL Decision for this mint yet',
      ],
      confidence: null,
      decisionId: null,
    })
  }

  const rank = (k: WalletDecisionAlert['kind']) => (k === 'exit' ? 0 : k === 'entry' ? 1 : 2)
  return out.sort((a, b) => rank(a.kind) - rank(b.kind) || (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, limit)
}
