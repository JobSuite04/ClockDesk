import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        // clientReferenceId is set to organisation.id in TrialGate.tsx
        const orgId = session.client_reference_id ?? session.metadata?.organisation_id

        if (!orgId) {
          console.error('No organisation_id in checkout session (client_reference_id or metadata)')
          break
        }

        // Retrieve subscription to get plan details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id

        // Map price ID to plan
        const plan = mapPriceToPlan(priceId)

        const { error } = await supabase
          .from('organisations')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            subscription_status: 'active',
            max_employees: planToMaxEmployees(plan),
          })
          .eq('id', orgId)

        if (error) console.error('Error updating organisation after checkout:', error)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price.id
        const plan = mapPriceToPlan(priceId)
        const status = mapStripeStatus(subscription.status)

        const { error } = await supabase
          .from('organisations')
          .update({
            plan: status === 'active' ? plan : status === 'past_due' ? plan : 'expired',
            subscription_status: status,
            max_employees: status === 'active' ? planToMaxEmployees(plan) : 0,
          })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('Error updating organisation on subscription update:', error)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { error } = await supabase
          .from('organisations')
          .update({
            plan: 'expired',
            subscription_status: 'expired',
            stripe_subscription_id: null,
            max_employees: 0,
          })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('Error updating organisation on subscription deletion:', error)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { error } = await supabase
          .from('organisations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('Error updating organisation on payment failure:', error)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Payment recovered — make sure status is active
        const { error } = await supabase
          .from('organisations')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('Error updating organisation on invoice paid:', error)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook event:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

function mapPriceToPlan(priceId: string | undefined): string {
  const starterPriceIds = [
    Deno.env.get('STRIPE_STARTER_MONTHLY_PRICE_ID'),
    Deno.env.get('STRIPE_STARTER_ANNUAL_PRICE_ID'),
  ]
  const growthPriceIds = [
    Deno.env.get('STRIPE_GROWTH_MONTHLY_PRICE_ID'),
    Deno.env.get('STRIPE_GROWTH_ANNUAL_PRICE_ID'),
  ]
  const proPriceIds = [
    Deno.env.get('STRIPE_PRO_MONTHLY_PRICE_ID'),
    Deno.env.get('STRIPE_PRO_ANNUAL_PRICE_ID'),
  ]

  if (priceId && starterPriceIds.includes(priceId)) return 'starter'
  if (priceId && growthPriceIds.includes(priceId)) return 'growth'
  if (priceId && proPriceIds.includes(priceId)) return 'pro'
  return 'starter' // safe fallback
}

function planToMaxEmployees(plan: string): number {
  if (plan === 'starter') return 20
  if (plan === 'growth') return 75
  if (plan === 'pro') return 999999
  return 0
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'expired'
    case 'unpaid': return 'expired'
    case 'trialing': return 'active'
    default: return 'expired'
  }
}
