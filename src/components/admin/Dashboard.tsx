import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { formatTime, formatDate } from '../../lib/utils'
import { ReferralCard } from './ReferralCard'
import type { Profile, ClockEvent, HolidayRequest } from '../../types'

interface ClockedInUser {
  profile: Profile
  clockInTime: string
}

export function AdminDashboard() {
  const [clockedIn, setClockedIn] = useState<ClockedInUser[]>([])
  const [pendingHolidays, setPendingHolidays] = useState<HolidayRequest[]>([])
  const [staffCount, setStaffCount] = useState(0)
  const [todayAttendance, setTodayAttendance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]

      const [profilesRes, clockRes, holidayRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('id').eq('is_active', true).eq('role', 'staff'),
        supabaseAdmin
          .from('clock_events')
          .select('*, profile:profiles(*)')
          .gte('timestamp', `${today}T00:00:00`)
          .order('timestamp', { ascending: false }),
        supabaseAdmin
          .from('holiday_requests')
          .select('*, profile:profiles(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
      ])

      setStaffCount(profilesRes.data?.length ?? 0)
      setPendingHolidays((holidayRes.data as HolidayRequest[]) ?? [])

      const events: ClockEvent[] = (clockRes.data as ClockEvent[]) ?? []
      const byUser: Record<string, ClockEvent[]> = {}
      events.forEach((e) => {
        byUser[e.user_id] = byUser[e.user_id] ?? []
        byUser[e.user_id].push(e)
      })

      const active: ClockedInUser[] = []
      let attendance = 0
      Object.values(byUser).forEach((userEvents) => {
        const sorted = [...userEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        const last = sorted[sorted.length - 1]
        if (last?.event_type === 'clock_in') {
          const profile = last.profile as unknown as Profile
          if (profile) active.push({ profile, clockInTime: last.timestamp })
        }
        const hasClockIn = sorted.some((e) => e.event_type === 'clock_in')
        if (hasClockIn) attendance++
      })

      setClockedIn(active)
      setTodayAttendance(attendance)
      setLoading(false)
    }

    load()

    const channel = supabaseAdmin
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events' }, load)
      .subscribe()

    return () => { supabaseAdmin.removeChannel(channel) }
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Staff', value: staffCount, color: 'bg-blue-50 text-blue-700' },
          { label: 'Clocked In Now', value: clockedIn.length, color: 'bg-green-50 text-green-700' },
          { label: "Today's Attendance", value: todayAttendance, color: 'bg-purple-50 text-purple-700' },
          { label: 'Pending Holidays', value: pendingHolidays.length, color: 'bg-amber-50 text-amber-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color.split(' ')[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Currently clocked in */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Currently Clocked In</h2>
            <span className="text-xs text-gray-400">{formatDate(new Date().toISOString())}</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {clockedIn.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-gray-400">Nobody is clocked in</li>
            )}
            {clockedIn.map(({ profile, clockInTime }) => (
              <li key={profile.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{profile.full_name}</p>
                  <p className="text-xs text-gray-400">{profile.job_title ?? profile.department ?? '—'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-gray-500">since {formatTime(clockInTime)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Pending holiday requests */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Pending Holiday Requests</h2>
            <Link to="/admin/holidays" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {pendingHolidays.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-gray-400">No pending requests</li>
            )}
            {pendingHolidays.slice(0, 5).map((req) => (
              <li key={req.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{(req.profile as unknown as Profile)?.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(req.start_date)} — {formatDate(req.end_date)} ({req.days_requested}d)
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ReferralCard />
    </div>
  )
}
