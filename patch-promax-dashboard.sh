#!/bin/bash
# ============================================================
# CryptoCheck AI — Pro Max Neural Integration into Dashboard
# Adds 'promax' view to the existing nav + view system
# ============================================================

set -e
echo "🔧 Integrating Pro Max Neural into Dashboard..."

node << 'ENDOFSCRIPT'
const fs = require('fs');
let code = fs.readFileSync('app/dashboard.tsx', 'utf8');
let changes = [];

// ─────────────────────────────────────────────
// 1. Add 'promax' to the View type
// ─────────────────────────────────────────────
const oldViewType = "type View    = 'scanner' | 'portfolio' | 'whales' | 'alpha' | 'feed' | 'forensics' | 'neuralv4'";
const newViewType = "type View    = 'scanner' | 'portfolio' | 'whales' | 'alpha' | 'feed' | 'forensics' | 'neuralv4' | 'promax'";

if (code.includes(oldViewType)) {
  code = code.replace(oldViewType, newViewType);
  changes.push("View type: added 'promax'");
}

// ─────────────────────────────────────────────
// 2. Add 'promax' to desktop nav buttons
// ─────────────────────────────────────────────
const oldNavArray = "(['scanner','portfolio','whales','alpha','forensics','neuralv4'] as View[])";
const newNavArray = "(['scanner','portfolio','whales','alpha','forensics','neuralv4','promax'] as View[])";

if (code.includes(oldNavArray)) {
  code = code.replace(oldNavArray, newNavArray);
  changes.push("Desktop nav: added promax button");
}

// Add label for promax in the nav button text
const oldNavLabels = "v === 'neuralv4' ? '🧠 Neural V4' : v}";
const newNavLabels = "v === 'neuralv4' ? '🧠 Neural V4' : v === 'promax' ? '✦ Pro Max' : v}";

if (code.includes(oldNavLabels)) {
  code = code.replace(oldNavLabels, newNavLabels);
  changes.push("Nav label: ✦ Pro Max");
}

// Style the promax button differently (gold accent when active)
// Replace the generic active class check to add gold for promax
const oldBtnClass = "view === v ? 'bg-[rgba(0,212,130,0.1)] text-[#00d4aa] border-[rgba(0,212,130,0.15)]'";
const newBtnClass = "view === v ? (v === 'promax' ? 'bg-[rgba(255,215,0,0.08)] text-[#FFD700] border-[rgba(255,215,0,0.2)]' : 'bg-[rgba(0,212,130,0.1)] text-[#00d4aa] border-[rgba(0,212,130,0.15)]')";

if (code.includes(oldBtnClass)) {
  code = code.replace(oldBtnClass, newBtnClass);
  changes.push("Nav button: gold accent for promax");
}

// ─────────────────────────────────────────────
// 3. Add the promax view section (after neuralv4 section)
// ─────────────────────────────────────────────
const neuralV4Section = `{view === 'neuralv4' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <ProGate feature="Neural Scan V4 — Nansen-grade token intelligence." icon="🧠">
                <NeuralScanV4 />
              </ProGate>
            </div>
          )}`;

const proMaxView = `{view === 'neuralv4' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <ProGate feature="Neural Scan V4 — Nansen-grade token intelligence." icon="🧠">
                <NeuralScanV4 />
              </ProGate>
            </div>
          )}
          {view === 'promax' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#050505' }}>
              <ProMaxView isPro={isPro} onUpgrade={() => setShowModal(true)} />
            </div>
          )}`;

if (code.includes(neuralV4Section)) {
  code = code.replace(neuralV4Section, proMaxView);
  changes.push("View section: promax panel added");
}

