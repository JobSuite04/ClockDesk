import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { Layout } from './components/shared/Layout'
import { LoginPage } from './components/shared/LoginPage'
import { AcceptInvite } from './components/shared/AcceptInvite'
import { RegisterPage } from './components/shared/RegisterPage'
import { UpgradePage } from './components/shared/TrialGate'

// Admin pages
import { AdminDashboard } from './components/admin/Dashboard'
import { StaffManagement } from './components/admin/StaffManagement'
import { TimesheetManagement } from './components/admin/TimesheetManagement'
import { HolidayCalendar } from './components/admin/HolidayCalendar'

// Staff pages
import { ClockInOut } from './components/staff/ClockInOut'
import { MyTimesheets } from './components/staff/MyTimesheets'
import { HolidayRequests } from './components/staff/HolidayRequests'
import { MyProfile } from './components/staff/MyProfile'

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/staff'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Admin portal */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="timesheets" element={<TimesheetManagement />} />
        <Route path="holidays" element={<HolidayCalendar />} />
      </Route>

      {/* Staff portal */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute role="staff">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClockInOut />} />
        <Route path="timesheets" element={<MyTimesheets />} />
        <Route path="holidays" element={<HolidayRequests />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>

      <Route path="/upgrade" element={<UpgradePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
