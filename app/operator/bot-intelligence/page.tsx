import { getBotIntelligenceSnapshot } from '@/lib/bot-protection/intelligence'
import { BotIntelligenceView } from '@/components/operator/views/bot-intelligence'

export const dynamic = 'force-dynamic'

export default async function BotIntelligencePage() {
  const snapshot = await getBotIntelligenceSnapshot()
  return <BotIntelligenceView snapshot={snapshot} />
}
