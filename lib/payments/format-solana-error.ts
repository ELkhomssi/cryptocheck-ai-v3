/**
 * Convert raw Solana RPC errors into user-friendly messages.
 *
 * Never expose raw RPC logs, program IDs, or technical details
 * to users. Log the full error to console.error for dev debugging.
 */
export function formatSolanaError(
  err: unknown,
  context?: { requiredLamports?: number; userLamports?: number }
): string {
  const raw = err instanceof Error ? err.message : String(err)

  // ALWAYS log the raw error for developer debugging
  console.error('[Payment] Solana transaction error:', err)

  // Insufficient balance — most common case
  if (
    raw.includes('insufficient lamports') ||
    raw.includes('Insufficient funds') ||
    raw.includes('InsufficientFunds')
  ) {
    // If we have context, show exact amounts
    if (
      context?.requiredLamports != null &&
      context?.userLamports != null
    ) {
      const needSol = (context.requiredLamports / 1e9).toFixed(4)
      const haveSol = (context.userLamports / 1e9).toFixed(4)
      return `Insufficient SOL balance. You need ${needSol} SOL but your wallet has ${haveSol} SOL. Please add funds and try again.`
    }
    return 'Insufficient SOL balance. Please add funds to your wallet and try again.'
  }

  // Try to extract lamports from raw error if context wasn't passed
  const lamportsMatch = raw.match(/insufficient lamports (\d+), need (\d+)/i)
  if (lamportsMatch) {
    const have = parseInt(lamportsMatch[1], 10)
    const need = parseInt(lamportsMatch[2], 10)
    const needSol = (need / 1e9).toFixed(4)
    const haveSol = (have / 1e9).toFixed(4)
    return `Insufficient SOL balance. You need ${needSol} SOL but your wallet has ${haveSol} SOL. Please add funds and try again.`
  }

  // User rejected in wallet
  if (
    raw.includes('User rejected') ||
    raw.includes('rejected the request') ||
    raw.includes('User denied')
  ) {
    return 'Transaction cancelled.'
  }

  // Blockhash / network issues
  if (
    raw.includes('blockhash') ||
    raw.includes('block height exceeded') ||
    raw.includes('timeout')
  ) {
    return 'Network is slow right now. Please try again in a moment.'
  }

  // Slippage or price changed
  if (raw.includes('slippage') || raw.includes('price')) {
    return 'Price changed during transaction. Please refresh and try again.'
  }

  // Simulation failed (generic)
  if (raw.includes('Simulation failed') || raw.includes('simulation failed')) {
    return 'Transaction could not be processed. Please check your wallet and try again.'
  }

  // Fallback — never show raw error to user
  return 'Payment could not be completed. Please try again or contact support.'
}
