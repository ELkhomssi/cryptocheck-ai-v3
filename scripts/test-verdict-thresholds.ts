import { scoreToVerdict } from '../lib/sentinel/verdict-thresholds'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const cases: Array<{ score: number; verdict: string }> = [
  { score: 100, verdict: 'SAFE' },
  { score: 80, verdict: 'SAFE' },
  { score: 79, verdict: 'CAUTION' },
  { score: 60, verdict: 'CAUTION' },
  { score: 59, verdict: 'HIGH_RISK' },
  { score: 40, verdict: 'HIGH_RISK' },
  { score: 39, verdict: 'AVOID' },
  { score: 0, verdict: 'AVOID' },
]

for (const { score, verdict } of cases) {
  const got = scoreToVerdict(score).verdict
  assert(got === verdict, `scoreToVerdict(${score}) expected ${verdict}, got ${got}`)
}

console.log('verdict-thresholds: ok', cases.length, 'cases')
