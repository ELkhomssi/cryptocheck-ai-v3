import { NextRequest, NextResponse } from 'next/server'
import { fetchContractForStressTest } from '@/lib/services/aiScanner'
import {
  SOVEREIGN_SYSTEM_PROMPT,
  buildDeterministicMultiVector,
  buildStressTestUserPayload,
  extractJsonObject,
  honeypotDetector,
  mergeScores,
  parseMultiVectorSimulation,
  rugPullPredictor,
  simulateExploitSandbox,
} from '@/lib/AiStressTester'
import { safetyScoreToEliteGrade } from '@/lib/elite-grade'

async function callOpenAi(messages: { role: 'system' | 'user'; content: string }[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key || key === 'sk-proj-your_new_openai_key_here') {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.35,
      messages,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const address = typeof body?.address === 'string' ? body.address.trim() : ''
    if (address.length < 32) {
      return NextResponse.json({ error: 'Invalid Solana address' }, { status: 400 })
    }

    const ctx = await fetchContractForStressTest(address)
    const honeypot = honeypotDetector(ctx)
    const rug = rugPullPredictor(ctx)
    const sim = simulateExploitSandbox(ctx, honeypot, rug)
    const userPayload = buildStressTestUserPayload(ctx, honeypot, rug, sim)

    let aiRaw = ''
    let parsed: Record<string, unknown> | null = null
    try {
      aiRaw = await callOpenAi([
        { role: 'system', content: SOVEREIGN_SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ])
      parsed = extractJsonObject(aiRaw)
    } catch {
      /* LLM optional — fall back to heuristic markdown */
    }

    const aiCombined =
      typeof parsed?.combinedRiskScore === 'number' ? parsed.combinedRiskScore : null
    const finalRisk = mergeScores(sim.riskScore, aiCombined)
    const safetyScore = Math.max(0, Math.min(100, 100 - finalRisk))
    const elite = safetyScoreToEliteGrade(safetyScore)
    const multiVector = parseMultiVectorSimulation(
      parsed,
      buildDeterministicMultiVector(ctx, honeypot, rug, sim)
    )

    const technicalMd =
      typeof parsed?.technicalVulnerabilitiesMarkdown === 'string'
        ? parsed.technicalVulnerabilitiesMarkdown
        : `## Technical Vulnerabilities\n\n_AI offline — heuristic sandbox only._\n\n${sim.phases.map(p => `- ${p}`).join('\n')}`

    const marketMd =
      typeof parsed?.marketMaliceMarkdown === 'string'
        ? parsed.marketMaliceMarkdown
        : `## Market Malice (Honeypot / Rug Pull)\n\n- Honeypot heuristic: **${honeypot.score}/100**\n- Rug probability heuristic: **${rug.rugProbability}/100**\n${[...honeypot.signals, ...rug.signals].map(s => `- ${s}`).join('\n')}`

    const fullReport = [
      `# CLASSIFIED — OFFENSIVE SOVEREIGN BRIEF · ${address.slice(0, 8)}…${address.slice(-6)}`,
      ``,
      `**Elite tier:** ${elite.tier} (${elite.label}) · **Safety score:** ${safetyScore}/100 · **Risk:** ${finalRisk}/100`,
      ``,
      `### Multi-Vector Attack Simulation`,
      `- [Vector: Liquidity Siphoning] → **${multiVector.liquiditySiphoning.result}** — ${multiVector.liquiditySiphoning.logic}`,
      `- [Vector: Authority Escalation] → **${multiVector.authorityEscalation.result}** — ${multiVector.authorityEscalation.logic}`,
      `- [Vector: Social Engineering / Rug Intent] → ${multiVector.socialEngineeringRugIntent.behavioralAnalysis}`,
      ``,
      technicalMd,
      ``,
      '---',
      ``,
      marketMd,
      ``,
      '---',
      ``,
      `### Simulation trace`,
      sim.phases.map(p => `- ${p}`).join('\n'),
    ].join('\n')

    return NextResponse.json({
      address: ctx.address,
      kind: ctx.kind,
      riskScore: finalRisk,
      safetyScore,
      eliteTier: elite.tier,
      eliteLabel: elite.label,
      certificationLine: elite.certificationLine,
      ironDomeCertified: elite.tier === 'S',
      sandboxRiskScore: sim.riskScore,
      technicalComponent: sim.technicalComponent,
      marketMaliceComponent: sim.marketMaliceComponent,
      honeypotLikelihoodScore: typeof parsed?.honeypotLikelihoodScore === 'number' ? parsed.honeypotLikelihoodScore : honeypot.score,
      rugProbabilityScore: typeof parsed?.rugProbabilityScore === 'number' ? parsed.rugProbabilityScore : rug.rugProbability,
      technicalRiskScore: typeof parsed?.technicalRiskScore === 'number' ? parsed.technicalRiskScore : sim.technicalComponent,
      technicalVulnerabilitiesMarkdown: technicalMd,
      marketMaliceMarkdown: marketMd,
      fullReportMarkdown: fullReport,
      multiVectorSimulation: multiVector,
      attackVectors: Array.isArray(parsed?.attackVectors) ? parsed.attackVectors : [],
      simulationNotes: typeof parsed?.simulationNotes === 'string' ? parsed.simulationNotes : sim.phases.join('\n'),
      heuristic: {
        honeypot: honeypot.score,
        rug: rug.rugProbability,
        honeypotSignals: honeypot.signals,
        rugSignals: rug.signals,
      },
      phases: sim.phases,
      fetchedAt: ctx.fetchedAt,
      engine: 'CryptoCheck AI — Sovereign Security Auditor',
      aiRaw: parsed ? undefined : aiRaw.slice(0, 500),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyze contract failed' },
      { status: 500 }
    )
  }
}
