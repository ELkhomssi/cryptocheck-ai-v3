/**
 * LaunchLab Platform Config fee mutability (Phase 1).
 *
 * VERDICT: **Mutable after creation.** Admin can revise without redeploying a new platform PDA.
 *
 * Evidence (Raydium SDK `@raydium-io/raydium-sdk-v2`):
 * - `launchpad.updatePlatformConfig` + instruction `updatePlatformConfig`
 * - Supported update types include:
 *   - `updateFeeRate` — platform trade fee
 *   - `updateAll` — includes `feeRate` + `creatorFeeRate`
 *   - `migrateCpLockNftScale` — post-grad LP NFT platform/creator/burn split
 *   - claim / lock / vesting wallets, name/web/img, cpConfigId, …
 *
 * Go-live starting point (deliberate, revisitable with volume):
 * - platform feeRate 10_000 / 1e6 = **1.0%**
 * - creatorFeeRate 5_000 / 1e6 = **0.5%**
 * - migrate LP NFT scale **40% / 50% / 10%** (platform / creator / burn)
 *
 * Legal (Phase 4) still reviews the fee surface before public promotion — mutability does not
 * replace counsel review; it means we are not locked forever at create time.
 */
export const LAUNCHLAB_FEE_MUTABLE = true as const
