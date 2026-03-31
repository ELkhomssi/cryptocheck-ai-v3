import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const sig  = req.headers.get('stripe-signature') || ''

    // Parse event (add Stripe signature verification in production)
    const event = JSON.parse(body)

    if (event.type === 'checkout.session.completed' || 
        event.type === 'customer.subscription.created' ||
        event.type === 'invoice.payment_succeeded') {

      const session = event.data.object
      const email   = session.customer_email || 
                      session.customer_details?.email ||
                      session.metadata?.email

      if (email) {
        // Set is_pro = true in Supabase
        const { error } = await supabase
          .from('profiles')
          .update({ is_pro: true, plan: 'pro' })
          .eq('email', email)

        if (error) console.error('Supabase update error:', error)
        else console.log('✅ PRO activated for:', email)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const session = event.data.object
      const email   = session.customer_email || session.metadata?.email

      if (email) {
        await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free' })
          .eq('email', email)
        console.log('❌ PRO cancelled for:', email)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
