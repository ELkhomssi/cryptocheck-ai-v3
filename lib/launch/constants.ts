/** Client-safe launch bounds (keep in sync with lib/launch/config.ts). */

export const MIN_SUPPLY_HUMAN = 10_000_000
export const MIN_SELL_FRACTION = 0.2
/** Mainnet / default floor (rejects low-cap rug shapes). */
export const MIN_SOL_TARGET = 30
/**
 * Devnet happy-path floor. On-chain LaunchpadConfig.minFundRaisingB is 1 lamport
 * on Raydiumdevnet — we still keep a small human floor for sanity.
 */
export const MIN_SOL_TARGET_DEVNET = 0.25
export const LAUNCH_DECIMALS = 6

export const LAUNCH_COMPLIANCE =
  'Every launch is scanned by Neural V4. Flagged tokens are labeled, not hidden. Non-custodial — your wallet signs. Not financial advice. LaunchLab is permissionless: we refuse to build blocked launches and badge scams — we cannot make on-chain launches impossible.'
