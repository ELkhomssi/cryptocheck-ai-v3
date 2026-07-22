"use client";

import {
  type CopilotResponse,
  formatCopilotTime,
  modeLabel,
} from "@/lib/trading-terminal/ai-copilot";

function Meter({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const high = value >= 75;
  const mid = value >= 50;
  const tone = invert
    ? high
      ? "neg"
      : mid
        ? "warn"
        : "pos"
    : high
      ? "pos"
      : mid
        ? "warn"
        : "neg";
  return (
    <div className={`tit-copilot-meter tone-${tone}`}>
      <div className="tit-copilot-meter-head">
        <span>{label}</span>
        <span className="tit-mono">{value.toFixed(0)}</span>
      </div>
      <div className="tit-copilot-meter-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ResponseCard({
  response,
  onFollowUp,
}: {
  response: CopilotResponse;
  onFollowUp: (prompt: string) => void;
}) {
  return (
    <article className={`tit-copilot-card${response.insufficientData ? " is-insufficient" : ""}`}>
      <header className="tit-copilot-card-head">
        <div>
          <p className="tit-eyebrow">{modeLabel(response.mode)}</p>
          <h3 className="tit-copilot-card-prompt">{response.prompt}</h3>
        </div>
        <time className="tit-mono">{formatCopilotTime(response.at)}</time>
        {response.sample ? <span className="tit-sample-tag">sample</span> : null}
        {response.insufficientData ? (
          <span className="tit-copilot-insufficient-badge">INSUFFICIENT DATA</span>
        ) : null}
      </header>

      <section className="tit-copilot-block">
        <h4>Summary</h4>
        <p>{response.summary}</p>
      </section>

      {response.tokenMetrics ? (
        <section className="tit-copilot-metrics">
          <h4>Token Analysis · {response.tokenMetrics.symbol}</h4>
          <div className="tit-copilot-metrics-grid">
            <Meter label="Risk Score" value={response.tokenMetrics.riskScore} invert />
            <Meter label="Holder Quality" value={response.tokenMetrics.holderQuality} />
            <Meter label="Liquidity Health" value={response.tokenMetrics.liquidityHealth} />
            <Meter label="Whale Activity" value={response.tokenMetrics.whaleActivity} />
            <Meter label="Alpha Score" value={response.tokenMetrics.alphaScore} />
            <Meter label="Narrative Strength" value={response.tokenMetrics.narrativeStrength} />
            <Meter label="Confidence" value={response.tokenMetrics.confidence} />
          </div>
        </section>
      ) : null}

      {response.portfolioMetrics ? (
        <section className="tit-copilot-metrics">
          <h4>Portfolio Analysis</h4>
          <div className="tit-copilot-metrics-grid">
            <Meter label="Portfolio Health" value={response.portfolioMetrics.healthScore} />
            <Meter label="Risk Exposure" value={response.portfolioMetrics.riskExposure} invert />
            <Meter label="Sector Concentration" value={response.portfolioMetrics.sectorConcentration} invert />
            <Meter label="Whale Alignment" value={response.portfolioMetrics.whaleAlignment} />
          </div>
          <ul className="tit-copilot-list">
            {response.portfolioMetrics.suggestedActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {response.reportSections ? (
        <section className="tit-copilot-report">
          <div className="tit-copilot-report-head">
            <h4>Research Report</h4>
            <span className="tit-copilot-export">Export Ready</span>
          </div>
          {response.reportSections.map((s) => (
            <div key={s.id} className="tit-copilot-report-sec">
              <h5>{s.title}</h5>
              <p>{s.body}</p>
            </div>
          ))}
        </section>
      ) : null}

      <div className="tit-copilot-cols">
        <section className="tit-copilot-block">
          <h4>Key Findings</h4>
          <ul className="tit-copilot-list">
            {response.keyFindings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        <section className="tit-copilot-block tone-risk">
          <h4>Risk Factors</h4>
          <ul className="tit-copilot-list">
            {response.riskFactors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        <section className="tit-copilot-block tone-opp">
          <h4>Opportunities</h4>
          <ul className="tit-copilot-list">
            {response.opportunities.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="tit-copilot-card-foot">
        <div className="tit-copilot-conf">
          <span>Confidence</span>
          <span className="tit-mono">
            {response.confidence == null ? "—" : response.confidence.toFixed(0)}
          </span>
        </div>
        <div className="tit-copilot-sources-used">
          <span>Data sources used</span>
          <div>
            {response.sourcesUsed.length === 0 ? (
              <em>none</em>
            ) : (
              response.sourcesUsed.map((s) => (
                <span key={s} className="tit-copilot-src-chip">
                  {s}
                </span>
              ))
            )}
          </div>
        </div>
      </footer>

      {response.followUps.length > 0 ? (
        <div className="tit-copilot-followups">
          <p className="tit-eyebrow">Follow-up</p>
          <div className="tit-copilot-examples">
            {response.followUps.map((f) => (
              <button key={f} type="button" className="tit-copilot-chip" onClick={() => onFollowUp(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function CopilotResponseWorkspace({
  responses,
  onFollowUp,
}: {
  responses: CopilotResponse[];
  onFollowUp: (prompt: string) => void;
}) {
  return (
    <section className="tit-copilot-workspace" aria-label="AI response workspace">
      <header className="tit-copilot-panel-head">
        <div>
          <p className="tit-eyebrow">Workspace</p>
          <h2 className="tit-copilot-panel-title">Intelligence Output</h2>
        </div>
      </header>

      <div className="tit-copilot-workspace-scroll">
        {responses.length === 0 ? (
          <p className="tit-copilot-empty">
            Submit a prompt to begin a multi-step investigation. Outputs always include summary,
            findings, risks, opportunities, confidence, and cited sources.
          </p>
        ) : (
          responses.map((r) => <ResponseCard key={r.id} response={r} onFollowUp={onFollowUp} />)
        )}
      </div>
    </section>
  );
}
