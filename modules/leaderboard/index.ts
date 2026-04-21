/**
 * Leaderboard score = ROI * speed_factor (see ingest job / API later).
 */
export function rankScore(roiMultiple: number, tradeSpeedMs: number): number {
  const speedFactor = tradeSpeedMs > 0 ? Math.min(2, 30_000 / tradeSpeedMs) : 1
  return roiMultiple * speedFactor
}
