"use client";

import { useMemo, useState } from "react";
import {
  type CopilotSession,
  formatCopilotTime,
  modeLabel,
} from "@/lib/trading-terminal/ai-copilot";

export function CopilotHistoryPanel({
  sessions,
  activeId,
  onSelect,
  onNew,
  onTogglePin,
  onToggleBookmark,
}: {
  sessions: CopilotSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onTogglePin: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...sessions].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
    if (!q) return list;
    return list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.prompts.some((p) => p.toLowerCase().includes(q)) ||
        (s.contextMode && modeLabel(s.contextMode).toLowerCase().includes(q)),
    );
  }, [sessions, query]);

  return (
    <aside className="tit-copilot-history" aria-label="Conversation history">
      <header className="tit-copilot-panel-head">
        <div>
          <p className="tit-eyebrow">Sessions</p>
          <h2 className="tit-copilot-panel-title">History</h2>
        </div>
        <button type="button" className="tit-copilot-new" onClick={onNew}>
          New
        </button>
      </header>

      <label className="tit-copilot-search">
        <input
          className="tit-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search investigations…"
          aria-label="Search history"
        />
      </label>

      <ul className="tit-copilot-history-list">
        {filtered.length === 0 ? (
          <li className="tit-copilot-empty">No sessions match</li>
        ) : (
          filtered.map((s) => (
            <li key={s.id} className={`tit-copilot-hist-item${activeId === s.id ? " is-active" : ""}`}>
              <button type="button" className="tit-copilot-hist-main" onClick={() => onSelect(s.id)}>
                <div className="tit-copilot-hist-row1">
                  <span className="tit-copilot-hist-title">{s.title}</span>
                  <time className="tit-mono">{formatCopilotTime(s.updatedAt)}</time>
                </div>
                <div className="tit-copilot-hist-meta">
                  {s.contextMode ? <span>{modeLabel(s.contextMode)}</span> : <span>Idle</span>}
                  <span>{s.responses.length} analyses</span>
                  {s.sample ? <span className="tit-sample-tag">sample</span> : null}
                </div>
              </button>
              <div className="tit-copilot-hist-actions">
                <button
                  type="button"
                  className={s.pinned ? "is-on" : undefined}
                  title="Pin"
                  onClick={() => onTogglePin(s.id)}
                >
                  Pin
                </button>
                <button
                  type="button"
                  className={s.bookmarked ? "is-on" : undefined}
                  title="Bookmark"
                  onClick={() => onToggleBookmark(s.id)}
                >
                  Mark
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
