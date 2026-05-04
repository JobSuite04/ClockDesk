import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, countWorkingDays } from '../../lib/utils'
import { parseISO } from 'date-fns'
import type { HolidayRequest } from '../../types'

interface RequestForm {
  start_date: string
  end_date: string
  note: string
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
}

export function HolidayRequests() {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState<HolidayRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { isSubmitting, errors }, reset } = useForm<RequestForm>()
  const startDate = watch('start_date')
  const endDate = watch('end_date')

  const previewDays = startDate && endDate && endDate >= startDate
    ? countWorkingDays(parseISO(startDate), parseISO(endDate))
    : 0

  const usedDays = requests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + r.days_requested, 0)

  const allowance = profile?.annual_leave_allowance ?? 0
  const remaining = allowance - usedDays

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('holiday_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRequests((data as HolidayRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function onSubmit(values: RequestForm) {
    if (!user) return
    setError(null)
    if (previewDays <= 0) { setError('End date must be after start date'); return }
    if (previewDays > remaining) { setError(`Insufficient allowance. You have ${remaining} days remaining.`); return }

    const { error: err } = await supabase.from('holiday_requests').insert({
      user_id: user.id,
      start_date: values.start_date,
      end_date: values.end_date,
      days_requested: previewDays,
      note: values.note.trim() || null,
      status: 'pending',
      organisation_id: profile?.organisation_id ?? null,
    })
    if (err) { setError(err.message); return }

    // Notify admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true).eq('organisation_id', profile?.organisation_id ?? '')
    if (admins?.length) {
      await supabase.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.id,
          type: 'holiday_request',
          title: 'New holiday request',
          message: `${profile?.full_name} has requested ${previewDays} day(s) off: ${formatDate(values.start_date)} — ${formatDate(values.end_date)}`,
          organisation_id: profile?.organisation_id ?? null,
        })),
      )
    }

    reset()
    setShowForm(false)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Holiday Requests</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New request
        </button>
      </div>

      {/* Allowance overview */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Annual Allowance', value: `${allowance}d` },
          { label: 'Used', value: `${usedDays}d`, muted: true },
          { label: 'Remaining', value: `${remaining}d`, highlight: remaining < 5 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.highlight ? 'text-red-600' : s.muted ? 'text-gray-400' : 'text-gray-800'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Request form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Submit a request</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
                <input type="date" {...register('start_date', { required: 'Required' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date *</label>
                <input type="date" {...register('end_date', { required: 'Required' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date.message}</p>}
              </div>
            </div>
            {previewDays > 0 && (
              <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                This request covers <strong>{previewDays} working day{previewDays !== 1 ? 's' : ''}</strong> (excluding weekends and UK bank holidays).
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea {...register('note')} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); reset(); setError(null) }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {isSubmitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request history */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Request history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Dates', 'Days', 'Note', 'Status', 'Admin note'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No requests yet</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{formatDate(r.start_date)} — {formatDate(r.end_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.days_requested}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.admin_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
