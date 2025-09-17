import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDraftFixturesCount } from '../hooks/useFixtures'
import TenantSelector from './TenantSelector'

interface NavItem {
  path: string
  label: string
  icon: string
  badge?: string
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    path: '/services',
    label: 'Services',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    path: '/contracts',
    label: 'Contracts',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    path: '/fixtures',
    label: 'Fixtures',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    path: '/deployments',
    label: 'Deployments',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  },
  {
    path: '/verification',
    label: 'Verification',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
]

function SideNav() {
  const location = useLocation()
  const { data: draftCount = 0 } = useDraftFixturesCount()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  const handleNavClick = () => {
    const drawerToggle = document.getElementById('drawer-toggle') as HTMLInputElement
    if (drawerToggle && window.innerWidth < 1024) {
      drawerToggle.checked = false
    }
  }

  return (
    <aside className="min-h-full w-80 bg-base-100 text-base-content">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-6">
        <Link
          to="/"
          className="flex items-center gap-1 hover:bg-base-200 transition-colors rounded px-2 py-1"
        >
          <div className="avatar">
            <div className="w-8 rounded bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white">
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-lg font-bold">E</span>
              </div>
            </div>
          </div>
          <span className="text-xl font-bold">ntente</span>
        </Link>

        <a
          href="https://docs.entente.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 text-sm text-base-content/70 hover:text-base-content hover:bg-base-200 rounded transition-colors"
          title="Documentation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          Docs
        </a>
      </div>

      {/* Tenant Selector */}
      {user && (
        <div className="px-4 pb-4">
          <TenantSelector />
        </div>
      )}

      {/* Navigation Menu */}
      <ul className="menu p-4 space-y-2">
        {navItems.map(item => {
          const isActive =
            item.path === '/settings'
              ? location.pathname.startsWith('/settings')
              : location.pathname === item.path

          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 focus:from-blue-700 focus:to-indigo-700 active:from-blue-700 active:to-indigo-700 hover:text-white focus:text-white active:text-white'
                    : 'text-base-content hover:bg-base-200 hover:text-base-content focus:bg-base-200 focus:text-base-content active:bg-base-300 active:text-base-content'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="flex-1">{item.label}</span>
                {item.path === '/fixtures' && draftCount > 0 && (
                  <span className="badge badge-primary badge-sm">{draftCount}</span>
                )}
                {item.badge && item.path !== '/fixtures' && (
                  <span className="badge badge-primary badge-sm">{item.badge}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* User Settings section at bottom */}
      {user && (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-base-200 rounded-lg p-4 space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="avatar">
                <div className="w-10 rounded-full">
                  {user.avatarUrl ? (
                    <img alt={user.name} src={user.avatarUrl} />
                  ) : (
                    <div className="bg-primary text-primary-content w-full h-full flex items-center justify-center text-sm font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-base-content/70 truncate">@{user.username}</div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-ghost btn-sm btn-circle text-error"
                title="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default SideNav
