/**
 * Persist OMS opportunities + audits. Soft-fails if migration not applied yet.
 */
import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type {
  ExecutionTerminalStatus,
  OpportunityIntake,
} from './types'
import type { PreparedExecution } from './ports'

export async function insertOpportunity(opp: OpportunityIntake): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin()
    const { error } = await sb.from('token_exec_opportunities').upsert(
      {
        opportunity_id: opp.opportunityId,
        user_id: opp.userId,
        wallet_address: opp.walletAddress,
        mint: opp.mint,
        symbol: opp.symbol ?? null,
        source: opp.source,
        strategy: opp.strategy,
        side: opp.side,
        amount_sol: opp.amountSol ?? null,
        max_slippage_bps: opp.maxSlippageBps,
        client_request_id: opp.clientRequestId ?? null,
      },
      { onConflict: 'opportunity_id' },
    )
    if (error) {
      console.warn('[exec-audit] opportunity upsert', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[exec-audit] opportunity', e instanceof Error ? e.message : e)
    return false
  }
}

export async function insertAuditFromPrepare(
  opp: OpportunityIntake,
  prepared: PreparedExecution,
  status: ExecutionTerminalStatus | 'in_progress',
): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin()
    const row = {
      opportunity_id: opp.opportunityId,
      user_id: opp.userId,
      phase: prepared.allowed ? 'build' : 'terminal',
      status,
      risk_json: prepared.risk,
      simulation_json: prepared.simulation,
      safety_json: prepared.safety,
      capital_json: prepared.capital,
      jito_json: prepared.jitoPlan,
      submit_json: prepared.unsignedTxBase64
        ? { mode: 'unsigned_handoff', hasTx: true }
        : null,
      signature: null,
      error_code: prepared.allowed ? null : 'PREPARE_BLOCKED',
      error_message: prepared.blockReason ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await sb.from('token_exec_audits').insert(row).select('id').maybeSingle()
    if (error) {
      console.warn('[exec-audit] insert', error.message)
      return null
    }
    const auditId = (data as { id?: string } | null)?.id ?? null
    if (auditId) {
      await sb.from('token_exec_audit_events').insert({
        audit_id: auditId,
        opportunity_id: opp.opportunityId,
        event_type: prepared.allowed ? 'prepared' : 'blocked',
        payload: {
          blockReason: prepared.blockReason ?? null,
          strategy: opp.strategy,
          source: opp.source,
        },
      })
    }
    return auditId
  } catch (e) {
    console.warn('[exec-audit] insert', e instanceof Error ? e.message : e)
    return null
  }
}

export async function finalizeAuditWithSignature(input: {
  opportunityId: string
  userId: string
  signature: string
  realizedPnlSol?: number | null
}): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin()
    const { data: existing } = await sb
      .from('token_exec_audits')
      .select('id')
      .eq('opportunity_id', input.opportunityId)
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const auditId = (existing as { id?: string } | null)?.id
    if (!auditId) return false

    const { error } = await sb
      .from('token_exec_audits')
      .update({
        status: 'filled',
        phase: 'confirm',
        signature: input.signature,
        realized_pnl_sol: input.realizedPnlSol ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    if (error) {
      console.warn('[exec-audit] finalize', error.message)
      return false
    }

    await sb.from('token_exec_audit_events').insert({
      audit_id: auditId,
      opportunity_id: input.opportunityId,
      event_type: 'filled',
      payload: { signature: input.signature },
    })
    return true
  } catch (e) {
    console.warn('[exec-audit] finalize', e instanceof Error ? e.message : e)
    return false
  }
}

export function preparedToAuditStatus(prepared: PreparedExecution): ExecutionTerminalStatus | 'in_progress' {
  if (prepared.allowed) return 'in_progress'
  if (prepared.blockReason?.includes('Critical') || prepared.blockReason?.includes('risk')) {
    return 'rejected_risk'
  }
  if (prepared.blockReason?.includes('exposure') || prepared.blockReason?.includes('Daily loss') || prepared.blockReason?.includes('positions') || prepared.blockReason?.includes('Slippage')) {
    return 'rejected_capital'
  }
  if (prepared.blockReason?.includes('Simulation') || prepared.blockReason?.includes('confidence')) {
    return 'rejected_simulation'
  }
  if (prepared.blockReason?.includes('Safety')) return 'rejected_safety'
  if (prepared.blockReason?.includes('congestion')) return 'expired'
  return 'rejected_risk'
}
