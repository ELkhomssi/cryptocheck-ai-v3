import PDFDocument from 'pdfkit'
import type { ReasoningObject } from '@/lib/services/scanner-engine'

export type AuditReportInput = {
  mint: string
  tokenName?: string
  reasoning: ReasoningObject
  generatedAt?: string
}

export function buildAuditReportJson(input: AuditReportInput): string {
  return JSON.stringify(
    {
      issuer: 'CryptoCheck AI',
      report_type: 'Institutional Security Audit',
      mint: input.mint,
      token_name: input.tokenName ?? null,
      generated_at: input.generatedAt ?? new Date().toISOString(),
      institutional_safety_grade: input.reasoning.institutionalGrade,
      verdict: input.reasoning.verdict,
      aggregate_score: input.reasoning.aggregateScore,
      confidence: input.reasoning.confidenceScore,
      evidence_lines: input.reasoning.evidence,
      flags: input.reasoning.flags,
      dynamic_simulation: input.reasoning.dynamicSimulation ?? null,
      cluster_analysis: input.reasoning.clusterAnalysis,
      fingerprint: input.reasoning.fingerprintBestMatch
        ? {
            id: input.reasoning.fingerprintBestMatch.fingerprint.id,
            label: input.reasoning.fingerprintBestMatch.fingerprint.label,
            similarity: input.reasoning.fingerprintBestMatch.similarity,
          }
        : null,
    },
    null,
    2
  )
}

export function buildAuditReportPdfBuffer(input: AuditReportInput): Promise<Buffer> {
  const title = 'CryptoCheck AI — Institutional Security Audit'
  const when = input.generatedAt ?? new Date().toISOString()

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' })
    doc.on('data', (c) => chunks.push(c as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fillColor('#0f172a').fontSize(20).text(title, { align: 'center' })
    doc.moveDown(0.5)
    doc.fillColor('#64748b').fontSize(9).text(`Generated ${when}`, { align: 'center' })
    doc.moveDown(2)

    doc.fillColor('#0f172a').fontSize(14).text('Executive summary', { underline: true })
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#334155')
    doc.text(
      `Institutional safety grade: ${input.reasoning.institutionalGrade} · Verdict: ${input.reasoning.verdict} · Score ${input.reasoning.aggregateScore}/100 · Confidence ${input.reasoning.confidenceScore}%`
    )
    doc.moveDown(0.8)
    doc.text(`Mint: ${input.mint}`)
    if (input.tokenName) doc.text(`Asset: ${input.tokenName}`)
    doc.moveDown(1.2)

    doc.fontSize(14).fillColor('#0f172a').text('Explainable AI — evidence lines', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(9).fillColor('#475569')
    for (const line of input.reasoning.evidence) {
      doc.text(`[${line.category}] ${line.label}`, { continued: false })
      doc.fontSize(8).fillColor('#64748b').text(line.detail, { indent: 12 })
      doc.moveDown(0.3)
      doc.fontSize(9).fillColor('#475569')
    }

    doc.moveDown(0.8)
    doc.fontSize(14).fillColor('#0f172a').text('Flags & dynamic simulation', { underline: true })
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor('#475569')
    doc.text(input.reasoning.flags.join(', ') || '— none —')
    if (input.reasoning.dynamicSimulation) {
      doc.moveDown(0.4)
      doc.text(`Dynamic: ${input.reasoning.dynamicSimulation.summary}`)
    }

    doc.moveDown(1.2)
    doc.fontSize(8).fillColor('#94a3b8').text('CryptoCheck AI — Solana security infrastructure. Confidential.', {
      align: 'center',
    })

    doc.end()
  })
}
