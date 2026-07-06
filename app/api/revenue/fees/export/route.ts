import { NextRequest, NextResponse } from 'next/server'
import { assertDiagnosticsAdmin } from '@/lib/diagnostics/admin-auth'
import { feeRecordsToCsv } from '@/lib/revenue-dashboard/fee-analytics'
import { listFeeRecords } from '@/lib/revenue-dashboard/fee-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/revenue/fees/export — admin-only CSV of FeeRecords. */
export async function GET(req: NextRequest) {
  const auth = await assertDiagnosticsAdmin(req.headers.get('authorization'))
  if (auth.ok === false) return auth.response

  const records = await listFeeRecords(5000)
  const csv = feeRecordsToCsv(records)
  const filename = `cryptocheck-fees-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
