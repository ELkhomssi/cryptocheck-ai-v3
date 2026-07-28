'use client'

/**
 * AI-OS pillars — presentation only.
 * Maps the five product systems onto real terminal desks. No fabricated status.
 */

import type { DeskNav } from '@/lib/portfolio-desk/nav'

export type AiOsPillarId =
  | 'employees'
  | 'coaching'
  | 'discovery'
  | 'execution'
  | 'security'

const PILLARS: {
  id: AiOsPillarId
  title: string
  blurb: string
  desk: DeskNav | 'coach'
}[] = [
  {
    id: 'employees',
    title: 'AI Employees',
    blurb: 'Agents that scan, score, and surface work for you.',
    desk: 'intelligence',
  },
  {
    id: 'coaching',
    title: 'AI Coaching',
    blurb: 'Portfolio insight and risk guidance in the side rail.',
    desk: 'coach',
  },
  {
    id: 'discovery',
    title: 'Token Discovery',
    blurb: 'Live market desk — screener, movers, tracked tokens.',
    desk: 'market',
  },
  {
    id: 'execution',
    title: 'Autonomous Execution',
    blurb: 'Automation recipes that run without babysitting charts.',
    desk: 'automation',
  },
  {
    id: 'security',
    title: 'Security Layer',
    blurb: 'Risk-gated swaps and on-chain safety checks before you send.',
    desk: 'trade',
  },
]

export function AiOsPillars({
  onOpenDesk,
  onOpenCoach,
}: {
  onOpenDesk: (desk: DeskNav) => void
  onOpenCoach: () => void
}) {
  return (
    <section className="mc-aios" aria-label="AI Operating System">
      <p className="pd-section-label">CryptoCheck AI OS</p>
      <h1 className="mc-aios-title">AI operating system for traders</h1>
      <p className="mc-aios-sub">
        Not another chart UI — five live systems that already run inside this terminal.
      </p>

      <ul className="mc-aios-list">
        {PILLARS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="mc-aios-item"
              onClick={() => {
                if (p.desk === 'coach') onOpenCoach()
                else onOpenDesk(p.desk)
              }}
            >
              <span className="mc-aios-item-title">{p.title}</span>
              <span className="mc-aios-item-blurb">{p.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
