import { Link, useLocation } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  icon: string
  description: string
}

const navItems: NavItem[] = [
  {
    path: '/settings/general',
    label: 'General',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    description: 'Data retention and cleanup settings',
  },
  {
    path: '/settings/keys',
    label: 'API Keys',
    icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    description: 'Manage API keys for programmatic access',
  },
  {
    path: '/settings/team',
    label: 'Team',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a.5.5 0 01.5.5v.5m0 0v.5a.5.5 0 01-.5.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    description: 'Manage team members and permissions',
  },
  {
    path: '/settings/github',
    label: 'GitHub',
    icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
    description: 'Connect your GitHub repositories',
  },
]

function SettingsNav() {
  const location = useLocation()

  return (
    <nav className="bg-base-100 rounded-lg border border-base-300 p-4">
      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path

          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-content'
                    : 'hover:bg-base-200'
                }`}
              >
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.label}</div>
                  <div className={`text-sm mt-1 ${
                    isActive ? 'text-primary-content/80' : 'text-base-content/60'
                  }`}>
                    {item.description}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default SettingsNav