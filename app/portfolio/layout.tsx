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
  title: 'CryptoCheck AI — Portfolio',
  description: 'Live Solana portfolio desk — holdings, performance, alerts, AI coach.',
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${ibmMono.variable} ${inter.className}`}
      data-theme="dark"
      style={{ minHeight: '100vh', background: 'var(--pd-bg, #0A0D12)' }}
    >
      {/* Inline boot so first paint is dark before Zustand rehydrates */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('ccai-portfolio-theme');if(t){var p=JSON.parse(t);if(p&&p.state&&p.state.theme){document.documentElement.setAttribute('data-theme',p.state.theme);}}}catch(e){}})();`,
        }}
      />
      <PortfolioProviders>{children}</PortfolioProviders>
    </div>
  )
}