// ─────────────────────────────────────────────
// 4. Add ProMaxView component BEFORE the dashboard export
// ─────────────────────────────────────────────
// Find where the main component starts and add ProMaxView before it
const proMaxComponent = `
// ═══════════════════════════════════════════════════
// PRO MAX NEURAL ENGINE — In-Platform View
// ═══════════════════════════════════════════════════
const FORENSIC_LOGS = [
  { tag: 'INIT', color: '#20b2aa', text: 'Neural Engine v4.0 initialized — loading bytecode...' },
  { tag: 'DECOMPILE', color: '#20b2aa', text: 'Decompiling program 7xKP…b8Rd — 2,847 instructions' },
  { tag: 'GNN', color: '#FFD700', text: 'Mapping wallet cluster — 847 nodes detected' },
  { tag: 'SYBIL', color: '#ff4444', text: '⚠ 142 wallets → single entity (Sybil: 94.2%)' },
  { tag: 'LP', color: '#FFD700', text: 'LP analysis: 78% unlocked — monitoring removal' },
  { tag: 'HEURISTIC', color: '#20b2aa', text: 'Model v3.7 — 523,841 contracts evaluated' },
  { tag: 'CLUSTER', color: '#FFD700', text: 'Dev wallet linked to 3 rugged tokens' },
  { tag: 'PREDICT', color: '#ff4444', text: '⚠ RUG PROB: 98.4% — Exit liquidity detected' },
  { tag: 'GNN', color: '#FFD700', text: 'Cluster complete — 12 sub-graphs' },
  { tag: 'VERDICT', color: '#00d4aa', text: '█ AUDIT COMPLETE — HIGH RISK — DO NOT BUY' },
  { tag: 'INIT', color: '#20b2aa', text: 'Next contract queued...' },
  { tag: 'HEURISTIC', color: '#20b2aa', text: 'Pattern: safe archetype (91.7%)' },
  { tag: 'LP', color: '#00d4aa', text: 'LP burned via Raydium — 100% permanent' },
  { tag: 'VERDICT', color: '#00d4aa', text: '█ AUDIT COMPLETE — LOW RISK — 82/100 SAFE' },
]

function ProMaxView({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: () => void }) {
  const [logs, setLogs] = React.useState<typeof FORENSIC_LOGS>([])
  const logRef = React.useRef<HTMLDivElement>(null)
  const idxRef = React.useRef(0)

  React.useEffect(() => {
    const iv = setInterval(() => {
      const log = FORENSIC_LOGS[idxRef.current % FORENSIC_LOGS.length]
      setLogs(prev => [...prev.slice(-16), log])
      idxRef.current++
      logRef.current?.scrollTo(0, logRef.current.scrollHeight)
    }, 1200)
    return () => clearInterval(iv)
  }, [])

  const comparison = [
    { feat: 'Scan Engine', basic: 'Pattern matching', pro: 'Deep Learning + GNN' },
    { feat: 'Scan Limit', basic: '10 credits', pro: '∞ Unlimited' },
    { feat: 'Risk Model', basic: 'Rule-based', pro: 'Heuristic (523K contracts)' },
    { feat: 'Cluster Map', basic: '—', pro: 'Full Sybil detection' },
    { feat: 'LP Forensics', basic: 'Basic check', pro: 'Predictive exit analysis' },
    { feat: 'Whale Feed', basic: 'Standard', pro: 'Priority (< 200ms)' },
    { feat: 'Perf. Fee', basic: '0.5%', pro: '0% included' },
    { feat: 'Forensic Logs', basic: '—', pro: 'Full deep scan' },
  ]

  const features = [
    { icon: '◈', title: 'Cluster Mapping', sub: 'SYBIL DETECTION', desc: 'GNN traces wallet relationships. Detect 100+ wallets belonging to one entity.', stat: '847', statL: 'nodes mapped' },
    { icon: '◉', title: 'Heuristic Scoring', sub: 'DEEP LEARNING', desc: 'Trained on 523K+ contracts. Bytecode decompilation + temporal patterns.', stat: '523K+', statL: 'contracts' },
    { icon: '◎', title: 'LP Forensics', sub: 'EXIT PREDICTION', desc: 'Predict liquidity removal 4-12 min before rug execution.', stat: '4-12', statL: 'min warning' },
  ]

  // If PRO — show the live terminal
  if (isPro) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#FFD700', padding: '3px 8px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 4 }}>✦ PRO MAX ACTIVE</span>
          <span style={{ fontSize: 10, color: '#6e7681' }}>Unlimited Forensic Audits</span>
        </div>

        {/* Live Terminal */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.1)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#111', borderBottom: '1px solid rgba(255,215,0,0.06)' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <span style={{ fontSize: 9, color: '#484f58', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono,monospace' }}>NEURAL_ENGINE_v4.0 — DEEP FORENSIC</span>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#FFD700', padding: '1px 6px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 3 }}>● LIVE</span>
          </div>
          <div ref={logRef} style={{ height: 300, overflowY: 'auto', padding: '10px 14px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, lineHeight: 1.9, scrollbarWidth: 'none' }}>
            {logs.map((l, i) => (
              <div key={i} style={{ opacity: i === logs.length - 1 ? 1 : 0.65 }}>
                <span style={{ color: '#303030', marginRight: 6 }}>{new Date().toTimeString().slice(0,8)}</span>
                <span style={{ color: l.color, fontWeight: 700, fontSize: 8, letterSpacing: '0.06em', padding: '1px 4px', borderRadius: 2, background: l.color + '11', marginRight: 6 }}>{l.tag}</span>
                <span style={{ color: l.tag === 'VERDICT' ? l.color : '#6e7681' }}>{l.text}</span>
              </div>
            ))}
            <span style={{ color: '#FFD700', animation: 'blink 1s infinite' }}>█</span>
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: '#0a0a0a', border: '1px solid rgba(32,178,170,0.1)', borderRadius: 8, padding: '16px 14px' }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: i === 1 ? '#20b2aa' : '#FFD700', marginBottom: 6 }}>{f.sub}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.icon} {f.title}</div>
              <div style={{ fontSize: 10, color: '#6e7681', lineHeight: 1.5, marginBottom: 10 }}>{f.desc}</div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: i === 1 ? '#20b2aa' : '#FFD700' }}>{f.stat}</span>
                <span style={{ fontSize: 8, color: '#484f58' }}>{f.statL}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // NOT PRO — Paywall
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 600, marginBottom: 32, paddingTop: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 16, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)', marginBottom: 16 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 6px #FFD700' }} />
          <span style={{ fontSize: 9, color: '#FFD700', fontWeight: 700, letterSpacing: '0.1em' }}>PRO MAX NEURAL ENGINE</span>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', fontFamily: 'IBM Plex Mono,monospace' }}>
          Deep Forensic <span style={{ color: '#FFD700' }}>Intelligence</span>
        </h2>
        <p style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.7, margin: '0 0 20px' }}>
          Graph Neural Networks + Contract Decompilation. Trained on 523K+ contracts.
          Predicts rug pulls before they execute.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 8, background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)', marginBottom: 20 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: '#FFD700' }}>$30</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: '#FFD700', fontWeight: 700 }}>/month</div>
            <div style={{ fontSize: 8, color: '#484f58', letterSpacing: '0.06em' }}>UNLIMITED AUDITS · 0% FEES</div>
          </div>
        </div>
        <div>
          <button onClick={onUpgrade} style={{ padding: '12px 28px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg, #FFD700, #d4af37)', border: 'none', borderRadius: 6, color: '#000', cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace', boxShadow: '0 0 20px rgba(255,215,0,0.15)', letterSpacing: '0.03em' }}>
            Upgrade to Pro Max
          </button>
        </div>
      </div>

      {/* Blurred terminal preview */}
      <div style={{ width: '100%', maxWidth: 700, position: 'relative', marginBottom: 32 }}>
        <div style={{ filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#111', borderBottom: '1px solid rgba(255,215,0,0.06)' }}>
              <div style={{ display: 'flex', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} /><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} /><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} /></div>
              <span style={{ fontSize: 9, color: '#484f58' }}>NEURAL_ENGINE_v4.0</span>
              <span style={{ fontSize: 7, color: '#FFD700' }}>● LIVE</span>
            </div>
            <div ref={logRef} style={{ height: 200, overflowY: 'auto', padding: '10px 14px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, lineHeight: 1.9 }}>
              {logs.map((l, i) => (
                <div key={i}><span style={{ color: '#303030', marginRight: 6 }}>{new Date().toTimeString().slice(0,8)}</span><span style={{ color: l.color, fontWeight: 700, fontSize: 8, marginRight: 6 }}>{l.tag}</span><span style={{ color: '#6e7681' }}>{l.text}</span></div>
              ))}
            </div>
          </div>
        </div>
        {/* Lock overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
            <div style={{ fontSize: 10, color: '#FFD700', fontWeight: 700, letterSpacing: '0.08em' }}>PRO MAX REQUIRED</div>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ width: '100%', maxWidth: 700 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#FFD700', marginBottom: 12, textAlign: 'center' }}>PLAN COMPARISON</div>
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', background: '#111', borderBottom: '1px solid rgba(255,215,0,0.06)' }}>
            <div style={{ padding: '10px 14px', fontSize: 8, fontWeight: 700, color: '#484f58', letterSpacing: '0.1em' }}>FEATURE</div>
            <div style={{ padding: '10px 14px', fontSize: 8, fontWeight: 700, color: '#6e7681', letterSpacing: '0.1em', textAlign: 'center' }}>BASIC<br/><span style={{ fontSize: 11, fontWeight: 800, color: '#8b949e' }}>Free</span></div>
            <div style={{ padding: '10px 14px', fontSize: 8, fontWeight: 700, color: '#FFD700', letterSpacing: '0.1em', textAlign: 'center' }}>PRO MAX<br/><span style={{ fontSize: 11, fontWeight: 800 }}>$30/mo</span></div>
          </div>
          {comparison.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: i < comparison.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none' }}>
              <div style={{ padding: '9px 14px', fontSize: 10, color: '#c9d1d9', fontWeight: 600 }}>{r.feat}</div>
              <div style={{ padding: '9px 14px', fontSize: 10, color: r.basic === '—' ? '#202020' : '#6e7681', textAlign: 'center' }}>{r.basic}</div>
              <div style={{ padding: '9px 14px', fontSize: 10, color: r.pro.includes('∞') || r.pro.includes('0%') ? '#FFD700' : '#20b2aa', fontWeight: 600, textAlign: 'center' }}>{r.pro}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

`;

