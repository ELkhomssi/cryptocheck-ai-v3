import type { Metadata } from 'next'
import Link from 'next/link'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import { DocsQuickStart } from '@/components/docs/DocsQuickStart'
import { SCAN_API_SECURITY_DOCS_URL } from '@/lib/security/signing/env'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Developer documentation — CryptoCheckAI',
  description:
    'Integrate institutional token intelligence in minutes. TypeScript SDK, signing, and API reference.',
  path: '/docs',
  keywords: ['CryptoCheckAI API', 'solana scanner API', 'developer docs'],
})

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-8 md:py-14">
      <header className="mb-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Infrastructure API</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-200 md:text-[2rem]">
          Developer documentation
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
          Production-grade Solana risk analysis — authenticate with API keys, optionally sign requests with HMAC-SHA256,
          and consume compact platform JSON for integrations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/api-keys"
            className="inline-flex items-center rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200/95 transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-500/15"
          >
            Create API key
          </Link>
          <a
            href="/api/docs"
            className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 transition-all hover:border-white/[0.12] hover:bg-white/[0.05]"
          >
            Full API reference (HTML)
          </a>
        </div>
      </header>

      <DocsQuickStart />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <GlassCard className="p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Environment</p>
          <ul className="mt-3 space-y-2 text-xs font-medium leading-relaxed text-slate-400">
            <li>
              <code className="text-cyan-300/90">CRYPTOCHECK_API_KEY</code> — your secret key (Bearer)
            </li>
            <li>
              <code className="text-cyan-300/90">API_SIGNING_SALT</code> or{' '}
              <code className="text-cyan-300/90">CRYPTOCHECK_SIGNING_SALT</code> — must match the server in production
            </li>
            <li>
              Local dev: server falls back to the documented dev salt when unset — same default the SDK uses
            </li>
            <li>
              <code className="text-cyan-300/90">CRYPTOCHECK_BASE_URL</code> — override API host (optional)
            </li>
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Security</p>
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-400">
            Optional <code className="text-slate-300">X-CryptoCheck-Signature</code> uses a derived key — never the raw
            API string as HMAC material. Message format:{' '}
            <code className="whitespace-pre-wrap text-slate-300">timestamp + &quot;\\n&quot; + raw body</code>.
          </p>
          <a
            href={SCAN_API_SECURITY_DOCS_URL}
            className="mt-4 inline-flex text-xs font-semibold tracking-wide text-cyan-400/90 hover:text-cyan-300"
          >
            Signing details →
          </a>
        </GlassCard>
      </div>

      <GlassCard className="mt-8 p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">One-click mental model</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium text-slate-400">
          <li>Create a key in the dashboard.</li>
          <li>Copy <code className="text-slate-300">CRYPTOCHECK_API_KEY</code> into your runtime.</li>
          <li>
            Align <code className="text-slate-300">API_SIGNING_SALT</code> with production (or rely on dev defaults
            locally).
          </li>
          <li>
            Instantiate <code className="text-slate-300">CryptoCheckClient</code> and call{' '}
            <code className="text-slate-300">scanToken(mint)</code>.
          </li>
        </ol>
      </GlassCard>
    </div>
  )
}
