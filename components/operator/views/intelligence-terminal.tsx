import { IntelligenceTerminalClient } from '@/app/dashboard/intelligence-terminal/intelligence-terminal-client'

export const metadata = {
  title: 'Analysis Console — Operator',
  description: 'Authenticated Solana intelligence terminal.',
}

export default async function OperatorAnalysisPage({
  searchParams,
}: {
  searchParams?: { mint?: string }
}) {
  const mint =
    typeof searchParams?.mint === 'string' && searchParams.mint.length >= 32
      ? searchParams.mint
      : 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  return <IntelligenceTerminalClient mint={mint} />
}
