'use client'

import { Suspense } from 'react'
import { Web4PumpDashboard } from '@/app/dashboard/web4-terminal/Web4PumpDashboard'

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
    </div>
  )
}

export default function Web4LaunchpadPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Web4PumpDashboard />
    </Suspense>
  )
}
