import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatTime, formatDate, formatHours } from '../../lib/utils'
import { differenceInSeconds } from 'date-fns'

export function ClockInOut() {
  const { user, profile, organisation } = useAuth()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [todayEvents, setTodayEvents] = useState<{ event_type: string; timestamp: string; note: string | null }[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadState() {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('clock_events')
      .select('event_type, timestamp, note')
      .eq('user_id', user.id)
      .gte('timestamp', `${today}T00:00:00`)
      .order('timestamp', { ascending: false })

    const events = data ?? []
    setTodayEvents([...events].reverse())

    const last = events[0]
    if (last?.event_type === 'clock_in') {
      setClockedIn(true)
      setClockInTime(last.timestamp)
    } else {
      setClockedIn(false)
      setClockInTime(null)
    }
    setFetching(false)
  }

  useEffect(() => {
    loadState()
  }, [user])

  useEffect(() => {
    if (clockedIn && clockInTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), new Date(clockInTime)))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setElapsed(0)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [clockedIn, clockInTime])

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  async function handleClock() {
    if (!user) return
    setLoading(true)
    const eventType = clockedIn ? 'clock_out' : 'clock_in'
    await supabase.from('clock_events').insert({
      user_id: user.id,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      note: note.trim() || null,
      organisation_id: profile?.organisation_id ?? null,
    })
    setNote('')
    await loadState()
    setLoading(false)
  }

  if (fetching) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clock In / Out</h1>

      {/* Main clock card */}
      <div className={`rounded-2xl p-8 text-center transition-colors ${clockedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-white border-2 border-gray-200'}`}>
        <p className="text-sm font-medium text-gray-500 mb-1">{formatDate(new Date().toISOString())}</p>
        <p className="text-5xl font-mono font-bold text-gray-800 mb-1 tabular-nums">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>

        {clockedIn && clockInTime && (
          <div className="mt-4 mb-2">
            <p className="text-sm text-gray-500">Clocked in at {formatTime(clockInTime)}</p>
            <p className="text-3xl font-mono font-semibold text-green-600 mt-1">{formatElapsed(elapsed)}</p>
          </div>
        )}

        {!clockedIn && (
          <p className="text-sm text-gray-400 mt-4 mb-2">You are not clocked in</p>
        )}

        {/* Note field */}
        <div className="mt-5 text-left">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            {clockedIn ? 'Note (optional)' : 'Note (optional)'}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={clockedIn ? 'e.g. Job reference, site name…' : 'e.g. Working from home…'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          onClick={handleClock}
          disabled={loading}
          className={`mt-4 w-full py-4 rounded-xl text-lg font-bold transition-colors disabled:opacity-60
            ${clockedIn
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {loading ? '…' : clockedIn ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {/* Today's events */}
      {todayEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Today's events</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {todayEvents.map((e, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${e.event_type === 'clock_in' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-gray-700 capitalize">{e.event_type.replace('_', ' ')}</span>
                  {e.note && <span className="text-xs text-gray-400">— {e.note}</span>}
                </div>
                <span className="text-sm text-gray-500">{formatTime(e.timestamp)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
