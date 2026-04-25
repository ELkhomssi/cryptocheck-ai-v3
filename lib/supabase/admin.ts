import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

function assertAdminEnv(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Server misconfiguration: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for admin access.'
    )
  }
}

/** Service-role client for server-only mutations (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    assertAdminEnv()
    _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  }
  return _admin
}
