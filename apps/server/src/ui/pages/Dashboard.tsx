import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { statsApi } from '../utils/api'
import TimestampDisplay from '../components/TimestampDisplay'

function Dashboard() {
  const {
    data: dashboardStats,
    isLoading,
    error
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getDashboard,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <p className="text-base-content/70 mt-1">
            Overview of your contract testing ecosystem
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stats shadow">
              <div className="stat">
                <div className="skeleton h-4 w-20 mb-2"></div>
                <div className="skeleton h-8 w-16 mb-2"></div>
                <div className="skeleton h-3 w-24"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <p className="text-base-content/70 mt-1">
            Overview of your contract testing ecosystem
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Error loading dashboard data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
        <p className="text-base-content/70 mt-1">
          Overview of your contract testing ecosystem
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/services" className="stats shadow hover:shadow-lg transition-shadow">
          <div className="stat">
            <div className="stat-figure text-primary">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div className="stat-title">Active Services</div>
            <div className="stat-value">{dashboardStats?.totalServices || 0}</div>
            <div className="stat-desc">Consumers & Providers</div>
          </div>
        </Link>

        <Link to="/interactions" className="stats shadow hover:shadow-lg transition-shadow">
          <div className="stat">
            <div className="stat-figure text-secondary">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Recorded Interactions</div>
            <div className="stat-value">{dashboardStats?.totalInteractions?.toLocaleString() || 0}</div>
            <div className="stat-desc">All time total</div>
          </div>
        </Link>

        <Link to="/fixtures" className="stats shadow hover:shadow-lg transition-shadow">
          <div className="stat">
            <div className="stat-figure text-accent">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Pending Fixtures</div>
            <div className="stat-value">{dashboardStats?.pendingFixtures || 0}</div>
            <div className="stat-desc">Awaiting approval</div>
          </div>
        </Link>

        <Link to="/verification" className="stats shadow hover:shadow-lg transition-shadow">
          <div className="stat">
            <div className="stat-figure text-success">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Verification Rate</div>
            <div className="stat-value">{dashboardStats?.verificationRate || 0}%</div>
            <div className="stat-desc">Last 30 days</div>
          </div>
        </Link>
      </div>

      {/* Recent Activity and Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deployments */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title">Recent Deployments</h2>
              <Link to="/deployments" className="btn btn-ghost btn-sm">
                View All
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="space-y-3">
              {dashboardStats?.recentDeployments?.length === 0 ? (
                <div className="text-center text-base-content/70 py-8">
                  No recent deployments
                </div>
              ) : (
                dashboardStats?.recentDeployments?.slice(0, 5).map((deployment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div>
                    <Link
                      to={`/services/${deployment.type || 'provider'}/${deployment.service}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {deployment.service}
                    </Link>
                    <div className="text-sm text-base-content/70">v{deployment.version}</div>
                  </div>
                  <div className="text-right">
                    <div className={`badge ${
                      deployment.environment === 'production' ? 'badge-success' :
                      deployment.environment === 'staging' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {deployment.environment}
                    </div>
                    <div className="text-sm text-base-content/70">
                      <TimestampDisplay timestamp={deployment.deployedAt} />
                    </div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Service Health */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title">Service Health</h2>
              <Link to="/verification" className="btn btn-ghost btn-sm">
                View All
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="space-y-4">
              {dashboardStats?.serviceHealth?.length === 0 ? (
                <div className="text-center text-base-content/70 py-8">
                  No service health data available
                </div>
              ) : (
                dashboardStats?.serviceHealth?.map((service, index) => (
                <div key={index} className="flex items-center justify-between hover:bg-base-200 p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-success' :
                      service.status === 'warning' ? 'bg-warning' : 'bg-error'
                    }`} />
                    <div>
                      <Link
                        to={`/services/${service.type || 'provider'}/${service.name}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {service.name}
                      </Link>
                      <div className="text-sm text-base-content/70">
                        <Link
                          to={`/interactions?service=${service.name}`}
                          className="hover:text-primary transition-colors"
                        >
                          {service.interactions} interactions
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Link
                      to={`/verification?provider=${service.name}`}
                      className="block font-medium hover:text-primary transition-colors"
                    >
                      {Math.round(service.passRate * 10) / 10}%
                    </Link>
                    <div className="text-sm text-base-content/70">pass rate</div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Dashboard