/**
 * BackgroundLayer — Phase 4B
 *
 * The depth foundation of the Analysis Console. Four fixed, z-stacked,
 * non-interactive layers:
 *   1. Radial gradient base  (slate → black)
 *   2. Cyan grid pattern at 3% opacity, masked to a central ellipse
 *   3. Scan-line sweep (motion-safe only, 8s loop)
 *   4. CC⋅AI watermark, bottom-right, 3% opacity
 *
 * All layers are `aria-hidden` and positioned `fixed inset-0` with
 * negative z-index so content can scroll freely above them.
 */

export function BackgroundLayer() {
  return (
    <>
      {/* ── 1. Radial base gradient ─────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-30"
        style={{
          background: `
            radial-gradient(ellipse at top, #0b1220 0%, #020617 60%, #000000 100%),
            #020617
          `,
        }}
      />

      {/* ── 2. Subtle cyan grid — depth through repetition ──── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,170,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,170,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        }}
      />

      {/* ── 3. Scan-line sweep (motion-safe only) ───────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 right-0 top-0 -z-10 h-px motion-safe:animate-[terminal-scan_8s_linear_infinite]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(0,212,170,0.4), transparent)',
        }}
      />

      {/* ── 4. Brand watermark ──────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-8 right-8 -z-10 select-none font-mono text-6xl font-semibold tracking-tighter text-white/[0.03]"
      >
        CC⋅AI
      </div>
    </>
  )
}
