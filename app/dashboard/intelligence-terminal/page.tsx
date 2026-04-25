import { IntelligencePanel } from '@/components/Dashboard/intelligence-panel/IntelligencePanel'

export const metadata = {
  title: 'Analysis Console — CryptoCheck AI',
  description: 'Authenticated Solana intelligence terminal.',
}

export default async function IntelligenceTerminalPage({
  searchParams,
}: {
  searchParams?: { mint?: string }
}) {
  const mint =
    typeof searchParams?.mint === 'string' && searchParams.mint.length >= 32
      ? searchParams.mint
      : 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  return (
    <IntelligencePanel mint={mint} />
  )
}
