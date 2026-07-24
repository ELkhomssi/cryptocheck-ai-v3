import 'server-only'

import type { TerminalOrder, TerminalOrderStatus, TerminalOrderType } from '@/types/portfolio-desk'
import { cacheGet, cacheSet } from '@/lib/portfolio-desk/cache'

const MEM_KEY = 'pd:terminal-orders:v1'
const MAX = 200

function hasAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function memAll(): TerminalOrder[] {
  return cacheGet<TerminalOrder[]>(MEM_KEY) ?? []
}

function memSave(all: TerminalOrder[]): void {
  cacheSet(MEM_KEY, all.slice(0, MAX), 24 * 60 * 60 * 1000)
}

function rowToOrder(row: {
  id: string
  wallet: string
  type: string
  status: string
  input_mint: string
  output_mint: string
  amount: number
  trigger_price: number | null
  fill_signature: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}): TerminalOrder {
  return {
    id: row.id,
    wallet: row.wallet,
    type: row.type as TerminalOrderType,
    status: row.status as TerminalOrderStatus,
    inputMint: row.input_mint,
    outputMint: row.output_mint,
    amount: Number(row.amount),
    triggerPrice: row.trigger_price == null ? null : Number(row.trigger_price),
    fillSignature: row.fill_signature,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listOrders(wallet: string, limit = 50): Promise<TerminalOrder[]> {
  const w = wallet.trim()
  if (!w) return []
  if (hasAdminEnv()) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('terminal_orders')
        .select(
          'id,wallet,type,status,input_mint,output_mint,amount,trigger_price,fill_signature,expires_at,created_at,updated_at',
        )
        .eq('wallet', w)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (!error && data) return data.map(rowToOrder)
    } catch {
      /* fall through */
    }
  }
  return memAll()
    .filter((o) => o.wallet === w)
    .slice(0, limit)
}

export async function createOrder(input: {
  wallet: string
  type: TerminalOrderType
  inputMint: string
  outputMint: string
  amount: number
  triggerPrice?: number | null
  expiresAt?: string | null
}): Promise<TerminalOrder> {
  const now = new Date().toISOString()
  const order: TerminalOrder = {
    id: crypto.randomUUID(),
    wallet: input.wallet.trim(),
    type: input.type,
    status: 'pending',
    inputMint: input.inputMint.trim(),
    outputMint: input.outputMint.trim(),
    amount: input.amount,
    triggerPrice: input.triggerPrice ?? null,
    fillSignature: null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  }

  if (hasAdminEnv()) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('terminal_orders')
        .insert({
          id: order.id,
          wallet: order.wallet,
          type: order.type,
          status: order.status,
          input_mint: order.inputMint,
          output_mint: order.outputMint,
          amount: order.amount,
          trigger_price: order.triggerPrice,
          fill_signature: null,
          expires_at: order.expiresAt,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
        })
        .select(
          'id,wallet,type,status,input_mint,output_mint,amount,trigger_price,fill_signature,expires_at,created_at,updated_at',
        )
        .single()
      if (!error && data) return rowToOrder(data)
    } catch {
      /* memory fallback */
    }
  }

  memSave([order, ...memAll()])
  return order
}

export async function updateOrder(
  id: string,
  patch: {
    status?: TerminalOrderStatus
    fillSignature?: string | null
    wallet?: string
  },
): Promise<TerminalOrder | null> {
  const now = new Date().toISOString()

  if (hasAdminEnv()) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      let q = sb
        .from('terminal_orders')
        .update({
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.fillSignature !== undefined
            ? { fill_signature: patch.fillSignature }
            : {}),
          updated_at: now,
        })
        .eq('id', id)
      if (patch.wallet) q = q.eq('wallet', patch.wallet)
      const { data, error } = await q
        .select(
          'id,wallet,type,status,input_mint,output_mint,amount,trigger_price,fill_signature,expires_at,created_at,updated_at',
        )
        .maybeSingle()
      if (!error && data) return rowToOrder(data)
      if (!error && !data) return null
    } catch {
      /* fall through */
    }
  }

  const all = memAll()
  const idx = all.findIndex(
    (o) => o.id === id && (!patch.wallet || o.wallet === patch.wallet),
  )
  if (idx < 0) return null
  const next: TerminalOrder = {
    ...all[idx],
    status: patch.status ?? all[idx].status,
    fillSignature:
      patch.fillSignature !== undefined ? patch.fillSignature : all[idx].fillSignature,
    updatedAt: now,
  }
  all[idx] = next
  memSave(all)
  return next
}

export async function listPendingOrders(limit = 100): Promise<TerminalOrder[]> {
  if (hasAdminEnv()) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('terminal_orders')
        .select(
          'id,wallet,type,status,input_mint,output_mint,amount,trigger_price,fill_signature,expires_at,created_at,updated_at',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit)
      if (!error && data) return data.map(rowToOrder)
    } catch {
      /* fall through */
    }
  }
  return memAll().filter((o) => o.status === 'pending').slice(0, limit)
}
