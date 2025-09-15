import type { ReactNode } from 'react'
import SideNav from './SideNav'
import TopNavBar from './TopNavBar'

interface AdminLayoutProps {
  children: ReactNode
}

function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="drawer lg:drawer-open">
      <input id="drawer-toggle" type="checkbox" className="drawer-toggle" />

      {/* Main Content */}
      <div className="drawer-content flex flex-col">
        {/* Mobile Header - only visible on small screens */}
        <div className="lg:hidden">
          <TopNavBar />
        </div>

        {/* Main Panel */}
        <main className="flex-1 p-6 min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Left Sidebar */}
      <div className="drawer-side">
        <label htmlFor="drawer-toggle" className="drawer-overlay" />
        <SideNav />
      </div>
    </div>
  )
}

export default AdminLayout
