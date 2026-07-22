"use client";

import { useState } from "react";

const EXAMPLES = [
  "Analyze BONK",
  "Why did risk increase?",
  "Show smart money accumulation today",
  "Find low-risk AI tokens",
  "Compare BONK vs WIF",
  "Find wallets similar to this wallet",
  "Explain this whale movement",
];

export function CopilotPromptBar({
  onSubmit,
  busy,
  sample,
}: {
  onSubmit: (prompt: string) => void;
  busy?: boolean;
  sample: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    onSubmit(t);
    setValue("");
  };

  return (
    <section className="tit-copilot-prompt" aria-label="Intelligence prompt">
      <div className="tit-copilot-prompt-head">
        <p className="tit-eyebrow">Intelligence prompt</p>
        {sample ? <span className="tit-sample-tag">sample</span> : null}
      </div>
      <div className="tit-copilot-prompt-row">
        <input
          className="tit-copilot-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask CryptoCheck AI…"
          aria-label="Ask CryptoCheck AI"
          disabled={busy}
        />
        <button type="button" className="tit-copilot-ask" onClick={submit} disabled={busy || !value.trim()}>
          Run
        </button>
      </div>
      <div className="tit-copilot-examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="tit-copilot-chip"
            onClick={() => onSubmit(ex)}
            disabled={busy}
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  );
}
