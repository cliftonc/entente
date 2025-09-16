import { CodeBracketIcon, CogIcon, KeyIcon, UsersIcon } from '@heroicons/react/24/outline'
import { Link, useLocation } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    path: '/settings/general',
    label: 'General',
    icon: CogIcon,
  },
  {
    path: '/settings/keys',
    label: 'API Keys',
    icon: KeyIcon,
  },
  {
    path: '/settings/team',
    label: 'Team',
    icon: UsersIcon,
  },
  {
    path: '/settings/github',
    label: 'GitHub',
    icon: CodeBracketIcon,
  },
]

function SettingsNav() {
  const location = useLocation()

  return (
    <nav className="bg-base-100 rounded-lg border border-base-300 p-4">
      <ul className="space-y-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path
          const IconComponent = item.icon

          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
                }`}
              >
                <IconComponent className="w-5 h-5 flex-shrink-0" />
                <div className="font-medium">{item.label}</div>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default SettingsNav
