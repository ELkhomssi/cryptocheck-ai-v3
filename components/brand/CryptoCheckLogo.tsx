'use client'

import Image from 'next/image'
import Link from 'next/link'
import { GeistSans } from 'geist/font/sans'

const EMERALD = '#10b981'

type Props = {
  /** Shows a small INSTITUTIONAL pill (Pro terminal only). */
  variant?: 'default' | 'institutional'
  /** Defaults to `/` (marketing). Use `/dashboard` for the developer control plane when the user is in-app. */
  href?: string
}

/**
 * Official CryptoCheck AI wordmark: `/logo.jpg` + Geist + emerald "AI".
 */
export function CryptoCheckLogo({ variant = 'default', href = '/' }: Props) {
  return (
    <Link
      href={href}
      className={GeistSans.className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Image
        src="/logo.jpg"
        alt="CryptoCheck AI"
        width={32}
        height={28}
        priority
        style={{
          width: 32,
          height: 28,
          borderRadius: 6,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#f8fafc',
          whiteSpace: 'nowrap',
        }}
      >
        CryptoCheck<span style={{ color: EMERALD }}>AI</span>
      </span>
      {variant === 'institutional' ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#64748b',
            border: '0.5px solid rgba(16,185,129,0.25)',
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          INSTITUTIONAL
        </span>
      ) : null}
    </Link>
  )
}
