import { JetBrains_Mono } from 'next/font/google'
import '@/lib/command-center/design-tokens.css'
import { CommandCenterDashboard } from '@/components/command-center/CommandCenterDashboard'

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cc-mono',
  display: 'swap',
})

type Props = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function CommandCenterHome({ userEmail, effectiveTier, isAnonymousPreview }: Props) {
  return (
    <div className={`${jetbrains.variable} antialiased`}>
      <CommandCenterDashboard
        userEmail={userEmail}
        effectiveTier={effectiveTier}
        isAnonymousPreview={isAnonymousPreview}
      />
    </div>
  )
}
