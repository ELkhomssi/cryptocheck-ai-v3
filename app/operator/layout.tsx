import { JetBrains_Mono } from 'next/font/google'
import { requireOperatorPage } from '@/lib/operator/require-operator'
import { OperatorShell } from '@/components/operator/OperatorShell'

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const dynamic = 'force-dynamic'

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperatorPage('/operator')
  return (
    <div className={`${mono.className} antialiased`}>
      <OperatorShell userEmail={op.email ?? ''}>{children}</OperatorShell>
    </div>
  )
}
