import { Link, useLocation } from 'react-router-dom'
import { useDraftFixturesCount } from '../hooks/useQueries'

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
    path: '/interactions',
    label: 'Interactions',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
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
]

function SideNav() {
  const location = useLocation()
  const { data: draftCount = 0 } = useDraftFixturesCount()

  return (
    <aside className="min-h-full w-80 bg-base-100 text-base-content">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-6">
        <div className="avatar">
          <div className="w-8 rounded bg-primary text-primary-content">
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-lg font-bold">E</span>
            </div>
          </div>
        </div>
        <span className="text-xl font-bold">Entente</span>
      </div>

      {/* Navigation Menu */}
      <ul className="menu p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-content'
                    : 'hover:bg-base-200'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="flex-1">{item.label}</span>
                {item.path === '/fixtures' && draftCount > 0 && (
                  <span className="badge badge-primary badge-sm">
                    {draftCount}
                  </span>
                )}
                {item.badge && item.path !== '/fixtures' && (
                  <span className="badge badge-primary badge-sm">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="bg-base-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-sm font-medium">System Status</span>
          </div>
          <p className="text-xs text-base-content/70">
            All services operational
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs">API:</span>
            <div className="flex-1 bg-base-300 rounded-full h-1">
              <div className="bg-success h-1 rounded-full" style={{ width: '85%' }}></div>
            </div>
            <span className="text-xs">85%</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default SideNav