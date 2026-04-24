'use client'

import type { CSSProperties } from 'react'

/**
 * Shared forensic canvas: radial wash, cyan grid, scanline sweep, rising particles.
 * Use `className` for positioning, e.g. `absolute inset-0 z-0` or `fixed inset-0 z-[1]`.
 */
export function ForensicBackdrop({ className }: { className: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.15),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#22d3ee_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee_1px,transparent_1px)] [background-size:52px_52px]" />

      <style jsx>{`
        @keyframes forensicScanlineSweep {
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
        .forensic-backdrop-scanline {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .forensic-backdrop-scanline::after {
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
          animation: forensicScanlineSweep 4.5s linear infinite;
        }
        @keyframes forensicParticleFloat {
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
        .forensic-backdrop-particle {
          position: absolute;
          bottom: -10px;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
          animation: forensicParticleFloat var(--duration) linear infinite;
          animation-delay: var(--delay);
          left: var(--left);
          --x-shift: var(--drift);
        }
      `}</style>

      <div className="forensic-backdrop-scanline" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={`fb-particle-${i}`}
            className="forensic-backdrop-particle"
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
    </div>
  )
}
