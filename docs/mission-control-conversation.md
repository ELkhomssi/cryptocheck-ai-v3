# Mission Control — speech-driven experience

Presentation-only. No new APIs, providers, or engines.

## Behavior

1. OS speaks one sentence at a time.
2. Each sentence unlocks a **proof** surface backed by live data:
   - `living` → real `MissionViewModel.running`
   - `feed` → `/api/intelligence-core/timeline`
   - `market` / `portfolio` → mission market + portfolio fields
   - `attention` → grounded recommendations
   - `actions` → prepared Command Center prompts
3. Mission payload refetches while speaking so living jobs can update.
4. No fake loaders, no invented counts.

Speech drives the interface. The interface proves the speech.
