/**
 * Post-sign submit: Jito bundle → poll → RPC fallback.
 * Non-custodial: receives already-signed txs only; never holds keys.
 */
import 'server-only'

import { Connection } from '@solana/web3.js'
import { execMetricInc, EXEC_METRICS } from './metrics'
import type { ExecutionSubmitResult, JitoBundlePlan, OpportunityIntake } from './types'
import { planJitoExecution, type CongestionLevel } from './jito'

function rpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

/** Base URL ending in /api/v1 (no trailing slash). */
function jitoApiV1Base(): string {
  const raw =
    process.env.EXEC_JITO_BLOCK_ENGINE_URL?.trim() ||
    process.env.JITO_BLOCK_ENGINE_URL?.trim() ||
    'https://mainnet.block-engine.jito.wtf/api/v1'
  return raw.replace(/\/$/, '')
}

function bundlesEnabled(): boolean {
  return process.env.EXEC_JITO_BUNDLE_SUBMIT === 'true' || process.env.EXEC_JITO_ENABLED === 'true'
}

function encodeSignedTxBase58(signedTxBase64: string): string {
  const bytes = Buffer.from(signedTxBase64, 'base64')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bs58 = require('bs58') as { encode: (b: Uint8Array) => string }
  return bs58.encode(bytes)
}

async function jitoRpc<T>(method: 'sendBundle' | 'getInflightBundleStatuses', params: unknown[]): Promise<T> {
  const base = jitoApiV1Base()
  const endpoint =
    method === 'getInflightBundleStatuses' ? `${base}/getInflightBundleStatuses` : `${base}/bundles`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    result?: T
    error?: { message?: string }
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Jito ${method} HTTP ${res.status}`)
  }
  return body.result as T
}

export type BundlePollStatus = 'Invalid' | 'Pending' | 'Failed' | 'Landed' | 'Unknown'

export async function pollJitoBundleStatus(
  bundleId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ status: BundlePollStatus; raw?: unknown }> {
  const timeoutMs = opts?.timeoutMs ?? 25_000
  const intervalMs = opts?.intervalMs ?? 1_200
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const result = await jitoRpc<{
        value?: Array<{ bundle_id?: string; status?: string }>
      }>('getInflightBundleStatuses', [[bundleId]])
      const row = result?.value?.find((v) => v.bundle_id === bundleId) ?? result?.value?.[0]
      const status = (row?.status as BundlePollStatus | undefined) ?? 'Unknown'
      if (status === 'Landed' || status === 'Failed' || status === 'Invalid') {
        return { status, raw: result }
      }
    } catch {
      // transient
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { status: 'Pending' }
}

async function submitViaRpc(signedTxBase64: string): Promise<ExecutionSubmitResult> {
  const connection = new Connection(rpcUrl(), 'confirmed')
  const raw = Buffer.from(signedTxBase64, 'base64')
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return {
    mode: 'jupiter_rpc',
    signature,
    submittedAt: new Date().toISOString(),
  }
}

/**
 * Submit a user-signed swap. Tries Jito bundle when enabled; falls back to RPC by default.
 * Bundle UUID ≠ fill — poll status; prefer confirming via signature when client has one.
 */
export async function submitSignedExecution(input: {
  signedTxBase64: string
  plan?: JitoBundlePlan | null
  opportunity?: Pick<OpportunityIntake, 'strategy'> | null
  congestion?: CongestionLevel
  allowRpcFallback?: boolean
}): Promise<ExecutionSubmitResult & { bundleStatus?: BundlePollStatus; error?: string }> {
  const allowRpc = input.allowRpcFallback !== false
  const plan =
    input.plan ??
    planJitoExecution(
      {
        opportunityId: 'submit',
        source: 'api',
        userId: 'system',
        walletAddress: '11111111111111111111111111111111',
        mint: 'So11111111111111111111111111111111111111112',
        chain: 'solana',
        side: 'buy',
        strategy: input.opportunity?.strategy ?? 'balanced',
        maxSlippageBps: 100,
        createdAt: new Date().toISOString(),
      },
      { congestion: input.congestion ?? 'medium' },
    )

  const tryJito = bundlesEnabled() && plan.enabled && plan.fallback !== 'abort'

  if (tryJito) {
    let lastErr = ''
    for (let attempt = 0; attempt < Math.max(1, plan.maxRetries); attempt++) {
      try {
        const encoded = encodeSignedTxBase58(input.signedTxBase64)
        const bundleId = await jitoRpc<string>('sendBundle', [[encoded]])
        execMetricInc(EXEC_METRICS.bundleOk, { attempt: String(attempt) })
        const polled = await pollJitoBundleStatus(bundleId)
        if (polled.status === 'Landed') {
          return {
            mode: 'jito_bundle',
            bundleId,
            submittedAt: new Date().toISOString(),
            bundleStatus: polled.status,
          }
        }
        if (polled.status === 'Failed' || polled.status === 'Invalid') {
          lastErr = `Jito bundle ${polled.status}`
          execMetricInc(EXEC_METRICS.bundleFail, { status: polled.status })
          continue
        }
        return {
          mode: 'jito_bundle',
          bundleId,
          submittedAt: new Date().toISOString(),
          bundleStatus: polled.status,
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        execMetricInc(EXEC_METRICS.bundleFail, { reason: 'error' })
      }
    }

    if (!allowRpc) {
      return {
        mode: 'jito_bundle',
        submittedAt: new Date().toISOString(),
        error: lastErr || 'Jito submit failed',
        bundleStatus: 'Failed',
      }
    }
  }

  if (plan.fallback === 'abort' && !allowRpc) {
    return {
      mode: 'jito_bundle',
      submittedAt: new Date().toISOString(),
      error: 'Abort — extreme congestion and RPC fallback disabled',
      bundleStatus: 'Failed',
    }
  }

  return submitViaRpc(input.signedTxBase64)
}
