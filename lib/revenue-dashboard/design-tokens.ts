/**
 * Revenue Dashboard design system — programmatic tokens + Tailwind class helpers.
 * Typography: Syncopate (labels/headings), Inter (body), JetBrains Mono (numbers).
 */

export const revenueColors = {
  navy: '#0A1230',
  navy2: '#0D1738',
  panel: '#101B42',
  panelGlass: 'rgba(16,27,66,.7)',
  green: '#3FE05A',
  lime: '#C6E833',
  violet: '#7C5CFC',
  textHi: '#EAF1EC',
  textMid: '#9BB0C4',
  textLo: '#5E7088',
  riskSafe: '#3FE05A',
  riskCaution: '#F2B84C',
  riskDanger: '#FF5A6E',
} as const

export const revenueRadii = {
  sm: '10px',
  md: '12px',
  lg: '14px',
} as const

export const revenueMotion = {
  fast: '120ms',
  normal: '180ms',
} as const

/** Tailwind class bundles — use in Revenue Dashboard components only. */
export const rdClasses = {
  shell: 'min-h-screen bg-[#0A1230] text-[#EAF1EC]',
  panel: 'rd-panel',
  heading: 'font-rd-display uppercase tracking-[0.12em] text-[#EAF1EC]',
  body: 'font-sans text-[#9BB0C4]',
  mono: 'rd-mono-nums text-[#EAF1EC]',
  label: 'rd-label',
  compliance: 'rd-compliance',
  verdictSafe: 'text-[#3FE05A] border-[#3FE05A]/40',
  verdictCaution: 'text-[#F2B84C] border-[#F2B84C]/40',
  verdictDanger: 'text-[#FF5A6E] border-[#FF5A6E]/40',
} as const

export const revenueTailwindExtend = {
  colors: {
    rd: {
      navy: revenueColors.navy,
      navy2: revenueColors.navy2,
      panel: revenueColors.panel,
      green: revenueColors.green,
      lime: revenueColors.lime,
      violet: revenueColors.violet,
      hi: revenueColors.textHi,
      mid: revenueColors.textMid,
      lo: revenueColors.textLo,
      safe: revenueColors.riskSafe,
      caution: revenueColors.riskCaution,
      danger: revenueColors.riskDanger,
    },
  },
  borderRadius: {
    rd: revenueRadii.md,
    'rd-sm': revenueRadii.sm,
    'rd-lg': revenueRadii.lg,
  },
  fontFamily: {
    'rd-display': ['var(--font-rd-display)', 'Syncopate', 'ui-sans-serif', 'sans-serif'],
    'rd-mono': ['var(--font-rd-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
  },
} as const
