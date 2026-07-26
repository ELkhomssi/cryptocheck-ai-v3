# Phase 15 — OS 2.0 IA (reorganize, don't regenerate)

## Confirmation

Phase 10–14 infrastructure stays: providers, scan gateway, employees/orchestrator,
execution guardrails, design tokens. This phase is presentation/IA only.

## Reachability map

| Former primary nav | New location |
|---|---|
| Screener | Market Intelligence → Discovery |
| Watchlist | Market Intelligence → Tracked |
| Alerts | Mission Feed (`nav=feed`) + aside condensed feed |
| AI Employees | Settings → Advanced · Intelligence Engine · `/settings/intelligence-engine` (legacy `/ai-employees` redirects) |
| AI Coach | Aside rail (still) · `nav=coach` legacy |
| Portfolio / Trade | Portfolio Intelligence / Trading (reframed copy/layout) |
| — | Mission Control (new home, default) |
| — | Automation (recipes → agent runs) |
| — | LaunchLab nav gate → existing `/launchLab` until 15.9 |

## Motion

Skeletons / spinners must bind to React Query `isLoading` / `isFetching` / mutation pending.
Ticker scroll remains data-driven (live quotes). Decorative infinite pulses outside pending states are out of scope for desk surfaces; reduced-motion already disables ticker/skeleton in `theme.css`.

## LaunchLab 15.9

Deferred until 15.1–15.8 are stable. Nav item is honest about the gate.
