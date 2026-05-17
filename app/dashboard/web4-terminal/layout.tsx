import type { Metadata } from 'next'
import './web4-terminal.css'

export const metadata: Metadata = {
  title: 'Web4 Terminal — CryptoCheck AI',
  description:
    'Pump.fun-style memecoin launchpad — create tokens, trade on bonding curve, explore trending coins.',
}

export default function Web4TerminalLayout({ children }: { children: React.ReactNode }) {
  return children
}
