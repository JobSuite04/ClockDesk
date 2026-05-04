import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { useAuth } from '../../context/AuthContext'
import { StaffForm, type StaffFormValues } from './StaffForm'
import { PLAN_LIMITS } from '../../types'
import type { Profile } from '../../types'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  profile,
  onClose,
  onDeleted,
}: {
  profile: Profile
  onClose: () => void
  onDeleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id)
    if (error) { setError(error.message); setLoading(false); return }
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5 text-center space-y-3">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Delete account?</h3>
          <p className="text-sm text-gray-500">
            This will permanently delete <span className="font-medium text-gray-800">{profile.full_name}</span>'s
            account and all their timesheet and holiday data. This cannot be undone.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function StaffManagement() {
  const { profile: adminProfile, organisation } = useAuth()
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Profile | null>(null)
  const [toDelete, setToDelete] = useState<Profile | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    setStaff((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(values: StaffFormValues) {
    setError(null)
    const orgId = adminProfile?.organisation_id
    if (!orgId) { setError('No organisation found. Please reload and try again.'); return }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      values.email,
      { data: { full_name: values.full_name } },
    )
    if (authErr || !authData.user) {
      setError(authErr?.message ?? 'Failed to send invite')
      return
    }
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      full_name: values.full_name,
      email: values.email,
      job_title: values.job_title || null,
      department: values.department || null,
      start_date: values.start_date || null,
      employment_type: values.employment_type,
      hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : null,
      overtime_multiplier: parseFloat(values.overtime_multiplier),
      overtime_threshold_hours: parseInt(values.overtime_threshold_hours),
      annual_leave_allowance: parseInt(values.annual_leave_allowance),
      role: values.role,
      is_active: true,
      organisation_id: orgId,
    })
    if (profileErr) { setError(profileErr.message); return }
    setShowNew(false)
    setSuccess(`Invite sent to ${values.email}`)
    setTimeout(() => setSuccess(null), 5000)
    load()
  }

  async function handleEdit(values: StaffFormValues) {
    if (!selected) return
    setError(null)
    const { error } = await supabase.from('profiles').update({
      full_name: values.full_name,
      job_title: values.job_title || null,
      department: values.department || null,
      start_date: values.start_date || null,
      employment_type: values.employment_type,
      hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : null,
      overtime_multiplier: parseFloat(values.overtime_multiplier),
      overtime_threshold_hours: parseInt(values.overtime_threshold_hours),
      annual_leave_allowance: parseInt(values.annual_leave_allowance),
      role: values.role,
      is_active: values.is_active,
    }).eq('id', selected.id)
    if (error) { setError(error.message); return }
    setSelected(null)
    load()
  }

  const filtered = staff.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.department ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        {(() => {
          const plan = organisation?.plan ?? 'trial'
          const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? 20
          const activeStaff = staff.filter(s => s.is_active && s.role === 'staff').length
          const atLimit = activeStaff >= limit
          return (
            <div className="flex items-center gap-3">
              {atLimit && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  Plan limit reached ({activeStaff}/{limit === Infinity ? '∞' : limit}) —{' '}
                  <a href="/upgrade" className="underline font-medium">upgrade to add more</a>
                </span>
              )}
              <button
                onClick={() => atLimit ? window.location.href = '/upgrade' : setShowNew(true)}
                className={`flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ${atLimit ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add staff member
              </button>
            </div>
          )
        })()}
      </div>

      <input
        type="search"
        placeholder="Search by name, email or department…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg border border-green-200">✓ {success}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Department', 'Type', 'Hourly Rate', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No staff found</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {s.full_name}
                    {s.role === 'admin' && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Admin</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3 text-gray-500">{s.department ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-500">{s.employment_type}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.employment_type === 'hourly' && s.hourly_rate ? `£${s.hourly_rate}/hr` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelected(s)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                      <button onClick={() => setToDelete(s)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <Modal title="Add staff member" onClose={() => setShowNew(false)}>
          <StaffForm isNew onSubmit={handleCreate} onCancel={() => setShowNew(false)} />
        </Modal>
      )}

      {selected && (
        <Modal title={`Edit — ${selected.full_name}`} onClose={() => setSelected(null)}>
          <StaffForm initial={selected} onSubmit={handleEdit} onCancel={() => setSelected(null)} />
        </Modal>
      )}

      {toDelete && (
        <DeleteConfirmModal
          profile={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setSuccess(`${toDelete.full_name}'s account has been deleted`)
            setTimeout(() => setSuccess(null), 5000)
            load()
          }}
        />
      )}
    </div>
  )
}
