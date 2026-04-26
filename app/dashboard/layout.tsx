import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { DashboardShell } from '@/components/Dashboard/DashboardShell'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-terminal',
  display: 'swap',
})

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  /** Preview mode: shell + routes visible without auth (Vercel QA / mobile UI review). */
  let userEmail = ''
  let effectiveTier = 'FREE'
  if (user) {
    userEmail = user.email ?? ''
    try {
      await ensureFreeTierSubscription(user.id)
    } catch {
      /* service role / DB — best effort */
    }
    const sub = await getUserSubscription(user.id)
    effectiveTier = sub.effectiveTier
  }

  return (
    <div className={`${inter.className} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
      <DashboardShell
        userEmail={userEmail}
        effectiveTier={effectiveTier}
        isAnonymousPreview={!user}
      >
        <>
          <DisclaimerBanner variant="default" />
          {children}
        </>
      </DashboardShell>
    </div>
  )
}
