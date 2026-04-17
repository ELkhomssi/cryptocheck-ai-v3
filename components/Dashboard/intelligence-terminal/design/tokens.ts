/**
 * Intelligence Terminal — Design Tokens (Phase 4A)
 *
 * Single source of truth for the Analysis Console's visual language.
 * "Bloomberg Terminal meets cyberpunk ops console."
 *
 * Consumed two ways:
 *  - Inline styles / dynamic styling in TSX (via `terminalTokens.colors.*`)
 *  - CSS custom properties for anything referenced inside @keyframes
 *    (see `app/globals.css` — `--terminal-*` variables).
 *
 * Rules:
 *  - Any new color/motion/shadow used across >1 component goes here.
 *  - Pure constants. No runtime side effects. Tree-shakes cleanly.
 */

export const terminalTokens = {
  colors: {
    // ── Deep base surfaces ──────────────────────────────────────
    base: '#020617', // slate-950 deepened — the void behind everything
    surface: '#0b1220', // default card background
    surfaceRaised: '#0f1829', // elevated card / hover state

    // ── Borders (layered by emphasis) ───────────────────────────
    borderDefault: 'rgba(255,255,255,0.05)',
    borderEmphasis: 'rgba(255,255,255,0.10)',
    borderActive: 'rgba(0,212,170,0.35)',

    // ── Brand accent (cyan-green) ───────────────────────────────
    primary: '#00d4aa',
    primaryGlow: 'rgba(0,212,170,0.25)',
    primaryDim: 'rgba(0,212,170,0.08)',

    // ── Semantic signals ────────────────────────────────────────
    danger: '#ff4757',
    dangerGlow: 'rgba(255,71,87,0.25)',
    warning: '#ffa502',
    warningGlow: 'rgba(255,165,2,0.25)',
    info: '#00b8d9',

    // ── Text ladder ─────────────────────────────────────────────
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textAccent: '#00d4aa',
  },

  fonts: {
    data: 'var(--font-mono)', // IBM Plex Mono (bound in app/layout.tsx)
    body: 'var(--font-sans)', // IBM Plex Sans
  },

  radii: {
    card: '0.75rem',
    pill: '9999px',
  },

  shadows: {
    terminal:
      '0 0 40px rgba(0,212,170,0.08), 0 0 80px rgba(0,212,170,0.04)',
    card: '0 4px 24px rgba(0,0,0,0.4)',
    cardHover: '0 4px 32px rgba(0,212,170,0.12)',
  },

  motion: {
    fast: '150ms',
    base: '250ms',
    slow: '400ms',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const

export type TerminalTokens = typeof terminalTokens

/**
 * Verdict → accent color lookup. Aliased to the canonical RiskVerdict
 * type from `lib/types/intelligence` so the console never drifts from
 * the API contract. Used by cards that tint their top-border/glow
 * based on the scan verdict.
 */
export type Verdict = 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER'

export const verdictAccent: Record<
  Verdict,
  { color: string; glow: string; key: 'safe' | 'danger' }
> = {
  SAFE: {
    color: terminalTokens.colors.primary,
    glow: terminalTokens.colors.primaryGlow,
    key: 'safe',
  },
  CAUTION: {
    color: terminalTokens.colors.primary,
    glow: terminalTokens.colors.primaryGlow,
    key: 'safe',
  },
  RISKY: {
    color: terminalTokens.colors.danger,
    glow: terminalTokens.colors.dangerGlow,
    key: 'danger',
  },
  DANGER: {
    color: terminalTokens.colors.danger,
    glow: terminalTokens.colors.dangerGlow,
    key: 'danger',
  },
}
