# Package boundary audit (`packages/`)

**Audit date:** 2026-05-28

## Packages discovered

| Package | Path | Purpose |
|---------|------|---------|
| `cryptocheck-extension` | `packages/extension/` | Chrome extension (Vite + React) |

No `packages/ccai-connect`, `packages/cryptocheck-signing`, or `packages/cryptocheck-types` present (planned in migration).

---

## `packages/extension`

### `npx tsc --noEmit`

**Result:** ❌ **FAIL**

```
src/popup/PopupShell.tsx(1,38): error TS2307: Cannot find module '@/components/Dashboard/intelligence-terminal/IntelReportCards'
```

The extension references a monorepo path (`@/components/...`) that is not configured in `packages/extension/tsconfig.json`. This violates package isolation.

### `grep -r "@/" packages/` (excluding node_modules, dist)

**Result:** ❌ **FAIL** — at least one violation:

- `packages/extension/src/popup/PopupShell.tsx` → `@/components/Dashboard/intelligence-terminal/IntelReportCards`

### `grep -r "from 'next'" packages/`

**Result:** ✅ **PASS** — zero `from 'next'` imports in extension source.

---

## Root app (`lib/sdk/cryptocheck-sdk.ts`)

Not under `packages/` but relevant to Connect boundary:

- Imports `@/lib/security/signing/env` — **not publishable** as standalone npm package without extraction.

---

## Pass criteria for migration complete

| Check | Extension | ccai-connect (planned) |
|-------|-----------|------------------------|
| `tsc --noEmit` | pass | pass |
| zero `@/` imports | pass | pass |
| zero `from 'next'` | pass | pass (library) |
| no imports from `lib/services/scanner` | N/A | pass |

**Remediation for extension:** Copy or share UI via `packages/terminal-widgets` with explicit exports; extension should call HTTP API only (`src/lib/api-client.ts` already does for data).
