import Link from 'next/link'
import { JsonLdScript } from '@/components/seo/JsonLd'
import type { JsonLd } from '@/lib/seo/json-ld'

export type MarketingFeaturePageProps = {
  brand?: string
  title: string
  description: string
  primaryCta: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
  jsonLd?: JsonLd
  children?: React.ReactNode
}

/**
 * Lean public SEO surface — preserves CryptoCheck dark terminal language.
 * One composition: brand, headline, support, CTAs.
 */
export function MarketingFeaturePage({
  brand = 'CryptoCheckAI',
  title,
  description,
  primaryCta,
  secondaryCta,
  jsonLd,
  children,
}: MarketingFeaturePageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050510] text-slate-200">
      {jsonLd ? <JsonLdScript data={jsonLd} /> : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,255,0,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(56,189,248,0.08), transparent 50%), linear-gradient(180deg, #050510 0%, #0a0a18 100%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16 md:px-8">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">{brand}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-400 md:text-base">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center rounded-lg border border-[#c8ff00]/35 bg-[#c8ff00]/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#c8ff00] transition hover:bg-[#c8ff00]/15"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 transition hover:bg-white/[0.06]"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
        {children ? <div className="mt-10 text-sm text-slate-500">{children}</div> : null}
        <p className="mt-12 text-[0.65rem] uppercase tracking-[0.16em] text-slate-600">
          Not financial advice · DYOR
        </p>
      </div>
    </main>
  )
}
