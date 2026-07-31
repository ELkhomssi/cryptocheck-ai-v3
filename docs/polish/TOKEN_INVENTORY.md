# Design token inventory — Polish sprint Step 1

**Scope scanned:** Terminal OS chrome, Intelligence Chart, Execution Desk, `app/terminalOS`  
**Date:** 2026-07-31  
**Machine output:** [`token-inventory.json`](./token-inventory.json)  
**Files scanned:** 89

This inventory was generated **before** any presentation fixes. Canonical collapses are defined in Step 2 ([`TOKEN_CANON.md`](./TOKEN_CANON.md)).

---

## border-radius — 23 distinct → collapse to 4

| Current values | Count / notes |
|---|---|
| `0` | panels flush |
| `0.2–0.85rem` (≈12 rem fractions) | TOS / IC sprawl |
| `2px`, `3px`, `4px`, `8px`, `10px` | inline + Execution Desk |
| `50%`, `999px` | pills / dots |
| `var(--tos-radius)`, `var(--tos-radius-sm)` | already tokenized |

**Keep:** `0`, `--radius-sm` (0.25rem), `--radius-md` (0.5rem), `--radius-lg` (0.75rem), `--radius-full` (999px).

---

## box-shadow — 24 distinct → collapse to 3 elevations + focus ring

Most are gold glow variants in `styles/terminal-os.css`. Collapse decorative glows to:

- `--shadow-1` — panel lift  
- `--shadow-2` — modal / elevated  
- `--shadow-focus` — focus ring  
- `--shadow-glow` — single accent ambient (replaces 10–28px gold variants)

---

## spacing (padding / margin / gap) — 52 distinct → 7-step scale

Raw literals include `2–14px`, many `0.1–0.875rem` fractions, and unitless React style numbers (`8`, `10`, `12`).

**Canonical (`--space-*`):**

| Token | rem | ≈px @16 |
|---|---|---|
| `--space-1` | 0.25rem | 4 |
| `--space-2` | 0.5rem | 8 |
| `--space-3` | 0.75rem | 12 |
| `--space-4` | 1rem | 16 |
| `--space-5` | 1.5rem | 24 |
| `--space-6` | 2rem | 32 |
| `--space-8` | 3rem | 48 |

Hairlines stay `1px` (borders only — not spacing).

---

## font-size — 16 distinct → TOS type scale

| Current | Map to |
|---|---|
| `9–10px`, `0.5–0.5625rem` | `--tos-fs-xs` (0.625rem) |
| `11px`, `0.75rem` | `--tos-fs-sm` |
| `12–13px` | `--tos-fs-md` |
| `18px`, `1.125rem+` | `--tos-fs-lg` / `--tos-fs-xl` |

---

## font-weight — 4 distinct

`600`, `700`, `800`, `900` — keep as `--fw-semibold|bold|extrabold|black`. Prefer `700` for UI chrome; reserve `800` for brand marks.

---

## animation / transition duration — 17 distinct → 3 buckets

| Current | Bucket |
|---|---|
| `120ms`, `0.15s`, `0.16s`, `0.18s` | **micro** 150ms ease-out |
| `0.25s`, `280ms` | **panel** 240ms ease-in-out |
| `0.35–0.45s`, `400ms`, `0.7s` (metric ignite) | **state** 320ms state-ease |
| `1.2s+` loops / marquee | keep as `--motion-loop-*` (instrument alive, not decoration-per-component) |

---

## easing — 4 distinct → 3 named

- `--ease-micro`: `ease-out`  
- `--ease-panel`: `ease-in-out`  
- `--ease-state`: `cubic-bezier(0.22, 1, 0.36, 1)` (IC “AI noticed” signature)

---

## raw hex — 88 distinct

Allowed **only** in:

- `styles/tokens.css` (global palette)  
- `styles/terminal-os.css` (`[data-tos]` palette)  
- `features/intelligence-chart/visual-tokens.ts` (engine→color map for ECharts)

Priority 1 violation hotspot: `features/execution-desk/styles.css` + chart canvas hardcoded hex — migrate to `var(--tos-*)`.

---

## Priority 1 checklist (Step 3)

- [x] Terminal OS home / Mission Control chrome (`terminal-os.css`, shell)
- [x] Intelligence Chart (`styles.css` motion tokens)
- [x] Execution Desk (full token migration)
- [x] Wallet connect control (TopBar)
- [x] Search (TopBar)
- [x] Primary navigation (LeftRail)

## Priority 2 checklist

- [x] Portfolio Overview metrics
- [x] Scanner (Token / Wallet score cards + ScoreRing)
- [x] Market Intel (overview + top tokens tabs)
- [x] Whale Tracking (already on TOS CSS chrome)
- [x] Trade Like Me rail / status / alerts
- [x] Discovery + Workforce + Coach chrome (high-visit adjacent)
