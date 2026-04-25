import { BillingClient } from './billing-client'
import type { BillingStripeUrls } from '@/lib/config/billing-stripe-urls'

export default function BillingPage() {
  const stripeUrls: BillingStripeUrls = {
    proDeveloper: process.env.STRIPE_PRICE_ID_PRO ?? '',
    enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? '',
  }
  return <BillingClient stripeUrls={stripeUrls} />
}
