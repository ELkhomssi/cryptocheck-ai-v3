import { redirect } from 'next/navigation'

/** Sentinel Edge opens as Sports Odds drawer on Official Dashboard — no separate product page. */
export default function SentinelEdgeRedirectPage() {
  redirect('/dashboard#hot-opportunities')
}
