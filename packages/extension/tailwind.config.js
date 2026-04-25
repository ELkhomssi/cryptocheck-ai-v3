/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Shared UI pulled in via Vite alias `@/` (intel report cards, etc.)
    '../../components/**/*.{tsx,ts}',
    '../../lib/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // System-first stack (no remote fonts — reliable under extension CSP)
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Inter',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        cc: {
          cyan: '#00d4aa',
        },
        'neon-indigo': '#00d4aa',
        'terminal-ok': '#00d4aa',
      },
      boxShadow: {
        glass: '0 12px 48px rgba(0, 0, 0, 0.5)',
        'cc-glow': '0 0 32px -6px rgba(0, 212, 170, 0.45)',
        'cc-glow-lg': '0 0 48px -8px rgba(0, 212, 170, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
