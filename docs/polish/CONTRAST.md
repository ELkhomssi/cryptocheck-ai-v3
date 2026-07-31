# Contrast re-check (Priority 1 · polish)

Foreground / background pairs from TOS tokens after muted lift (`#858074`).

| Pair | Ratio | WCAG AA (normal text ≥4.5) |
|---|---|---|
| `--tos-text-primary` `#f5f5f2` on `--tos-bg-app` `#050505` | 18.66 | Pass |
| `--tos-text-secondary` `#9a9588` on app | 6.82 | Pass |
| `--tos-text-muted` `#858074` on app | 5.18 | Pass |
| Primary on `--tos-bg-panel` `#0a0a0a` | 18.13 | Pass |
| Secondary on panel | 6.63 | Pass |
| Muted on panel | 5.03 | Pass |
| Ink `#050505` on gold CTA `#d4af37` | 9.69 | Pass |

Gold-on-dark for brand marks remains decorative; interactive gold buttons use dark ink on gold fill.
