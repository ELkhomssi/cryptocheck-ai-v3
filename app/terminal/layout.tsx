import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import '@/lib/trading-terminal/design-tokens.css'

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

export default function TerminalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.className} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
    >
      {children}
    </div>
  )
}
