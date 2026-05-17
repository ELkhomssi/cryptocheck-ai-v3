'use client'

import type { TokenCard } from '../terminal-types'

export function TokenAvatar({ coin, size = 'md' }: { coin: TokenCard; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-9 w-9 text-base' : size === 'lg' ? 'h-16 w-16 text-3xl' : 'h-11 w-11 text-xl'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${coin.gradient} ${sz} shadow-lg`}
    >
      {coin.emoji}
    </div>
  )
}
