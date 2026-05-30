'use client'

import { useCallback, useState } from 'react'
import type { TxLifecycle, TxPhase } from '@/lib/web4/protocol/types'

const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '',
  building: 'Building transaction…',
  signed: 'Awaiting wallet signature…',
  sent: 'Submitted to Solana…',
  processed: 'Processed',
  confirmed: 'Confirmed',
  finalized: 'Finalized on-chain',
  error: 'Transaction failed',
}

export function useTransactionLifecycle() {
  const [lifecycle, setLifecycle] = useState<TxLifecycle>({ phase: 'idle', signature: null })

  const onLifecycle = useCallback((state: TxLifecycle) => {
    setLifecycle(state)
  }, [])

  const reset = useCallback(() => {
    setLifecycle({ phase: 'idle', signature: null })
  }, [])

  const label = PHASE_LABEL[lifecycle.phase]
  const busy = ['building', 'signed', 'sent', 'processed', 'confirmed'].includes(lifecycle.phase)

  return { lifecycle, onLifecycle, reset, label, busy }
}
