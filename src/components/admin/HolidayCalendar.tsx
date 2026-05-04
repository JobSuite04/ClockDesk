import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, parseISO, isWithinInterval } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { isUKBankHoliday, formatDate } from '../../lib/utils'
import type { HolidayRequest, Profile } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400',
  approved: 'bg-green-400',
  declined: 'bg-red-400',
}

function ReviewModal({
  request,
  onClose,
  onSaved,
}: {
  request: HolidayRequest
  onClose: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const profile = request.profile as unknown as Profile

  async function decide(status: 'approved' | 'declined') {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('holiday_requests').update({
      status,
      admin_note: note || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', request.id)

    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'holiday_decision',
      title: `Holiday request ${status}`,
      message: `Your request for ${formatDate(request.start_date)} – ${formatDate(request.end_date)} has been ${status}.${note ? ` Note: ${note}` : ''}`,
      related_id: request.id,
      organisation_id: request.organisation_id ?? null,
    })

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Review Holiday Request</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <p><span className="text-gray-500">Staff:</span> <span className="font-medium">{profile?.full_name}</span></p>
            <p><span className="text-gray-500">Dates:</span> {formatDate(request.start_date)} — {formatDate(request.end_date)}</p>
            <p><span className="text-gray-500">Days:</span> {request.days_requested}</p>
            {request.note && <p><span className="text-gray-500">Note:</span> {request.note}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => decide('declined')} disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60">
              Decline
            </button>
            <button onClick={() => decide('approved')} disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HolidayCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [requests, setRequests] = useState<HolidayRequest[]>([])
  const [reviewing, setReviewing] = useState<HolidayRequest | null>(null)
  const [tab, setTab] = useState<'calendar' | 'list'>('calendar')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all')

  async function load() {
    const { data } = await supabase
      .from('holiday_requests')
      .select('*, profile:profiles(*)')
      .order('created_at', { ascending: false })
    setRequests((data as HolidayRequest[]) ?? [])
  }

  useEffect(() => { load() }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  function getRequestsForDay(date: Date) {
    const str = format(date, 'yyyy-MM-dd')
    return requests.filter((r) => {
      if (r.status === 'declined') return false
      return isWithinInterval(parseISO(str), { start: parseISO(r.start_date), end: parseISO(r.end_date) })
    })
  }

  const filtered = requests.filter((r) => statusFilter === 'all' || r.status === statusFilter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Holidays</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setTab('calendar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'calendar' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            Calendar
          </button>
          <button onClick={() => setTab('list')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            Requests
          </button>
        </div>
      </div>

      {tab === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-800">{format(currentMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-400 text-center">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calDays.map((day) => {
              const str = format(day, 'yyyy-MM-dd')
              const dayRequests = getRequestsForDay(day)
              const isBankHol = isUKBankHoliday(str)
              const inMonth = isSameMonth(day, currentMonth)
              return (
                <div key={str}
                  className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 ${!inMonth ? 'bg-gray-50' : ''} ${isToday(day) ? 'bg-blue-50' : ''}`}>
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday(day) ? 'bg-blue-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}
                    ${isBankHol ? 'ring-1 ring-red-300' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  {isBankHol && <div className="text-xs text-red-500 truncate">Bank holiday</div>}
                  {dayRequests.slice(0, 3).map((r) => {
                    const p = r.profile as unknown as Profile
                    return (
                      <div key={r.id}
                        className={`text-xs truncate px-1 py-0.5 rounded mb-0.5 ${STATUS_COLORS[r.status]} text-white cursor-pointer`}
                        onClick={() => r.status === 'pending' && setReviewing(r)}
                        title={`${p?.full_name} — ${r.status}`}>
                        {p?.full_name?.split(' ')[0]}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Pending</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Approved</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-red-300 bg-white" /> Bank Holiday</span>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            {(['all', 'pending', 'approved', 'declined'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-sm px-3 py-1 rounded-full capitalize transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {s}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Staff', 'Dates', 'Days', 'Note', 'Status', 'Admin Note', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No requests</td></tr>
              )}
              {filtered.map((r) => {
                const p = r.profile as unknown as Profile
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p?.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.start_date)} — {formatDate(r.end_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.days_requested}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{r.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                        ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.admin_note ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <button onClick={() => setReviewing(r)} className="text-xs text-blue-600 hover:underline font-medium">Review</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewModal request={reviewing} onClose={() => setReviewing(null)} onSaved={load} />
      )}
    </div>
  )
}
