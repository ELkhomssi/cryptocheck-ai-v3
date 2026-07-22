# PART II — Intelligence Engines

## Shipped

| Prompt | Module | Behavior |
|--------|--------|----------|
| 14 Opportunity | `opportunity-engine.ts` | Conviction from measured SM/LP/holders/insider/age + weights. Thin/EXITING → null. |
| 15 Causal attribution | `causal-attribution.ts` | Model share % of drivers (sum ≈ 100 for up factors). Disclaimer always attached. |
| 17 Action Queue | `action-queue.ts` | Merges threats + opportunities; priority = severity + confidence + focus. |
| 21 Wallet Coach | `wallet-coach.ts` | Defense + offense nudges; silent when thin. |
| 22 Terminal alerts | `alerts-engine.ts` | Ranks intel/threats/opps/nudges; prefs for severity + mute. Live: threats only (no fabricated market intel). |
| Façade | `resolve-intelligence.ts` | Demo runs full stack; live honest empties for unwired feeds. |

## Hard rule

Percentages / conviction / attribution must be **derived + method-tagged + confidence-scaled**. UI never invents scores in JSX.

## UI wiring

- `AiIntelligenceWorkstation` → hero, Why Now % bars, queue, coach, alerts
- `ConvictionRadar` → ranked opportunities

## Still deferred

- Live SM/LP/holder feed adapters
- Full insider graph (18)
- Toast/drawer prefs UI for alerts (engine + column list shipped)
- Causal live adapters beyond demo measured inputs
