/**
 * Resolve Supabase admin creds for workers / CLI.
 * Accepts worker naming (SUPABASE_URL) or Next.js naming (NEXT_PUBLIC_SUPABASE_URL).
 */
export function resolveSupabaseAdminCreds(): { url: string; key: string } | null {
  const url = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ''
  ).replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
  if (!url || !key) return null
  return { url, key }
}
