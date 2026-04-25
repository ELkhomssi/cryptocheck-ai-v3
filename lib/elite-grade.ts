/** Elite tier ladder — safety-oriented score 0–100 (higher = safer). */

export type EliteTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

export type EliteGrade = {
  tier: EliteTier
  /** Short label for UI */
  label: string
  /** When S tier — shareable certification copy */
  certificationLine: string
  /** Cyber lime safe vs blood orange threat accent */
  accent: 'safe' | 'mid' | 'threat'
}

export function safetyScoreToEliteGrade(score: number): EliteGrade {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  if (s >= 92) {
    return {
      tier: 'S',
      label: 'Iron Dome Certified',
      certificationLine: 'Protocol integrity within elite band — Attack surface minimized under Zero-Day heuristics.',
      accent: 'safe',
    }
  }
  if (s >= 85)
    return { tier: 'A', label: 'Hardened', certificationLine: 'Strong defensive posture.', accent: 'safe' }
  if (s >= 75) return { tier: 'B', label: 'Stable', certificationLine: 'Acceptable risk envelope.', accent: 'safe' }
  if (s >= 60) return { tier: 'C', label: 'Elevated exposure', certificationLine: 'Review attack surface before size.', accent: 'mid' }
  if (s >= 45) return { tier: 'D', label: 'Compromised confidence', certificationLine: 'Malicious payload risk non-trivial.', accent: 'threat' }
  return { tier: 'F', label: 'Critical threat band', certificationLine: 'Do not deploy capital — rug / honeypot vectors likely.', accent: 'threat' }
}
