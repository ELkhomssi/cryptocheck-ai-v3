# Extension package boundary fixes (2026-05-28)

- `PopupShell.tsx` — replaced missing `@/components/.../IntelReportCards` with local `src/components/IntelReportCards.tsx` stub (`IntelReportCardsView`).
- `ExtensionTerminalProvider.tsx` — moved `KeyVerifySuccess` / `TokenIntelligenceReport` types to `src/types.ts` (copied from `lib/types/intelligence.ts`).
- `ExtensionTerminalProvider.tsx` — moved `terminalReducer` to `src/lib/terminal-reducer.ts` (copied from `components/Dashboard/intelligence-terminal/terminal-reducer.ts`).
- `tsconfig.json` — removed `@/*` → monorepo root path alias so the extension cannot resolve app imports.
