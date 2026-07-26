# Design token enforcement (Phase 12)

## Source of truth

All terminal colors live in [`styles/tokens.css`](../styles/tokens.css).
Portfolio-desk aliases (`--pd-*`) are defined there too.

## Check before merge

```bash
npm run lint:tokens
```

Fails if hex / `rgb()` / `rgba()` / non-neutral Tailwind color utilities appear under:

- `components/portfolio-desk/**`
- `app/terminal/**`
- `app/ai-employees/**`
- `lib/portfolio-desk/**`

…except `styles/tokens.css`.

## Pre-commit (optional)

If you use husky:

```sh
npx husky add .husky/pre-commit "npm run lint:tokens"
```

Until CI includes this script, run `npm run lint:tokens` manually before every merge that touches the terminal.

## New tokens

Do **not** invent hex shades. If a needed color is missing from the Phase 12 list, ask before adding a token.
