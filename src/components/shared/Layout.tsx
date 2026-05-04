import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { NotificationBell } from './NotificationBell'
import { TrialBannerWrapper } from './TrialGate'
import { classNames } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <polyline points="12 6 12 12 16 14" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

const adminNav: NavItem[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" strokeWidth={2} rx="1"/><rect x="14" y="3" width="7" height="7" strokeWidth={2} rx="1"/><rect x="3" y="14" width="7" height="7" strokeWidth={2} rx="1"/><rect x="14" y="14" width="7" height="7" strokeWidth={2} rx="1"/></svg>,
  },
  {
    to: '/admin/staff',
    label: 'Staff',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} strokeLinecap="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4" strokeWidth={2}/><path strokeWidth={2} strokeLinecap="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  {
    to: '/admin/timesheets',
    label: 'Timesheets',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  },
  {
    to: '/admin/holidays',
    label: 'Holidays',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2}/><line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth={2}/></svg>,
  },
]

const staffNav: NavItem[] = [
  {
    to: '/staff',
    label: 'Clock In/Out',
    icon: <ClockIcon />,
  },
  {
    to: '/staff/timesheets',
    label: 'My Timesheets',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  },
  {
    to: '/staff/holidays',
    label: 'Holidays',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2}/><line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth={2}/></svg>,
  },
  {
    to: '/staff/profile',
    label: 'My Profile',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} strokeLinecap="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4" strokeWidth={2}/></svg>,
  },
]

export function Layout() {
  const { profile, organisation, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const navItems = isAdmin ? adminNav : staffNav
  const orgName = organisation?.name ?? 'ClockDesk'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-blue-800">
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
          <polyline points="12 6 12 12 16 14" strokeWidth={2} strokeLinecap="round" />
        </svg>
        <span className="text-white font-bold text-xl tracking-tight">ClockDesk</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/staff'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              classNames(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-800 hover:text-white',
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* WorkOrder coming soon */}
      <div className="px-3 mb-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-400 opacity-50 cursor-default select-none">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 11v4m0 0l-2-2m2 2l2-2" />
          </svg>
          <span>WorkOrder</span>
          <span className="ml-auto text-xs bg-blue-800 text-blue-300 px-1.5 py-0.5 rounded font-mono">Soon</span>
        </div>
      </div>

      <div className="px-3 pb-4 border-t border-blue-800 pt-4">
        <div className="px-3 py-2 mb-2">
          <p className="text-blue-50 text-xs font-semibold truncate">{orgName}</p>
          <p className="text-blue-100 text-xs font-medium truncate mt-0.5">{profile?.full_name}</p>
          <p className="text-blue-300 text-xs truncate">{profile?.email}</p>
          {isAdmin && (
            <span className="mt-1 inline-block bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Admin</span>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-blue-100 hover:bg-blue-800 hover:text-white rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-blue-900 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-56 bg-blue-900 z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-4 md:px-6 h-14 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-700"
            onClick={() => setMobileOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <NotificationBell />
        </header>

        <TrialBannerWrapper />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
