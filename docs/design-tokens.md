# Design token enforcement (Phase 12 · Phase 19 signal · Polish sprint)

## Source of truth

| Concern | File |
|---|---|
| Color (global / portfolio desk) | [`styles/tokens.css`](../styles/tokens.css) |
| Spacing / radius / shadow / motion / weights | same (`--space-*`, `--radius-*`, `--shadow-*`, `--motion-*`, `--fw-*`) |
| Terminal OS palette + chrome aliases | [`styles/terminal-os.css`](../styles/terminal-os.css) (`[data-tos]`) |
| Intelligence Chart engine→color map | [`features/intelligence-chart/visual-tokens.ts`](../features/intelligence-chart/visual-tokens.ts) |

Polish inventory + canon: [`docs/polish/TOKEN_INVENTORY.md`](./polish/TOKEN_INVENTORY.md), [`docs/polish/TOKEN_CANON.md`](./polish/TOKEN_CANON.md).

## Check before merge

```bash
npm run lint:tokens
```

Fails on:

1. Hex / `rgb()` / colored Tailwind utilities outside allowlisted token files, in:
   - `components/portfolio-desk/**`, `app/terminal/**`, `app/ai-employees/**`, `lib/portfolio-desk/**`
   - `features/execution-desk/**`, `features/terminal-os/shell/**`, `features/terminal-os/shared/**`
2. Raw `px` `box-shadow` (non-`var`) and off-scale unitless spacing in Priority 1 polish scopes.

## Pre-commit (optional)

```sh
npx husky add .husky/pre-commit "npm run lint:tokens"
```

## New tokens

Do **not** invent hex shades or one-off durations. Extend `styles/tokens.css` (or TOS aliases) first.
