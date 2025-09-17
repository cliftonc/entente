import { Link } from 'react-router-dom'
import { WebSocketStatus } from './WebSocketStatus'

function TopNavBar() {
  return (
    <div className="navbar bg-base-100 shadow-sm border-b border-base-300">
      <div className="flex-1">
        {/* Mobile menu button */}
        <label htmlFor="drawer-toggle" className="btn btn-square btn-ghost lg:hidden">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>

        {/* Mobile logo - only visible when sidebar is collapsed */}
        <Link
          to="/"
          className="flex items-center gap-1 ml-4 lg:hidden hover:bg-base-200 p-2 rounded transition-colors"
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
      </div>

      {/* Right side of navbar */}
      <div className="flex-none">
        <div className="flex items-center space-x-4">
          {/* WebSocket Status Indicator */}
          <WebSocketStatus />
        </div>
      </div>
    </div>
  )
}

export default TopNavBar
