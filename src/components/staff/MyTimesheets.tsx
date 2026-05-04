import { useEffect, useState } from 'react'
import { addWeeks, subWeeks, format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  formatTime, formatDate, formatHours, formatCurrency,
  buildWeeklySummary, getWeekStart,
} from '../../lib/utils'
import type { ClockEvent } from '../../types'

export function MyTimesheets() {
  const { user, profile } = useAuth()
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [events, setEvents] = useState<ClockEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [weekStart, user])

  async function load() {
    if (!user) return
    setLoading(true)
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('clock_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', `${ws}T00:00:00`)
      .lt('timestamp', `${we}T00:00:00`)
      .order('timestamp')
    setEvents((data as ClockEvent[]) ?? [])
    setLoading(false)
  }

  const summary = buildWeeklySummary(
    events,
    weekStart,
    profile?.hourly_rate ?? null,
    profile?.overtime_threshold_hours ?? 40,
    profile?.overtime_multiplier ?? 1.5,
  )

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Timesheets</h1>

      {/* Week navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setWeekStart((w) => subWeeks(w, 1))}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700 w-52 text-center">
          {formatDate(weekStart.toISOString())} — {formatDate(addWeeks(weekStart, 1).toISOString())}
        </span>
        <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button onClick={() => setWeekStart(getWeekStart())} className="text-xs text-blue-600 hover:underline">This week</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Hours', value: formatHours(summary.totalHours) },
          { label: 'Regular Hours', value: formatHours(summary.regularHours) },
          { label: 'Overtime', value: formatHours(summary.overtimeHours), highlight: summary.overtimeHours > 0 },
          { label: 'Est. Gross Pay', value: summary.grossPay !== null ? formatCurrency(summary.grossPay) : 'N/A' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.highlight ? 'text-orange-600' : 'text-gray-800'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Day-by-day table */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Clock In', 'Clock Out', 'Hours', 'Note'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary.entries.map((entry) => (
                <tr key={entry.date} className={entry.isAdminEdited ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-3 text-gray-700 font-medium">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {entry.clockIn ? formatTime(entry.clockIn) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {entry.clockOut ? formatTime(entry.clockOut) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {entry.hoursWorked > 0 ? formatHours(entry.hoursWorked) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {entry.isAdminEdited && (
                      <span className="inline-flex items-center gap-1 mr-2 text-amber-600 font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edited by admin{entry.editReason ? `: ${entry.editReason}` : ''}
                      </span>
                    )}
                    {!entry.isAdminEdited && entry.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
