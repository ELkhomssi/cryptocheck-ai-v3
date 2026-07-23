export function isValidSolanaWallet(wallet: string | null | undefined): boolean {
  return Boolean(wallet && wallet.trim().length >= 32)
}
