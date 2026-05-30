/** Anchor `global:<ix>` discriminators (sha256 first 8 bytes). */

export const IX = {
  initializePool: Buffer.from([95, 180, 10, 172, 84, 174, 232, 40]),
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
  graduate: Buffer.from([45, 235, 225, 181, 17, 218, 64, 130]),
} as const
