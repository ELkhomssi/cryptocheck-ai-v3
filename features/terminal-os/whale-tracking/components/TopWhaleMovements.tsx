'use client'

import { WhaleMarqueeTicker } from '@/features/terminal-os/whale-tracking/components/WhaleMarqueeTicker'

/** Back-compat export — home + whale-tracking nav both use the premium marquee. */
export function TopWhaleMovements() {
  return <WhaleMarqueeTicker />
}
