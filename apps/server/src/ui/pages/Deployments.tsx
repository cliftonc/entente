function Deployments() {
  const activeDeployments = [
    {
      service: 'order-service',
      version: '2.1.0',
      environment: 'production',
      deployedAt: '2024-01-15T10:30:00Z',
      deployedBy: 'ci-cd-bot',
    },
    {
      service: 'payment-service',
      version: '1.8.0',
      environment: 'production',
      deployedAt: '2024-01-14T16:20:00Z',
      deployedBy: 'ci-cd-bot',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Deployments</h1>
        <p className="text-base-content/70 mt-1">
          Track service deployments across environments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Production</div>
            <div className="stat-value text-success">4</div>
            <div className="stat-desc">active services</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Staging</div>
            <div className="stat-value text-warning">4</div>
            <div className="stat-desc">active services</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Development</div>
            <div className="stat-value text-info">4</div>
            <div className="stat-desc">active services</div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Active Deployments</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Version</th>
                  <th>Environment</th>
                  <th>Deployed By</th>
                  <th>Deployed At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeDeployments.map((deployment, index) => (
                  <tr key={index}>
                    <td className="font-medium">{deployment.service}</td>
                    <td>
                      <span className="badge badge-outline">
                        v{deployment.version}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        deployment.environment === 'production' ? 'badge-success' :
                        deployment.environment === 'staging' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {deployment.environment}
                      </span>
                    </td>
                    <td>{deployment.deployedBy}</td>
                    <td>{new Date(deployment.deployedAt).toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-success rounded-full"></div>
                        <span className="text-sm">Active</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Deployments