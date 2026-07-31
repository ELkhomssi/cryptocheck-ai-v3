# Canonical design tokens — Polish sprint Step 2

Source of truth for spacing, radius, shadow, type weight, and motion:

1. [`styles/tokens.css`](../../styles/tokens.css) — global scales (`--space-*`, `--radius-*`, `--shadow-*`, `--motion-*`, `--fw-*`)
2. [`styles/terminal-os.css`](../../styles/terminal-os.css) — TOS color palette + aliases under `[data-tos]`

**Rule:** Outside those files (plus IC `visual-tokens.ts` for chart engine colors), do not introduce raw hex, raw `px` shadows, or off-scale spacing. Enforced by `npm run lint:tokens`.

## Motion doctrine (app-wide)

| Bucket | Token | Duration | Easing | Use |
|---|---|---|---|---|
| Micro | `--motion-micro` | 150ms | `--ease-micro` (ease-out) | hover, focus, press |
| Panel | `--motion-panel` | 240ms | `--ease-panel` (ease-in-out) | open/close, route chrome |
| State | `--motion-state` | 320ms | `--ease-state` | loading→data, success/error |

Nothing else animates for “feel.” Looping instrument indicators use `--motion-loop-slow` / `--motion-loop-scan` only where the system is showing continuous liveness.
