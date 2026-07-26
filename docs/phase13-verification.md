# Phase 13 verification (theme leakage + chip hierarchy)

## Code verification (13.1–13.4)

| Check | Result |
|-------|--------|
| TickerTape background | `var(--bg)` + `color: var(--text)` — themes with page |
| TeamOverview / pd-mcard | `var(--surface)` / `var(--text)` / `var(--text-faint)` |
| Aside column | `var(--bg)` (same as shell) — no elevated “dark column” |
| Alerts enclosing card | Removed; sections separated by `--border-soft` hairlines |
| Filter/preference chips | `FilterChip` / `.pd-chip` — transparent default, `--accent-soft` selected, **never** solid `--accent` |
| `.pd-tab.is-active` | Soft selected (same hierarchy) so range/screener tabs aren’t solid walls |
| Primary CTAs (`.pd-connect`, ask-send) | Still solid `--accent` + `--on-accent` |
| `--on-accent` contrast | Dark `#12100a` on brass; light `#ffffff` on deeper accent |

## Manual UI check (required after deploy)

1. Open `/ai-employees` and `/terminal?nav=alerts` in **dark**, then toggle **light**.
2. Confirm ticker, team stats, and right AI Alerts column all flip — nothing stays black in light mode.
3. Confirm chips are outline / soft tint only; only one solid brass button per employee card (Chat / View Report / …).
4. Confirm AI Alerts is three sections (header · filters · preferences), not one heavy box.

## Known follow-ups

- Screener “New Launches” empty when Birdeye new-listing feed is empty (Phase 12 note) — unrelated to theme.
- Legacy dashboard outside portfolio-desk still has its own palette (out of Phase 13 scope).
