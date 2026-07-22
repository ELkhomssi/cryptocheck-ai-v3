"use client";

import type { CopilotSource } from "@/lib/trading-terminal/ai-copilot";

export function CopilotSourcesPanel({ sources }: { sources: CopilotSource[] }) {
  return (
    <aside className="tit-copilot-sources" aria-label="Intelligence sources">
      <header className="tit-copilot-panel-head">
        <div>
          <p className="tit-eyebrow">Sources</p>
          <h2 className="tit-copilot-panel-title">Intelligence Sources</h2>
        </div>
      </header>

      <ul className="tit-copilot-sources-list">
        {sources.map((s) => (
          <li key={s.id} className={`tit-copilot-source status-${s.status}`}>
            <div className="tit-copilot-source-row1">
              <span className="tit-copilot-source-label">{s.label}</span>
              <span className={`tit-copilot-status status-${s.status}`}>{s.status}</span>
            </div>
            <p className="tit-copilot-source-detail">{s.detail}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