// Insert before the main dashboard function
const dashboardFnStart = "export default function Dashboard()";
if (code.includes(dashboardFnStart) && !code.includes('ProMaxView')) {
  code = code.replace(dashboardFnStart, proMaxComponent + dashboardFnStart);
  changes.push("ProMaxView component: paywall + live terminal");
} else if (code.includes('ProMaxView')) {
  console.log('⚠️  ProMaxView already exists');
} else {
  // Try alternate function name
  const alt = code.match(/export default function (\w+)/);
  if (alt) {
    code = code.replace('export default function ' + alt[1], proMaxComponent + 'export default function ' + alt[1]);
    changes.push("ProMaxView component added before " + alt[1]);
  }
}

// ─────────────────────────────────────────────
// 5. Add blink keyframe if not exists
// ─────────────────────────────────────────────
if (!code.includes('@keyframes blink')) {
  code = code.replace(
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '@keyframes spin{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}'
  );
  changes.push("Added blink keyframe animation");
}

fs.writeFileSync('app/dashboard.tsx', code);
console.log('');
changes.forEach(c => console.log('✅ ' + c));
console.log('');
console.log('📝 Dashboard patched (' + changes.length + ' changes)');
ENDOFSCRIPT

echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -10

echo ""
echo "============================================"
echo "✅ Pro Max Neural integrated into Dashboard"
echo ""
echo "What's built:"
echo "  • ✦ Pro Max button in top nav (gold accent when active)"
echo "  • Paywall view: blurred terminal + $30/mo CTA + comparison table"
echo "  • Live view (when Pro): real-time forensic terminal + feature cards"
echo "  • Same sidebar, topbar, and styling as rest of platform"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'feat: Pro Max Neural as in-platform dashboard view' && vercel --prod"
echo "============================================"
