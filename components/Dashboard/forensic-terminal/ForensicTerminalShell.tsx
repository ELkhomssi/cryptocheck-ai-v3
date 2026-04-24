'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Full-bleed forensic atmosphere for dashboard main content.
 * Matches AI Investigation Agent: grid, radial glow, particles, scanline.
 * Background #020617 per design spec.
 */
export function ForensicTerminalShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100dvh-6rem)] overflow-hidden bg-[#020617] px-4 py-8 text-slate-100 md:-mx-8 md:px-8 md:-my-10 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.15),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#22d3ee_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee_1px,transparent_1px)] [background-size:52px_52px]" />

      <style jsx>{`
        @keyframes scanlineSweep {
          0% {
            transform: translateY(-120%);
            opacity: 0;
          }
          20% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(120%);
            opacity: 0;
          }
        }
        .scanline-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .scanline-overlay::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 120px;
          background: linear-gradient(
            to bottom,
            rgba(34, 211, 238, 0),
            rgba(34, 211, 238, 0.18),
            rgba(34, 211, 238, 0)
          );
          animation: scanlineSweep 4.5s linear infinite;
        }
        @keyframes particleFloat {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          10% {
            opacity: 0.55;
          }
          100% {
            transform: translate3d(var(--x-shift), -75vh, 0);
            opacity: 0;
          }
        }
        .particle {
          position: absolute;
          bottom: -10px;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
          animation: particleFloat var(--duration) linear infinite;
          animation-delay: var(--delay);
          left: var(--left);
          --x-shift: var(--drift);
        }
      `}</style>

      <div className="scanline-overlay" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={`dash-particle-${i}`}
            className="particle"
            style={
              {
                '--left': `${(i * 97) % 100}%`,
                '--duration': `${8 + (i % 7)}s`,
                '--delay': `${-1 * (i % 11)}s`,
                '--drift': `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 6)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-[1] mx-auto max-w-[1200px]">{children}</div>
    </div>
  )
}
