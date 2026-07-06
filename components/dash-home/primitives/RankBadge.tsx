export type RankBadgeProps = {
  n: number
}

export function RankBadge({ n }: RankBadgeProps) {
  const isGold = n === 1
  return (
    <span
      className={`font-dash-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isGold ? 'bg-dash-gold text-dash-bg' : 'bg-dash-greenDeep text-dash-green'
      }`}
    >
      {n}
    </span>
  )
}
