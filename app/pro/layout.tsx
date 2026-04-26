import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { GlobalAccessKeyDiagnostics } from '@/components/access/GlobalAccessKeyDiagnostics'

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.09), transparent), radial-gradient(ellipse 55% 45% at 100% 20%, rgba(16, 185, 129, 0.05), transparent), #0a0a0f',
        color: '#e8e8ef',
        fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(12px,3vw,20px) clamp(14px,4vw,40px) 0' }}>
        <GlobalAccessKeyDiagnostics variant="pro" />
      </div>
      {children}
    </div>
  )
}
