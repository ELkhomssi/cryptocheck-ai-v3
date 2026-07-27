# Mission Control — Intelligence Core OS

Presentation-only. Existing Mission / Recommendation / Timeline / Automation / Modules engines only.

## Contract

Mission Control is **not** a chatbot.

- No chat input, Send button, or coach stream
- No OpenAI dependency for the page to render
- No “While you were away…” conversational theatre
- No offline / API-key / provider error exposure on this surface

## Surface

Deterministic operating picture from `GET /api/intelligence-core/mission` (+ timeline + modules):

1. Status line (priorities · automation)
2. Priorities — Recommendation Engine
3. Market + Portfolio glances
4. Daily brief — Mission Engine
5. Automation pulse
6. Timeline — Mission Feed
7. Intelligence Modules grid

Deep-links open Market / Portfolio / Feed / Automation workspaces. Never seeds a chat.
