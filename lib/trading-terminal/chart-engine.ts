/**
 * Pluggable chart engine — lightweight-charts is primary; DexScreener kept as fallback URL helper.
 */

export type ChartTimeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D'

export type ChartEngineSlotProps = {
  slotId: number
  mint: string
  symbol: string
  timeframe: ChartTimeframe
}

export type ChartEngineId = 'lightweight' | 'dexscreener' | 'tradingview'

/** Primary engine — institutional candlesticks via lightweight-charts. */
export const DEFAULT_CHART_ENGINE: ChartEngineId = 'lightweight'

export const CHART_TIMEFRAMES: ChartTimeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D']

export function dexscreenerEmbedUrl(mint: string): string {
  return `https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`
}
