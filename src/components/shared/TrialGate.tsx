import { useState } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { loadStripe } from '@stripe/stripe-js'
import { useAuth } from '../../context/AuthContext'
import { PLAN_PRICES } from '../../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: { monthly: import.meta.env.VITE_STRIPE_STARTER_MONTHLY_PRICE_ID, annual: import.meta.env.VITE_STRIPE_STARTER_ANNUAL_PRICE_ID },
  growth:  { monthly: import.meta.env.VITE_STRIPE_GROWTH_MONTHLY_PRICE_ID,  annual: import.meta.env.VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID },
  pro:     { monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID,     annual: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID },
}

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 3
  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm ${urgent ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
      <span className="font-medium">
        {daysLeft === 0
          ? 'Your trial expires today'
          : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial`}
      </span>
      <a href="/upgrade" className="ml-4 bg-white text-gray-900 text-xs font-semibold px-3 py-1 rounded-full hover:bg-gray-100 transition-colors">
        Upgrade now
      </a>
    </div>
  )
}

export function useTrialStatus() {
  const { organisation } = useAuth()
  if (!organisation) return { isExpired: false, daysLeft: 14, showBanner: false, isTrial: false }

  const plan = organisation.plan
  const isTrial = plan === 'trial'
  const isExpired = plan === 'expired' || organisation.subscription_status === 'expired'
  const daysLeft = isTrial
    ? Math.max(0, differenceInDays(parseISO(organisation.trial_ends_at), new Date()))
    : 0

  // Check if trial has ended even if DB hasn't been updated by webhook yet
  const trialActuallyExpired = isTrial && daysLeft === 0

  return {
    isExpired: isExpired || trialActuallyExpired,
    daysLeft,
    showBanner: isTrial && daysLeft > 0 && daysLeft <= 7,
    isTrial,
  }
}

export function TrialBannerWrapper() {
  const { showBanner, daysLeft } = useTrialStatus()
  if (!showBanner) return null
  return <TrialBanner daysLeft={daysLeft} />
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: PLAN_PRICES.starter.monthly,
    annual: PLAN_PRICES.starter.annual,
    description: 'For small trade businesses and single-site contractors.',
    limit: '20 employees',
    features: ['Up to 20 employees', 'Clock-in / clock-out', 'Full attendance history', 'Payroll-ready CSV export', 'Email support'],
    featured: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    monthly: PLAN_PRICES.growth.monthly,
    annual: PLAN_PRICES.growth.annual,
    description: 'For established contractors and SME manufacturers.',
    limit: '75 employees',
    features: ['Up to 75 employees', 'Everything in Starter', 'Multi-site support', 'Advanced reporting', 'Admin roles and permissions', 'Priority email support'],
    featured: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: PLAN_PRICES.pro.monthly,
    annual: PLAN_PRICES.pro.annual,
    description: 'For larger operations with unlimited headcount.',
    limit: 'Unlimited employees',
    features: ['Unlimited employees', 'Everything in Growth', 'Custom export formats', 'WorkOrder access when live', 'Phone and email support'],
    featured: false,
  },
]

export function UpgradePage() {
  const { organisation, profile } = useAuth()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(planKey: string) {
    setLoading(planKey)
    const stripe = await stripePromise
    if (!stripe) { setLoading(null); return }

    const priceId = PRICE_IDS[planKey]?.[billing]
    if (!priceId) {
      alert('Stripe price IDs not configured. Please add them to your .env file.')
      setLoading(null)
      return
    }

    const { error } = await stripe.redirectToCheckout({
      lineItems: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      successUrl: `${window.location.origin}/admin?upgraded=1`,
      cancelUrl: `${window.location.origin}/upgrade`,
      customerEmail: profile?.email,
      clientReferenceId: organisation?.id,
    })
    if (error) { console.error(error); setLoading(null) }
  }

  const savingPct = Math.round((1 - PLAN_PRICES.starter.annual / (PLAN_PRICES.starter.monthly * 12)) * 100)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <polyline points="12 6 12 12 16 14" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span className="text-2xl font-bold text-gray-900">ClockDesk</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose your plan</h1>
          <p className="text-gray-500">Flat-rate pricing. No per-user charges. Cancel any time.</p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${billing === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${billing === 'annual' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Annual
              </button>
            </div>
            {billing === 'annual' && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                Save {savingPct}%
              </span>
            )}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`rounded-2xl p-7 border relative ${plan.featured ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white border-gray-200'}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-4 py-1 rounded-full tracking-wide">
                  Most Popular
                </div>
              )}
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${plan.featured ? 'text-blue-300' : 'text-gray-400'}`}>
                {plan.name}
              </p>
              <div className="mb-1">
                <span className={`text-4xl font-bold tracking-tight ${plan.featured ? 'text-white' : 'text-gray-900'}`}>
                  £{billing === 'monthly' ? plan.monthly : plan.annual}
                </span>
                <span className={`text-sm ml-1 ${plan.featured ? 'text-blue-200' : 'text-gray-400'}`}>
                  /{billing === 'monthly' ? 'mo' : 'yr'}
                </span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs text-green-400 mb-3 font-medium font-mono">
                  Saving £{plan.monthly * 12 - plan.annual} vs monthly
                </p>
              )}
              <p className={`text-sm mb-5 ${plan.featured ? 'text-blue-200' : 'text-gray-500'}`}>{plan.description}</p>
              <hr className={`mb-5 ${plan.featured ? 'border-blue-700' : 'border-gray-100'}`} />
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${plan.featured ? 'text-blue-100' : 'text-gray-600'}`}>
                    <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.key)}
                disabled={loading === plan.key}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60
                  ${plan.featured
                    ? 'bg-blue-500 hover:bg-blue-400 text-white'
                    : 'bg-gray-900 hover:bg-gray-700 text-white'}`}
              >
                {loading === plan.key ? 'Redirecting…' : `Start with ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Flat-rate callout */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
          <p className="text-sm text-blue-800">
            <strong>Flat-rate advantage:</strong> At 20 employees, Deputy costs £70/month. ClockDesk Starter is <strong>£29/month regardless</strong> of team size.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ExpiredScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2} strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your trial has ended</h1>
        <p className="text-gray-500 mb-6">
          Your 14-day free trial has expired. Upgrade to keep full access to ClockDesk — your data is safe and waiting for you.
        </p>
        <a
          href="/upgrade"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          View plans and upgrade
        </a>
        <p className="text-xs text-gray-400 mt-4 font-mono">Data retained for 30 days · No card required during trial</p>
      </div>
    </div>
  )
}
