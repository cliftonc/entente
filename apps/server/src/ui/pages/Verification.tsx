function Verification() {
  const verificationResults = [
    {
      provider: 'order-service',
      version: '2.1.0',
      consumer: 'web-app',
      passed: 15,
      total: 15,
      lastRun: '2024-01-15T10:30:00Z',
      status: 'passed',
    },
    {
      provider: 'payment-service',
      version: '1.8.0',
      consumer: 'web-app',
      passed: 11,
      total: 12,
      lastRun: '2024-01-15T09:15:00Z',
      status: 'failed',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Verification</h1>
          <p className="text-base-content/70 mt-1">
            Monitor provider verification results and contract compliance
          </p>
        </div>
        <button className="btn btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Run Verification
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Overall Pass Rate</div>
            <div className="stat-value text-success">96.3%</div>
            <div className="stat-desc">↗︎ 1.2% from last week</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total Verifications</div>
            <div className="stat-value">145</div>
            <div className="stat-desc">this week</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Failed Tests</div>
            <div className="stat-value text-error">3</div>
            <div className="stat-desc">require attention</div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Recent Verification Results</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Consumer</th>
                  <th>Version</th>
                  <th>Results</th>
                  <th>Pass Rate</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {verificationResults.map((result, index) => (
                  <tr key={index}>
                    <td className="font-medium">{result.provider}</td>
                    <td>{result.consumer}</td>
                    <td>
                      <span className="badge badge-outline">
                        v{result.version}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">
                        {result.passed}/{result.total}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-base-300 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              (result.passed / result.total) === 1 ? 'bg-success' : 'bg-error'
                            }`}
                            style={{ width: `${(result.passed / result.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm">
                          {Math.round((result.passed / result.total) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td>{new Date(result.lastRun).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${
                        result.status === 'passed' ? 'badge-success' : 'badge-error'
                      }`}>
                        {result.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs">View</button>
                        <button className="btn btn-ghost btn-xs">Rerun</button>
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

export default Verification