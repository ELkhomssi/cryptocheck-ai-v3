import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSupabaseConfigured } from '@/lib/supabase'

/** Returns null when NEXT_PUBLIC_SUPABASE_* are unset — safe for preview UIs. */
export async function createClientOptional(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null

  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
  })
}

/** Throws when Supabase env is missing — use in API routes that require auth. */
export async function createClient(): Promise<SupabaseClient> {
  const client = await createClientOptional()
  if (!client) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.example).',
    )
  }
  return client
}
