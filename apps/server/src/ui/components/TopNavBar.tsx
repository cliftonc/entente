import UserMenu from './UserMenu'

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

        {/* Page title will be dynamic based on route */}
        <h1 className="text-xl font-semibold ml-4 lg:ml-0">Dashboard</h1>
      </div>

      <div className="flex-none gap-2">
        {/* Search */}
        <div className="form-control">
          <input
            type="text"
            placeholder="Search services, fixtures..."
            className="input input-bordered w-24 md:w-auto"
          />
        </div>

        {/* Notifications */}
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle">
            <div className="indicator">
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
                  d="M15 17h5l-5 5 5 5v-10z"
                />
              </svg>
              <span className="badge badge-sm indicator-item">3</span>
            </div>
          </label>
          <div
            tabIndex={0}
            className="mt-3 card card-compact dropdown-content w-52 bg-base-100 shadow"
          >
            <div className="card-body">
              <span className="font-bold text-lg">3 pending fixtures</span>
              <span className="text-info">Ready for approval</span>
              <div className="card-actions">
                <button className="btn btn-primary btn-block">View all</button>
              </div>
            </div>
          </div>
        </div>

        {/* User menu */}
        <UserMenu />
      </div>
    </div>
  )
}

export default TopNavBar