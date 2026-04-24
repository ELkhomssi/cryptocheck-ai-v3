import Link from 'next/link'

const LAST_UPDATED = 'Friday Apr 24, 2026'
const EFFECTIVE_DATE = 'Friday Apr 24, 2026'

const sections = [
  { id: 'acceptance', title: 'Section 1 — Acceptance of Terms' },
  { id: 'description', title: 'Section 2 — Description of Service' },
  { id: 'informational', title: 'Section 3 — Informational Nature of Service' },
  { id: 'registration', title: 'Section 4 — Account Registration' },
  { id: 'subscription', title: 'Section 5 — Subscription & Payment' },
  { id: 'acceptable-use', title: 'Section 6 — Acceptable Use' },
  { id: 'ip', title: 'Section 7 — Intellectual Property' },
  { id: 'liability', title: 'Section 8 — Limitation of Liability' },
  { id: 'law', title: 'Section 9 — Governing Law & Disputes' },
  { id: 'contact', title: 'Section 10 — Contact' },
  { id: 'changes', title: 'Section 11 — Changes to Terms' },
] as const

export default function TermsPage() {
  return (
    <div id="top" className="min-h-screen bg-[#020617] text-[#F1F5F9]">
      <main className="mx-auto w-full max-w-[768px] px-4 py-10 sm:px-6 sm:py-12">
        <header className="mb-8 border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            CryptoCheck AI, Inc. · Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-300">Last Updated: {LAST_UPDATED}</p>
          <p className="text-sm text-slate-300">Effective Date: {EFFECTIVE_DATE}</p>
        </header>

        <nav aria-label="Table of contents" className="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Table of Contents</h2>
          <ul className="space-y-1.5 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-slate-200 underline-offset-2 hover:text-cyan-300 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="space-y-8 leading-7">
          <section id="acceptance">
            <h2 className="mb-3 text-lg font-bold">Section 1 — Acceptance of Terms</h2>
            <p>
              By accessing or using the Service, you agree to these Terms. If you don't agree, don't use the Service.
            </p>
          </section>

          <section id="description">
            <h2 className="mb-3 text-lg font-bold">Section 2 — Description of Service</h2>
            <p>CryptoCheck AI provides on-chain intelligence tools for Solana:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Token risk scanning (Sentinel Risk Engine)</li>
              <li>Whale activity observation</li>
              <li>AI-generated pattern analysis</li>
              <li>Developer API access</li>
              <li>Chrome Extension</li>
            </ul>
            <p className="mt-3">
              We do NOT: execute trades, custody funds, manage portfolios, or provide investment advice.
            </p>
          </section>

          <section id="informational">
            <h2 className="mb-3 text-lg font-bold">Section 3 — Informational Nature of Service</h2>

            <h3 className="mb-2 mt-4 text-base font-bold">3.1 Not Financial Advice.</h3>
            <p>
              The CryptoCheck AI service, including all reports, scores, analyses, signals, pattern matches, and
              AI-generated content ("Service Output"), is provided for informational and educational purposes only.
              Service Output does not constitute financial advice, investment advice, trading advice, or any other
              form of professional advice.
            </p>

            <h3 className="mb-2 mt-4 text-base font-bold">3.2 No Fiduciary Relationship.</h3>
            <p>
              Use of the Service does not create a fiduciary, advisory, broker-client, or investment-adviser
              relationship between you and CryptoCheck AI, Inc. We are not registered as an investment adviser,
              broker-dealer, or financial institution in any jurisdiction.
            </p>

            <h3 className="mb-2 mt-4 text-base font-bold">3.3 No Guarantees.</h3>
            <p>
              No Service Output constitutes a guarantee, warranty, or representation of any particular outcome. Risk
              scores and AI analyses are probabilistic assessments based on on-chain data available at time of
              generation and may contain errors, omissions, or outdated information.
            </p>

            <h3 className="mb-2 mt-4 text-base font-bold">3.4 Your Responsibility.</h3>
            <p>
              You are solely responsible for your trading, investment, and financial decisions. You should conduct your
              own research and consult qualified licensed professionals before making any financial decision. You
              acknowledge that cryptocurrency trading carries substantial risk of loss.
            </p>

            <h3 className="mb-2 mt-4 text-base font-bold">3.5 Risk Acknowledgment.</h3>
            <p>
              You acknowledge that cryptocurrency markets are volatile, that token values may decrease or go to zero,
              that on-chain data may be manipulated, and that past performance does not predict future results.
            </p>
          </section>

          <section id="registration">
            <h2 className="mb-3 text-lg font-bold">Section 4 — Account Registration</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Eligibility: 18+, legal capacity in your jurisdiction</li>
              <li>Accurate information required</li>
              <li>Responsible for account security</li>
              <li>One account per person/entity</li>
            </ul>
          </section>

          <section id="subscription">
            <h2 className="mb-3 text-lg font-bold">Section 5 — Subscription & Payment</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Plans: Free, Micro Pack ($5 one-time), Pro Max Deep ($30/mo), Pro Max Elite ($40/mo), Pro Developer
                ($29/mo), Enterprise ($299/mo)
              </li>
              <li>Stripe handles payment processing</li>
              <li>Solana on-chain payments accepted for consumer tiers</li>
              <li>Refund policy: pro-rated refunds within 7 days at CryptoCheck AI's discretion</li>
              <li>Prices subject to change with 30 days notice</li>
            </ul>
          </section>

          <section id="acceptable-use">
            <h2 className="mb-3 text-lg font-bold">Section 6 — Acceptable Use</h2>
            <p>You will NOT:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Reverse-engineer, decompile, or abuse the API</li>
              <li>Share API keys or resell access</li>
              <li>Use the Service for illegal activity</li>
              <li>Circumvent rate limits or tier restrictions</li>
              <li>Upload malicious data or attempt exploits</li>
              <li>Scrape or mirror the Service at scale</li>
            </ul>
          </section>

          <section id="ip">
            <h2 className="mb-3 text-lg font-bold">Section 7 — Intellectual Property</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>CryptoCheck AI owns all platform IP</li>
              <li>
                User content (scan history, watchlists): you retain ownership, we retain license to operate the
                service
              </li>
              <li>
                Sentinel Risk Engine, Neural Scan v2, and all algorithms are proprietary trade secrets
              </li>
            </ul>
          </section>

          <section id="liability">
            <h2 className="mb-3 text-lg font-bold">Section 8 — Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, CryptoCheck AI, Inc.'s liability is capped at the greater of
              $100 or fees paid in the 12 months preceding the claim. This excludes fraud, willful misconduct, and
              violations of applicable law.
            </p>
          </section>

          <section id="law">
            <h2 className="mb-3 text-lg font-bold">Section 9 — Governing Law & Disputes</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Governing law: Delaware, USA</li>
              <li>Disputes: binding arbitration in Delaware, except small claims</li>
              <li>Class action waiver</li>
              <li>User's home jurisdiction protections still apply where required by law</li>
            </ul>
          </section>

          <section id="contact">
            <h2 className="mb-3 text-lg font-bold">Section 10 — Contact</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Email: cryptocheckai@gmail.com</li>
              <li>Company: CryptoCheck AI, Inc.</li>
              <li>State of Incorporation: Delaware, USA</li>
            </ul>
          </section>

          <section id="changes">
            <h2 className="mb-3 text-lg font-bold">Section 11 — Changes to Terms</h2>
            <p>
              We may update these Terms. Material changes require 30 days notice. Continued use after notice
              constitutes acceptance.
            </p>
          </section>
        </article>

        <div className="mt-10 flex justify-between gap-4 border-t border-slate-800 pt-6">
          <Link href="/" className="text-sm text-slate-300 underline-offset-2 hover:text-cyan-300 hover:underline">
            Back to CryptoCheck AI
          </Link>
          <a href="#top" className="text-sm text-slate-300 underline-offset-2 hover:text-cyan-300 hover:underline">
            Back to top
          </a>
        </div>

        <footer className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-6 text-amber-200">
          This document is a starting template. We recommend you have Terms of Service reviewed by qualified legal
          counsel in your jurisdiction before commercial use.
        </footer>
      </main>
    </div>
  )
}
