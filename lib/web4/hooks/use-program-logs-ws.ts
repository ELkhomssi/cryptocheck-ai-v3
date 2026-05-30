'use client'

import { useConnection } from '@solana/wallet-adapter-react'
import { useEffect } from 'react'
import { getWeb4ProgramId } from '@/lib/web4/protocol/config'

/** Subscribe to program logs for live trade tape (high-frequency, no mock bots). */
export function useProgramLogsWs(onLog: (signature: string, logs: string[]) => void) {
  const { connection } = useConnection()
  const programId = getWeb4ProgramId()

  useEffect(() => {
    if (!programId) return

    const sub = connection.onLogs(
      programId,
      (ev) => {
        if (ev.err) return
        onLog(ev.signature, ev.logs)
      },
      'confirmed',
    )

    return () => {
      void connection.removeOnLogsListener(sub)
    }
  }, [connection, onLog, programId])
}
