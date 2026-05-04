# stripe-webhook Edge Function

Handles Stripe webhook events to keep ClockDesk subscription state in sync.

## Events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Sets plan, links customer + subscription IDs |
| `customer.subscription.updated` | Updates plan and status (handles upgrades/downgrades) |
| `customer.subscription.deleted` | Sets plan = expired, blocks access |
| `invoice.payment_failed` | Sets status = past_due |
| `invoice.paid` | Restores status = active after recovery |

## Secrets required (set in Supabase Dashboard → Edge Functions → stripe-webhook → Secrets)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_GROWTH_MONTHLY_PRICE_ID=price_...
STRIPE_GROWTH_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
```

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

## Stripe Dashboard setup

1. Go to Stripe → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
4. Copy the Signing Secret → paste as `STRIPE_WEBHOOK_SECRET` in Supabase

## Checkout session metadata

The `checkout.session.completed` handler reads `session.metadata.organisation_id`
to know which organisation to update. This must be passed when creating the checkout
session from the client:

```ts
clientReferenceId: organisation?.id   // ← already set in TrialGate.tsx
```

For full metadata support, upgrade to using Stripe's server-side checkout creation
via another Edge Function so you can set `metadata: { organisation_id }` explicitly.
