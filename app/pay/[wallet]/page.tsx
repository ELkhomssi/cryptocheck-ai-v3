import { PayWidget } from '@/components/payments/PayWidget'
import { getMerchant } from '@/lib/payments/merchant'

export const dynamic = 'force-dynamic'

type TokenKey = 'SOL' | 'USDC' | 'USDT'

function asToken(v: string | undefined): TokenKey | undefined {
  return v === 'SOL' || v === 'USDC' || v === 'USDT' ? v : undefined
}

/**
 * Public payment page — anyone can pay a registered (or raw) wallet.
 * `?embed=true` renders a compact, chrome-less widget for iframe embedding.
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: { wallet: string }
  searchParams: { embed?: string; amount?: string; token?: string; memo?: string }
}) {
  const wallet = params.wallet
  const embed = searchParams.embed === 'true'
  const merchant = await getMerchant(wallet).catch(() => null)
  const amount = Number(searchParams.amount)
  const defaultAmountUsd = Number.isFinite(amount) && amount > 0 ? amount : undefined

  const widget = (
    <PayWidget
      wallet={wallet}
      merchantName={merchant?.merchantName ?? null}
      embed={embed}
      defaultAmountUsd={defaultAmountUsd}
      defaultToken={asToken(searchParams.token)}
      memo={typeof searchParams.memo === 'string' ? searchParams.memo : undefined}
    />
  )

  if (embed) {
    return (
      <div className="flex min-h-[420px] items-center justify-center bg-transparent p-2">
        {widget}
        <span className="sr-only">Powered by CryptoCheck AI</span>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-black px-4 py-12">
      {widget}
      <a href="/" className="mt-6 text-xs text-slate-600 hover:text-slate-400">
        Powered by CryptoCheck AI
      </a>
    </main>
  )
}
