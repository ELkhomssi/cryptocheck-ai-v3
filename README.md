# CryptoCheck AI — Institutional Terminal v3

> The neural scanner for Solana. Bloomberg-style terminal with real-time Helius data, portfolio risk scoring, and Jupiter integration.

## 🚀 Quick Start (localhost)

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open in browser
open http://localhost:3000
```

## 📁 Project Structure

```
cryptocheck/
├── app/
│   ├── layout.tsx          ← Root layout (IBM Plex fonts, SolanaProvider)
│   └── page.tsx            ← Main terminal UI (all views + logic)
├── components/
│   └── SolanaProvider.tsx  ← Phantom wallet context (no external deps)
├── lib/
│   └── helius.ts           ← All Helius RPC/API/DAS calls + risk engine
├── styles/
│   └── globals.css         ← Scanlines, ambient glow, all custom effects
├── tailwind.config.js      ← Bloomberg fonts + neon color palette
├── next.config.js
├── tsconfig.json
└── package.json
```

## 🔑 API Keys (pre-configured for local testing)

All hardcoded in `lib/helius.ts`:

```typescript
HELIUS_KEY    = '8948de2b-6114-45cd-839d-1a81eb273cd9'
HELIUS_RPC    = 'https://mainnet.helius-rpc.com/?api-key=...'
HELIUS_API    = 'https://api.helius.xyz/v0'
HELIUS_DAS    = HELIUS_RPC   // DAS uses same endpoint
```

Move to `.env.local` for production:
```env
NEXT_PUBLIC_HELIUS_KEY=8948de2b-6114-45cd-839d-1a81eb273cd9
NEXT_PUBLIC_HELIUS_RPC=https://mainnet.helius-rpc.com/?api-key=...
```

## 💳 Stripe (Paywall)

Price IDs pre-configured in `ProModal`:
- Weekly  `$5/week`:   `price_1T9vbAAkjKVFT4LeZstngEew`
- Yearly `$200/year`:  `price_1T9vdDAkjKVFT4LeAb9952Gt`

To activate payments, create a `/api/checkout` route and call Stripe from the server.

## ✨ Features

| Feature | Status | Source |
|---|---|---|
| Neural Token Scan | ✅ Live | Helius RPC + API |
| Holder Distribution Chart | ✅ Live | Helius RPC / Chart.js |
| Rug Pull Detection | ✅ Live | Neural Engine v2 |
| Portfolio Risk Score | ✅ Live | Helius DAS API |
| Safe vs Risk Breakdown | ✅ Live | Neural Engine v2 |
| Jupiter Buy Button | ✅ Live | jup.ag deep link |
| Whale Tracker | 🔒 PRO | Demo data |
| Alpha Feed | 🔒 PRO | Demo data |
| Phantom Wallet | ✅ Live | window.solana |
| Mobile Bottom Nav | ✅ Live | Tailwind responsive |
| Bloomberg Aesthetic | ✅ Live | IBM Plex Mono |
| Scanlines Effect | ✅ Live | CSS repeating-gradient |
| Ambient Glow | ✅ Live | CSS blur blobs |
| Disclaimer Footer | ✅ Live | Static |

## 🔌 Wallet

Phantom wallet connection uses `window.solana` directly — no `@solana/wallet-adapter` needed for this build. Install Phantom from [phantom.app](https://phantom.app).

## 📱 Mobile

- Sticky bottom nav bar (Scan / Portfolio / Whales / Alpha / Pro)
- Horizontal scroll for all data tables
- Full-width Jupiter buy and Upgrade buttons
- Cards stack vertically on small screens
- Charts adapt to mobile viewport
