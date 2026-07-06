'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  deriveClientSubscription,
  type ClientSubscriptionFlags,
  type ProfileSubscriptionRow,
} from '@/lib/subscription/profile-access'

export type SubscriptionContextValue = ClientSubscriptionFlags & {
  loading: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<ProfileSubscriptionRow | null>(null)
  const [saasTier, setSaasTier] = useState<string | null>(null)
  const [saasStatus, setSaasStatus] = useState<string | null>(null)
  const [saasFullAccess, setSaasFullAccess] = useState<boolean>(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setRow(null)
        setSaasTier(null)
        setSaasStatus(null)
        setSaasFullAccess(false)
        return
      }
      const [profileRes, saasRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_pro, plan, plan_type, tier, is_elite')
          .eq('id', user.id)
          .maybeSingle(),
        supabase.from('saas_subscriptions').select('tier, status, full_access').eq('user_id', user.id).maybeSingle(),
      ])
      setRow((profileRes.data as ProfileSubscriptionRow) ?? null)
      const s = saasRes.data as { tier?: string | null; status?: string | null; full_access?: boolean | null } | null
      setSaasTier(s?.tier != null ? String(s.tier) : null)
      setSaasStatus(s?.status != null ? String(s.status) : null)
      setSaasFullAccess(s?.full_access === true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const derived = useMemo(
    () =>
      deriveClientSubscription(row, {
        saasTier,
        saasStatus,
        saasFullAccess,
      }),
    [row, saasTier, saasStatus, saasFullAccess]
  )

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      loading,
      refresh,
      ...derived,
    }),
    [loading, refresh, derived]
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription must be used within <SubscriptionProvider>')
  }
  return ctx
}

/** Safe when the provider is absent (e.g. isolated tests). */
export function useSubscriptionOptional(): SubscriptionContextValue | null {
  return useContext(SubscriptionContext)
}
