export const DISCLAIMER_VERSION = '2026-04-v1'

export const DISCLAIMER_TEXT_FULL = `
CryptoCheck AI is an AI-powered observational intelligence tool. We provide on-chain data analysis and pattern recognition — not financial advice, investment recommendations, or trading signals.

Past performance and historical patterns do not predict future results. Cryptocurrency markets are volatile and high-risk. You may lose some or all of the capital you deploy.

CryptoCheck AI, Inc. is not responsible for any financial losses or gains resulting from your trading decisions. By proceeding, you acknowledge that all trading activity is conducted at your own risk and judgment.
`.trim()

export const DISCLAIMER_TEXT_SHORT = {
  default:
    'Informational only. Not financial advice. Cryptocurrency trading carries risk of loss.',
  ai: 'AI-generated analysis. Informational only — not a recommendation. Always do your own research.',
  whale: 'On-chain observations. Past patterns do not predict future results.',
} as const

export type DisclaimerVariant = keyof typeof DISCLAIMER_TEXT_SHORT
