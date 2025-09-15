
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
        <div className="flex items-center gap-2 ml-4 lg:hidden">
          <div className="avatar">
            <div className="w-8 rounded bg-primary text-primary-content">
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-lg font-bold">E</span>
              </div>
            </div>
          </div>
          <span className="text-xl font-bold">Entente</span>
        </div>
      </div>

    </div>
  )
}

export default TopNavBar
