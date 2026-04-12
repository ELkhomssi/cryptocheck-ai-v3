#!/bin/bash
# ============================================================
# CryptoCheck AI — MASTER FIX
# 1. Fix ProMaxEliteDashboard tier prop interface
# 2. Add elite view section to dashboard
# 3. Server-side credits (remove localStorage as source of truth)
# ============================================================

set -e
echo "🔧 Master Fix — Tier system + Credits + Elite view..."

# ════════════════════════════════════════════
# PART 1: Fix ProMaxEliteDashboard interface
# ════════════════════════════════════════════
echo ""
echo "📝 Fixing ProMaxEliteDashboard..."

node << 'ENDOFSCRIPT'
const fs = require('fs');
let code = fs.readFileSync('components/ProMaxEliteDashboard.tsx', 'utf8');
let changes = [];

// Fix: Add Tier type and tier to interface
if (!code.includes("type Tier")) {
  code = code.replace(
    "interface ProMaxEliteProps {",
    "type Tier = 'free' | 'pro' | 'elite'\n\ninterface ProMaxEliteProps {"
  );
  changes.push('Added Tier type');
}

if (!code.includes("tier?:") && !code.includes("tier :")) {
  code = code.replace(
    "interface ProMaxEliteProps {\n  isPro: boolean\n  onUpgrade: () => void\n}",
    "interface ProMaxEliteProps {\n  isPro: boolean\n  tier?: Tier\n  onUpgrade: () => void\n}"
  );
  changes.push('Added tier? to interface');
}

// Ensure export signature has tier
if (!code.includes('tier = "pro"') && code.includes('tier, onUpgrade')) {
  // Already has tier in destructuring but no default
  code = code.replace(
    'tier, onUpgrade',
    'tier = "pro", onUpgrade'
  );
  changes.push('Added default tier="pro"');
}

fs.writeFileSync('components/ProMaxEliteDashboard.tsx', code);
changes.forEach(c => console.log('✅ ' + c));
if (changes.length === 0) console.log('✅ Interface already correct');
ENDOFSCRIPT

# ════════════════════════════════════════════
# PART 2: Fix dashboard — elite view + credits
# ════════════════════════════════════════════
echo ""
echo "📝 Fixing dashboard.tsx..."

node << 'ENDOFSCRIPT'
const fs = require('fs');
let d = fs.readFileSync('app/dashboard.tsx', 'utf8');
let changes = [];

// FIX 1: The promax view should pass tier="pro", add separate elite view
// Currently line 3046 passes tier={isElite ? "elite" : "pro"} but only shows for promax view
// We need: promax view = tier="pro", elite view = tier="elite"

const oldPromaxView = '<ProMaxEliteDashboard isPro={isPro} tier={isElite ? "elite" : "pro"} onUpgrade={() => setShowModal(true)} />';
if (d.includes(oldPromaxView)) {
  d = d.replace(oldPromaxView, '<ProMaxEliteDashboard isPro={isPro} tier="pro" onUpgrade={() => setShowModal(true)} />');
  changes.push('promax view: hardcoded tier="pro"');
}

// Add elite view section if missing
if (!d.includes("view === 'elite'")) {
  // Find the closing of promax view and add elite after it
  const promaxClose = `          {view === 'promax' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#050505' }}>
              <ProMaxEliteDashboard isPro={isPro} tier="pro" onUpgrade={() => setShowModal(true)} />
            </div>
          )}`;
  
  const withElite = promaxClose + `
          {view === 'elite' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#030308' }}>
              <ProMaxEliteDashboard isPro={isPro} tier="elite" onUpgrade={() => setShowModal(true)} />
            </div>
          )}`;
  
  if (d.includes(promaxClose)) {
    d = d.replace(promaxClose, withElite);
    changes.push('Added elite view section');
  } else {
    console.log('⚠️  Could not find promax closing to add elite view');
  }
}

// FIX 2: Credits — make Supabase the source of truth, remove localStorage init
const oldCreditsInit = `const [credits, setCredits] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cc_credits')
      return saved !== null ? parseInt(saved) : 10
    }
    return 10
  })`;

const newCreditsInit = `const [credits, setCredits] = useState(10) // Server-synced via loadCreditsFromProfile`;

if (d.includes(oldCreditsInit)) {
  d = d.replace(oldCreditsInit, newCreditsInit);
  changes.push('Credits: removed localStorage init, server-only source of truth');
}

// FIX 3: Remove localStorage writes in credit deduction (keep server sync only)
// In doScan optimistic update, keep the setCredits but remove localStorage
const oldCreditDeduct = `setCredits(prev => {
        const next = Math.max(0, prev - 1)
        localStorage.setItem('cc_credits', String(next))
        return next
      })`;
const newCreditDeduct = `setCredits(prev => Math.max(0, prev - 1)) // Optimistic, server syncs`;

if (d.includes(oldCreditDeduct)) {
  d = d.replace(oldCreditDeduct, newCreditDeduct);
  changes.push('Credits: removed localStorage in deduction');
}

// Remove localStorage from loadCreditsFromProfile
const oldLoadCredits = `          setCredits(data.credits)
          localStorage.setItem('cc_credits', String(data.credits))`;
const newLoadCredits = `          setCredits(data.credits)`;

if (d.includes(oldLoadCredits)) {
  d = d.replace(oldLoadCredits, newLoadCredits);
  changes.push('Credits: removed localStorage in profile load');
}

// Remove localStorage in useCredit
const oldUseCredit = `    setCredits(nc)
    localStorage.setItem('cc_credits', String(nc))`;
const newUseCredit = `    setCredits(nc)`;

if (d.includes(oldUseCredit)) {
  d = d.replace(oldUseCredit, newUseCredit);
  changes.push('Credits: removed localStorage in useCredit');
}

// Remove localStorage in server credit sync
const oldServerSync = `      if (creditResult?.credits !== undefined && creditResult.credits >= 0) {
        setCredits(creditResult.credits)
        localStorage.setItem('cc_credits', String(creditResult.credits))
      }`;
const newServerSync = `      if (creditResult?.credits !== undefined && creditResult.credits >= 0) {
        setCredits(creditResult.credits)
      }`;

if (d.includes(oldServerSync)) {
  d = d.replace(oldServerSync, newServerSync);
  changes.push('Credits: removed localStorage in server sync');
}

fs.writeFileSync('app/dashboard.tsx', d);
console.log('');
changes.forEach(c => console.log('✅ ' + c));
console.log('');
console.log('📝 Dashboard fixed (' + changes.length + ' changes)');
ENDOFSCRIPT

# ════════════════════════════════════════════
# PART 3: Verify
# ════════════════════════════════════════════
echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -10

echo ""
echo "============================================"
echo "✅ MASTER FIX COMPLETE"
echo ""
echo "Changes:"
echo "  1. ProMaxEliteDashboard: tier prop in interface"
echo "  2. Dashboard: separate promax (gold) + elite (purple) views"
echo "  3. Credits: server-only source of truth (no localStorage)"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'fix: master - tier interface + elite view + server credits' && vercel --prod"
echo "============================================"
