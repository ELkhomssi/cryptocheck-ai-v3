# Mission Control — conversation rebuild

Presentation-only. No providers, APIs, DB, or engines changed.

Mission Control is a **conversation**:
1. OS speaks a briefing assembled from `MissionViewModel`
2. Asks “What would you like me to do?”
3. Command Center listens (existing `/api/portfolio/coach`)
4. Timeline stays chronological under the fold

If data is missing, it says so — never invents whale/liquidity/opportunity stats.
