import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTrialStatus, ExpiredScreen } from './TrialGate'
import type { Role } from '../../types'

interface Props {
  role?: Role
  children: React.ReactNode
}

export function ProtectedRoute({ role, children }: Props) {
  const { user, profile, loading } = useAuth()
  const { isExpired } = useTrialStatus()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (role && profile?.role !== role) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/staff'} replace />
  }

  // Hard block on expired trial — admin sees upgrade screen, staff see a message
  if (isExpired) {
    if (profile?.role === 'admin') return <ExpiredScreen />
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2} strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access paused</h2>
          <p className="text-gray-500 text-sm">Your company's trial has expired. Please contact your administrator to reactivate access.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
