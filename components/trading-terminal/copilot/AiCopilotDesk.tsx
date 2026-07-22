"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  type CopilotSession,
  appendToSession,
  buildCopilotDesk,
  createCopilotSession,
  runCopilotPrompt,
} from "@/lib/trading-terminal/ai-copilot";
import type { TerminalDataMode } from "@/lib/trading-terminal/data/types";
import { CopilotPromptBar } from "./CopilotPromptBar";
import { CopilotHistoryPanel } from "./CopilotHistoryPanel";
import { CopilotResponseWorkspace } from "./CopilotResponseWorkspace";
import { CopilotSourcesPanel } from "./CopilotSourcesPanel";

export function AiCopilotDesk({ mode }: { mode: TerminalDataMode }) {
  const seed = useMemo(() => buildCopilotDesk(mode), [mode]);
  const [sessions, setSessions] = useState<CopilotSession[]>(seed.sessions);
  const [activeId, setActiveId] = useState<string | null>(seed.sessions[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSessions(seed.sessions);
    setActiveId(seed.sessions[0]?.id ?? null);
  }, [seed]);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null;

  const runPrompt = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    startTransition(() => {
      setSessions((prev) => {
        let list = prev;
        let sess = list.find((s) => s.id === activeId) ?? list[0];
        if (!sess) {
          sess = createCopilotSession(mode === "demo");
          list = [sess];
        }
        const response = runCopilotPrompt({
          prompt: text,
          dataMode: mode,
          priorMode: sess.contextMode,
          contextSymbol: sess.contextSymbol,
        });
        const next = appendToSession(sess, response);
        setActiveId(next.id);
        return list.map((s) => (s.id === sess!.id ? next : s));
      });
    });
  };

  const onNew = () => {
    const sess = createCopilotSession(mode === "demo");
    setSessions((prev) => [sess, ...prev]);
    setActiveId(sess.id);
  };

  const toggleFlag = (id: string, key: "pinned" | "bookmarked") => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: !s[key], updatedAt: new Date().toISOString() } : s)),
    );
  };

  return (
    <div className="tit-copilot-desk" data-mode={mode}>
      <header className="tit-copilot-desk-banner">
        <div>
          <p className="tit-eyebrow">Institutional module</p>
          <h1 className="tit-copilot-desk-title">AI Copilot</h1>
        </div>
        <p className="tit-copilot-desk-sub">
          Central intelligence · scanner · whale · alpha · portfolio · market
        </p>
        {seed.sample ? (
          <span className="tit-sample-tag" title="Demo copilot desk">
            sample
          </span>
        ) : (
          <span className="tit-copilot-live-badge">live · awaiting engines</span>
        )}
        <span className="tit-mono tit-copilot-method">{seed.methodNote}</span>
      </header>

      <CopilotPromptBar onSubmit={runPrompt} busy={pending} sample={seed.sample} />

      <div className="tit-copilot-desk-grid">
        <CopilotHistoryPanel
          sessions={sessions}
          activeId={active?.id ?? null}
          onSelect={setActiveId}
          onNew={onNew}
          onTogglePin={(id) => toggleFlag(id, "pinned")}
          onToggleBookmark={(id) => toggleFlag(id, "bookmarked")}
        />
        <CopilotResponseWorkspace
          responses={active?.responses ?? []}
          onFollowUp={runPrompt}
        />
        <CopilotSourcesPanel sources={seed.sources} />
      </div>
    </div>
  );
}
