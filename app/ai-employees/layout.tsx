import { Inter, IBM_Plex_Mono } from 'next/font/google'
import { PortfolioProviders } from '@/components/portfolio-desk/Providers'
import '@/lib/portfolio-desk/theme.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata = {
  title: 'AI Employees · CryptoCheck AI',
  description: 'Specialized AI trading agents with live status and real performance scores.',
}

export default function AiEmployeesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${ibmMono.variable} ${inter.className}`}
      style={{ minHeight: '100vh', background: 'var(--pd-bg, #0A0D12)' }}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('ccai-portfolio-theme');if(t){var p=JSON.parse(t);if(p&&p.state&&p.state.theme){document.documentElement.setAttribute('data-theme',p.state.theme);}}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
        }}
      />
      <PortfolioProviders>{children}</PortfolioProviders>
    </div>
  )
}
