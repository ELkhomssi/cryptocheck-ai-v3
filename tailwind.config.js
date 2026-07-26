/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        /** Revenue Dashboard — Syncopate labels; load via `app/dashboard/revenue/layout.tsx` */
        'rd-display': ['var(--font-rd-display)', 'Syncopate', 'ui-sans-serif', 'sans-serif'],
        'rd-mono': ['var(--font-rd-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        /** Dashboard forensic titles — loaded via `app/dashboard/layout.tsx` */
        space: ['var(--font-space-grotesk)', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'dash-mono': ['var(--font-dash-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        // Global dashboard mono stays IBM Plex Mono.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Terminal-only. Opt in by using `font-mono-terminal` inside
        // components under `components/Dashboard/intelligence-terminal/`.
        // Backed by the `--font-mono-terminal` CSS variable loaded via
        // next/font/google in app/layout.tsx.
        'mono-terminal': [
          'var(--font-mono-terminal)',
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          'ui-monospace',
          'monospace',
        ],
      },
      colors: {
        // Phase 12 — brass terminal tokens (CSS variables from styles/tokens.css)
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
        },
        text: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-dim)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          bright: 'var(--accent-bright)',
          soft: 'var(--accent-soft)',
        },
        positive: {
          DEFAULT: 'var(--positive)',
          soft: 'var(--positive-soft)',
        },
        negative: {
          DEFAULT: 'var(--negative)',
          soft: 'var(--negative-soft)',
        },
        chain: {
          DEFAULT: 'var(--chain)',
          soft: 'var(--chain-soft)',
        },
        // Legacy dashboard / revenue palettes — NOT Phase 12 tokens.
        // Prefer var(--*) / Tailwind `bg`/`accent`/`positive` for terminal surfaces.
        // Tracked for migration; lint:tokens excludes these config keys until migrated.
        dash: {
          bg: 'var(--bg)',
          panel: 'var(--surface)',
          panel2: 'var(--surface-2)',
          inset: 'var(--bg-elevated)',
          hairline: 'var(--border)',
          innerline: 'var(--border-soft)',
          green: 'var(--positive)',
          greenHi: 'var(--positive)',
          greenDim: 'var(--positive-soft)',
          greenDeep: 'var(--positive)',
          gold: 'var(--accent)',
          red: 'var(--negative)',
          amber: 'var(--accent)',
          sky: 'var(--chain)',
          violet: 'var(--chain)',
          teal: 'var(--positive)',
          magenta: 'var(--accent)',
          orangeTx: 'var(--accent)',
          thi: 'var(--text)',
          tmid: 'var(--text-dim)',
          tlo: 'var(--text-faint)',
        },
        rd: {
          navy: 'var(--bg)',
          navy2: 'var(--bg-elevated)',
          panel: 'var(--surface)',
          green: 'var(--positive)',
          lime: 'var(--accent-bright)',
          violet: 'var(--chain)',
          hi: 'var(--text)',
          mid: 'var(--text-dim)',
          lo: 'var(--text-faint)',
          safe: 'var(--positive)',
          caution: 'var(--accent)',
          danger: 'var(--negative)',
        },
        'bg-base': 'var(--bg)',
        'bg-surface': 'var(--surface)',
        'bg-panel': 'var(--bg-elevated)',
        'bg-card': 'var(--surface)',
        'neon-indigo': 'var(--positive)',
        'neon-violet': 'var(--positive)',
        'neon-cyan': 'var(--chain)',
        'neon-purple': 'var(--chain)',
        'neon-blue': 'var(--chain)',
        'terminal-ok': 'var(--positive)',
        'terminal-warn': 'var(--accent)',
        'terminal-danger': 'var(--negative)',
        'terminal-info': 'var(--chain)',
        'terminal-gold': 'var(--accent)',
        'text-primary': 'var(--text)',
        'text-secondary': 'var(--text-dim)',
        'text-muted': 'var(--text-dim)',
        'text-dim': 'var(--text-faint)',
      },
      borderRadius: {
        dash: '14px',
        'dash-inner': '12px',
        'dash-chip': '8px',
        'dash-pill': '999px',
      },
      boxShadow: {
        'dash-ring': '0 0 8px rgba(249,115,22,0.45)',
        'dash-glow-emerald': '0 0 24px rgba(34,197,94,0.35)',
        'dash-glow-blue': '0 0 20px rgba(59,130,246,0.28)',
        'dash-glow-violet': '0 0 20px rgba(59,130,246,0.28)',
        'dash-glow-gold': '0 0 20px rgba(249,115,22,0.3)',
        'dash-glow-teal': '0 0 20px rgba(34,197,94,0.28)',
        'dash-glow-magenta': '0 0 20px rgba(249,115,22,0.28)',
        'neon-indigo':    '0 0 16px rgba(99,102,241,0.35)',
        'neon-indigo-lg': '0 0 32px rgba(99,102,241,0.45)',
        'neon-cyan':      '0 0 16px rgba(6,182,212,0.3)',
        'neon-ok':        '0 0 16px rgba(16,185,129,0.3)',
        'neon-ok-lg':     '0 0 32px rgba(16,185,129,0.45)',
        'neon-danger':    '0 0 16px rgba(239,68,68,0.3)',
      },
      animation: {
        'blink':      'blink 2s ease-in-out infinite',
        'float':      'float 4s ease-in-out infinite',
        'slide-in':   'slideIn 0.25s ease',
        'fade-up':    'fadeUp 0.3s ease forwards',
        'ticker':     'ticker 40s linear infinite',
        'ticker-slow': 'ticker 40s linear infinite',
        'shimmer':    'shimmer 1.5s infinite',
        'ring-1':     'spin 1.2s linear infinite',
        'ring-2':     'spinReverse 1.8s linear infinite',
        'ring-3':     'spin 2.4s linear infinite',
        'pulse-dot':  'pulseDot 1.5s ease-in-out infinite',
        'neon-pulse': 'neonPulseShadow 2.8s ease-in-out infinite',
      },
      keyframes: {
        neonPulseShadow: {
          '0%, 100%': {
            boxShadow:
              'inset 0 0 0 1px rgba(6,182,212,0.12), 0 0 18px rgba(6,182,212,0.14), 0 0 40px rgba(6,182,212,0.06)',
          },
          '50%': {
            boxShadow:
              'inset 0 0 0 1px rgba(6,182,212,0.18), 0 0 28px rgba(6,182,212,0.28), 0 0 56px rgba(244,114,182,0.08)',
          },
        },
        blink:       { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        float:       { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        slideIn:     { from: { opacity: '0', transform: 'translateX(-5px)' }, to: { opacity: '1', transform: 'none' } },
        fadeUp:      { to: { opacity: '1' } },
        ticker:      { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shimmer:     { to: { backgroundPosition: '-200% 0' } },
        spinReverse: { to: { transform: 'rotate(-360deg)' } },
        pulseDot:    { '0%, 100%': { boxShadow: '0 0 4px currentColor' }, '50%': { boxShadow: '0 0 8px currentColor' } },
      },
    },
  },
  plugins: [],
}
