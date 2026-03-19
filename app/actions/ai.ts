'use server'

// ══════════════════════════════════════════════
//  Server Action: AI Neural Analyst
//  Uses OPENAI_API_KEY (server-only, no NEXT_PUBLIC_)
//  This file never ships to the browser bundle.
// ══════════════════════════════════════════════

interface GptMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GptResponse {
  text: string
  error?: string
}

// ── Core GPT caller ──────────────────────────
async function callGPT(messages: GptMessage[], maxTokens = 300): Promise<string> {
  const key = process.env.OPENAI_API_KEY

  if (!key || key === 'sk-proj-your_new_openai_key_here') {
    return '[AI Analyst offline — set OPENAI_API_KEY in .env.local]'
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      temperature: 0.7,
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 160)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

// ══════════════════════════════════════════════
//  Action 1: Token Neural Summary
//  Called after every Helius scan completes
// ══════════════════════════════════════════════
export async function getAiTokenSummary(params: {
  name: string
  symbol: string
  mint: string
  riskScore: number
  riskLabel: string
  riskVerdict: string
  mintAuthority: string
  totalSupply: string
  topHolderFlag: string
  flags: string[]
  txCount: number
}): Promise<GptResponse> {
  try {
    const { name, symbol, mint, riskScore, riskLabel, riskVerdict,
            mintAuthority, totalSupply, topHolderFlag, flags, txCount } = params

    const messages: GptMessage[] = [
      {
        role: 'system',
        content: `You are a Senior On-chain Analyst for CryptoCheck AI, specializing in Solana tokens. You give brutally honest, concise verdicts in exactly 2 sentences. Be direct and professional. Mention the token name, key risks, and a clear recommendation (proceed / caution / avoid). You can optionally include a single Moroccan Darija phrase (like "wach hadchi mzyan?" or "sir b7al") to feel relatable, but keep it subtle and natural — not forced.`,
      },
      {
        role: 'user',
        content: `Analyze this Solana token scan and give your 2-sentence verdict:

Token: ${name} (${symbol})
Mint: ${mint.slice(0, 10)}...${mint.slice(-6)}
Neural Risk Score: ${riskScore}/100 — ${riskLabel} RISK
Verdict: ${riskVerdict}
Mint Authority: ${mintAuthority}
Total Supply: ${totalSupply}
Top Holder Concern: ${topHolderFlag || 'None detected'}
Detected Issues: ${flags.length > 0 ? flags.join(', ') : 'None'}
Recent Transactions: ${txCount}`,
      },
    ]

    const text = await callGPT(messages, 180)
    return { text }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Unknown AI error' }
  }
}

// ══════════════════════════════════════════════
//  Action 2: AI Chat Reply
//  Multi-turn chat with full scan context
// ══════════════════════════════════════════════
export async function getAiChatReply(params: {
  userMessage: string
  tokenContext: {
    name: string
    symbol: string
    mint: string
    riskScore: number
    riskLabel: string
    verdict: string
    flags: string[]
  }
  history: { role: 'user' | 'ai'; text: string }[]
}): Promise<GptResponse> {
  try {
    const { userMessage, tokenContext, history } = params
    const { name, symbol, mint, riskScore, riskLabel, verdict, flags } = tokenContext

    const systemMsg: GptMessage = {
      role: 'system',
      content: `You are a Senior On-chain Analyst for CryptoCheck AI. You have just completed a full scan of:
Token: ${name} (${symbol}) | Mint: ${mint.slice(0, 10)}...
Risk Score: ${riskScore}/100 (${riskLabel}) | Verdict: ${verdict}
Issues: ${flags.length > 0 ? flags.join(', ') : 'None detected'}

Answer user questions concisely (1-3 sentences max). Be direct, data-driven, and professional. If you don't know something, say so.`,
    }

    // Rolling context: last 6 messages to stay within token limits
    const historyMsgs: GptMessage[] = history.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))

    const messages: GptMessage[] = [
      systemMsg,
      ...historyMsgs,
      { role: 'user', content: userMessage },
    ]

    const text = await callGPT(messages, 220)
    return { text }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Unknown AI error' }
  }
}

// ══════════════════════════════════════════════
//  Action 3: Arbitrage Edge Analysis
//  Classifies price gap as opportunity or trap
// ══════════════════════════════════════════════
export async function getAiEdgeAnalysis(params: {
  symbol: string
  riskScore: number
  riskLabel: string
  edgePct: number
  bestBuyDex: string
  bestSellDex: string
  flags: string[]
}): Promise<GptResponse> {
  try {
    const { symbol, riskScore, riskLabel, edgePct, bestBuyDex, bestSellDex, flags } = params

    const messages: GptMessage[] = [
      {
        role: 'system',
        content: `You are a crypto arbitrage expert specializing in Solana DEX price gaps. Analyze the signal and classify it clearly. Your response must:
1. Start with either "REAL OPPORTUNITY:" or "LIQUIDITY TRAP:" 
2. Explain why in 2 sentences max
3. Give a concrete action if applicable
Be direct — traders need fast answers.`,
      },
      {
        role: 'user',
        content: `Analyze this Solana DEX arbitrage signal:

Token: ${symbol}
Neural Risk Score: ${riskScore}/100 (${riskLabel} RISK)
Detected Price Gap: ${edgePct.toFixed(2)}% (net after ~0.55% round-trip fees)
Best Buy DEX: ${bestBuyDex}
Best Sell DEX: ${bestSellDex}
Token Risk Flags: ${flags.length > 0 ? flags.join(', ') : 'None detected'}

Is this a real arbitrage opportunity or a liquidity trap?`,
      },
    ]

    const text = await callGPT(messages, 200)
    return { text }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Unknown AI error' }
  }
}
