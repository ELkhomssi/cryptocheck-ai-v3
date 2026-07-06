'use client'

import { Suspense } from 'react'
import { TradeTerminal } from '@/components/revenue-dashboard/TradeTerminal'

function TerminalLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rd-green border-t-transparent" />
    </div>
  )
}

export default function RevenueTerminalPage() {
  return (
    <Suspense fallback={<TerminalLoading />}>
      <TradeTerminal />
    </Suspense>
  )
}
