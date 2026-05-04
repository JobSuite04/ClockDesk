import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    company_name: '',
    full_name: '',
    email: '',
    password: '',
    confirm: '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (!form.company_name.trim()) { setError('Company name is required'); return }

    setLoading(true)

    // 1. Create the organisation
    const slug = slugify(form.company_name) + '-' + Math.random().toString(36).slice(2, 6)
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organisations')
      .insert({ name: form.company_name.trim(), slug })
      .select()
      .single()

    if (orgErr || !org) {
      setError('Failed to create organisation. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create the admin user account
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name },
    })

    if (authErr || !authData.user) {
      // Roll back org creation
      await supabaseAdmin.from('organisations').delete().eq('id', org.id)
      setError(authErr?.message ?? 'Failed to create account')
      setLoading(false)
      return
    }

    // 3. Set up their admin profile attached to the org
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      full_name: form.full_name,
      email: form.email,
      role: 'admin',
      is_active: true,
      organisation_id: org.id,
      employment_type: 'salaried',
      overtime_multiplier: 1.5,
      overtime_threshold_hours: 40,
      annual_leave_allowance: 25,
    })

    if (profileErr) {
      setError('Account created but profile setup failed. Please contact support.')
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('verify')
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your <span className="font-medium text-gray-700">{form.company_name}</span> account is ready.
            Sign in to get started.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <polyline points="12 6 12 12 16 14" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up ClockDesk</h1>
          <p className="text-gray-500 text-sm mt-1">Create your company account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
            <input
              type="text"
              required
              value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Ltd"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your admin account</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your full name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="jane@acme.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password *</label>
                <input
                  type="password"
                  required
                  value={form.confirm}
                  onChange={(e) => set('confirm', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Repeat your password"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creating your account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
