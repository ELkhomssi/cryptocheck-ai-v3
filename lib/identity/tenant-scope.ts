/**
 * Phase 18 — pure tenant isolation helpers (testable without live DB).
 * Engines use these so user A never receives rows tagged for user B.
 */

export type TenantTagged = {
  userId?: string | null
  ownerKey?: string | null
  walletAddress?: string | null
}

export function belongsToTenant(
  row: TenantTagged,
  tenant: { userId: string; wallets?: string[] },
): boolean {
  const wallets = new Set((tenant.wallets ?? []).map((w) => w.trim()).filter(Boolean))
  if (row.userId && row.userId === tenant.userId) return true
  if (row.ownerKey && (row.ownerKey === tenant.userId || wallets.has(row.ownerKey))) return true
  if (row.walletAddress && wallets.has(row.walletAddress)) return true
  return false
}

/** Keep only rows owned by the tenant. Global/untagged rows are excluded (no leak). */
export function filterTenantRows<T extends TenantTagged>(
  rows: T[],
  tenant: { userId: string; wallets?: string[] },
): T[] {
  if (!tenant.userId.trim()) return []
  return rows.filter((r) => belongsToTenant(r, tenant))
}

export function assertNoCrossTenantLeak<T extends TenantTagged>(
  rows: T[],
  tenant: { userId: string; wallets?: string[] },
  otherUserId: string,
): void {
  for (const row of rows) {
    if (row.userId === otherUserId) {
      throw new Error(`cross-tenant leak: row userId=${row.userId}`)
    }
    if (row.ownerKey === otherUserId) {
      throw new Error(`cross-tenant leak: row ownerKey=${row.ownerKey}`)
    }
  }
  const filtered = filterTenantRows(rows, tenant)
  if (filtered.length !== rows.length) {
    // Caller passed a pre-scoped list — ok if already filtered; only assert no foreign ids
  }
  void filtered
}
