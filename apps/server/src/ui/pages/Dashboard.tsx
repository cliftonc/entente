function Dashboard() {
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
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-figure text-primary">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div className="stat-title">Active Services</div>
            <div className="stat-value">12</div>
            <div className="stat-desc">↗︎ 2 new this week</div>
          </div>
        </div>

        <div className="stats shadow">
          <div className="stat">
            <div className="stat-figure text-secondary">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Recorded Interactions</div>
            <div className="stat-value">2,847</div>
            <div className="stat-desc">↗︎ 12% from last month</div>
          </div>
        </div>

        <div className="stats shadow">
          <div className="stat">
            <div className="stat-figure text-accent">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Pending Fixtures</div>
            <div className="stat-value">3</div>
            <div className="stat-desc">Awaiting approval</div>
          </div>
        </div>

        <div className="stats shadow">
          <div className="stat">
            <div className="stat-figure text-success">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-title">Verification Rate</div>
            <div className="stat-value">96.3%</div>
            <div className="stat-desc">↗︎ 1.2% improvement</div>
          </div>
        </div>
      </div>

      {/* Recent Activity and Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deployments */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Recent Deployments</h2>
            <div className="space-y-3">
              {[
                { service: 'order-service', version: '2.1.0', env: 'production', time: '2 hours ago' },
                { service: 'payment-service', version: '1.8.0', env: 'staging', time: '4 hours ago' },
                { service: 'user-service', version: '3.0.0', env: 'development', time: '1 day ago' },
              ].map((deployment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div>
                    <div className="font-medium">{deployment.service}</div>
                    <div className="text-sm text-base-content/70">v{deployment.version}</div>
                  </div>
                  <div className="text-right">
                    <div className={`badge ${
                      deployment.env === 'production' ? 'badge-success' :
                      deployment.env === 'staging' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {deployment.env}
                    </div>
                    <div className="text-sm text-base-content/70">{deployment.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Health */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Service Health</h2>
            <div className="space-y-4">
              {[
                { name: 'order-service', status: 'healthy', interactions: 450, passRate: 98.2 },
                { name: 'payment-service', status: 'healthy', interactions: 320, passRate: 99.1 },
                { name: 'user-service', status: 'warning', interactions: 180, passRate: 94.5 },
                { name: 'notification-service', status: 'healthy', interactions: 95, passRate: 97.8 },
              ].map((service, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-success' :
                      service.status === 'warning' ? 'bg-warning' : 'bg-error'
                    }`} />
                    <div>
                      <div className="font-medium">{service.name}</div>
                      <div className="text-sm text-base-content/70">
                        {service.interactions} interactions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{service.passRate}%</div>
                    <div className="text-sm text-base-content/70">pass rate</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <button className="btn btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New Spec
            </button>
            <button className="btn btn-secondary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approve Fixtures
            </button>
            <button className="btn btn-accent">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Verification
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard