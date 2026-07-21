# PART II — Intelligence Engines (slice)

Shipped on `cursor/terminal-part2-engines-5f9e`.

## What this slice delivers

| Prompt | Module | Behavior |
|--------|--------|----------|
| 14 Opportunity Engine | `engines/opportunity-engine.ts` | Conviction derived from measured SM / LP / holders / insider / pool age + documented weights. Thin or EXITING → `null`. |
| 17 Action Queue | `engines/action-queue.ts` | Merges portfolio threats + ranked opportunities; priority = severity + confidence + focus boost. |
| 21 Wallet Coach | `engines/wallet-coach.ts` | Defense + offense nudges with evidence; silent when offense evidence is thin. |
| Façade | `engines/resolve-intelligence.ts` | Demo runs engines on DEMO measured inputs; live returns portfolio actions only until SM/LP feeds wire. |

## Hard rule

Percentages / conviction must be **derived + method-tagged + confidence-scaled**. UI never invents scores in JSX.

## UI wiring

- `AiIntelligenceWorkstation` → hero, queue, coach nudges from `resolveIntelligence`
- `ConvictionRadar` (bottom strip) → ranked `opportunities`

## Not in this slice

- Causal attribution (15), full insider graph (18), alerts engine (22), live SM/LP/holder feeds
