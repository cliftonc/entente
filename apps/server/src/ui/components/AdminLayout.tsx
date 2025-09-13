import { ReactNode } from 'react'
import TopNavBar from './TopNavBar'
import SideNav from './SideNav'

interface AdminLayoutProps {
  children: ReactNode
}

function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="drawer lg:drawer-open">
      <input id="drawer-toggle" type="checkbox" className="drawer-toggle" />
      
      {/* Main Content */}
      <div className="drawer-content flex flex-col">
        {/* Top Navigation */}
        <TopNavBar />
        
        {/* Main Panel */}
        <main className="flex-1 p-6 bg-base-200 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
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