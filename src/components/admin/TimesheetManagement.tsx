import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { format, addWeeks, subWeeks } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { formatTime, formatDate, formatHours, formatCurrency, buildWeeklySummary, getWeekStart } from '../../lib/utils'
import type { Profile, ClockEvent, WeeklySummary } from '../../types'

interface EditForm { timestamp: string; reason: string }

function EditModal({ event, onClose, onSaved }: { event: ClockEvent; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<EditForm>({
    defaultValues: { timestamp: event.timestamp.slice(0, 16), reason: '' },
  })

  async function onSubmit(values: EditForm) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('clock_events').update({
      timestamp: new Date(values.timestamp).toISOString(),
      is_admin_edited: true,
      original_timestamp: event.original_timestamp ?? event.timestamp,
      edit_reason: values.reason,
      edited_by: user?.id,
      edited_at: new Date().toISOString(),
    }).eq('id', event.id)

    await supabase.from('audit_log').insert({
      admin_id: user?.id,
      action: 'edit_clock_event',
      target_user_id: event.user_id,
      record_id: event.id,
      table_name: 'clock_events',
      old_values: { timestamp: event.timestamp },
      new_values: { timestamp: new Date(values.timestamp).toISOString(), reason: values.reason },
    })
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit {event.event_type.replace('_', ' ')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New timestamp</label>
            <input type="datetime-local" {...register('timestamp', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.timestamp && <p className="text-red-500 text-xs mt-1">{errors.timestamp.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea {...register('reason', { required: 'A reason is required for audit purposes' })} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TimesheetManagement() {
  const [staff, setStaff] = useState<Profile[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart())
  const [summaries, setSummaries] = useState<{ profile: Profile; summary: WeeklySummary }[]>([])
  const [loading, setLoading] = useState(false)
  const [editEvent, setEditEvent] = useState<ClockEvent | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [weekStart, selectedStaff])

  async function loadAll() {
    setLoading(true)
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')

    // Load profiles and clock events in parallel
    const [profilesRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('is_active', true).order('full_name'),
      (() => {
        let q = supabaseAdmin
          .from('clock_events')
          .select('*')
          .gte('timestamp', `${ws}T00:00:00`)
          .lt('timestamp', `${we}T00:00:00`)
          .order('timestamp')
        if (selectedStaff !== 'all') q = q.eq('user_id', selectedStaff)
        return q
      })(),
    ])

    const allProfiles = (profilesRes.data as Profile[]) ?? []
    setStaff(allProfiles)

    const events: ClockEvent[] = (eventsRes.data as ClockEvent[]) ?? []

    const relevantProfiles = selectedStaff === 'all'
      ? allProfiles
      : allProfiles.filter((s) => s.id === selectedStaff)

    const result = relevantProfiles.map((profile) => {
      const userEvents = events.filter((e) => e.user_id === profile.id)
      const summary = buildWeeklySummary(
        userEvents,
        weekStart,
        profile.hourly_rate,
        profile.overtime_threshold_hours,
        profile.overtime_multiplier,
      )
      return { profile, summary }
    })

    setSummaries(result)
    setLoading(false)
  }

  async function load() { await loadAll() }

  function exportCSV() {
    const rows = [['Name', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Admin Edited', 'Edit Reason']]
    summaries.forEach(({ profile, summary }) => {
      summary.entries.forEach((entry) => {
        rows.push([
          profile.full_name,
          entry.date,
          entry.clockIn ? formatTime(entry.clockIn) : '',
          entry.clockOut ? formatTime(entry.clockOut) : '',
          entry.hoursWorked.toFixed(2),
          entry.isAdminEdited ? 'Yes' : 'No',
          entry.editReason ?? '',
        ])
      })
    })
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheets-${format(weekStart, 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white px-4 py-2 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 w-44 text-center">
            {formatDate(weekStart.toISOString())} — {formatDate(addWeeks(weekStart, 1).toISOString())}
          </span>
          <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={() => setWeekStart(getWeekStart())}
            className="text-xs text-blue-600 hover:underline ml-1">Today</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-4">
          {summaries.map(({ profile, summary }) => (
            <div key={profile.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpanded((e) => (e === profile.id ? null : profile.id))}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                    {profile.full_name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{profile.full_name}</p>
                    <p className="text-xs text-gray-400">{profile.department ?? profile.job_title ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right hidden sm:block">
                    <p className="text-gray-500 text-xs">Total</p>
                    <p className="font-semibold text-gray-800">{formatHours(summary.totalHours)}</p>
                  </div>
                  {summary.overtimeHours > 0 && (
                    <div className="text-right hidden sm:block">
                      <p className="text-gray-500 text-xs">Overtime</p>
                      <p className="font-semibold text-orange-600">{formatHours(summary.overtimeHours)}</p>
                    </div>
                  )}
                  {summary.grossPay !== null && (
                    <div className="text-right">
                      <p className="text-gray-500 text-xs">Gross pay</p>
                      <p className="font-semibold text-gray-800">{formatCurrency(summary.grossPay)}</p>
                    </div>
                  )}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded === profile.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expanded === profile.id && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Date', 'Clock In', 'Clock Out', 'Hours', 'Note', ''].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.entries.map((entry) => (
                        <tr key={entry.date} className={entry.isAdminEdited ? 'bg-amber-50' : ''}>
                          <td className="px-4 py-2 text-gray-700">{formatDate(entry.date)}</td>
                          <td className="px-4 py-2 text-gray-700">{entry.clockIn ? formatTime(entry.clockIn) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2 text-gray-700">{entry.clockOut ? formatTime(entry.clockOut) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2 font-medium text-gray-800">{entry.hoursWorked > 0 ? formatHours(entry.hoursWorked) : '—'}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">
                            {entry.isAdminEdited && <span className="text-amber-600 mr-1">✎</span>}
                            {entry.editReason ?? entry.note ?? ''}
                          </td>
                          <td className="px-4 py-2">
                            {(entry.clockIn || entry.clockOut) && (
                              <button
                                onClick={async () => {
                                  const { data } = await supabase.from('clock_events')
                                    .select('*')
                                    .eq('user_id', profile.id)
                                    .gte('timestamp', `${entry.date}T00:00:00`)
                                    .lt('timestamp', `${entry.date}T23:59:59`)
                                    .order('timestamp')
                                    .limit(1)
                                  if (data?.[0]) setEditEvent(data[0] as ClockEvent)
                                }}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {summaries.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-400">No timesheet data for this period</div>
          )}
        </div>
      )}

      {editEvent && (
        <EditModal event={editEvent} onClose={() => setEditEvent(null)} onSaved={load} />
      )}
    </div>
  )
}
