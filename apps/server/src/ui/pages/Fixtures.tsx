function Fixtures() {
  const pendingFixtures = [
    {
      id: 'fixture_1',
      service: 'order-service',
      operation: 'getOrder',
      source: 'consumer',
      createdAt: '2024-01-15T10:30:00Z',
      createdBy: 'consumer-test',
    },
    {
      id: 'fixture_2',
      service: 'payment-service',
      operation: 'processPayment',
      source: 'provider',
      createdAt: '2024-01-15T09:15:00Z',
      createdBy: 'provider-verification',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixtures</h1>
          <p className="text-base-content/70 mt-1">
            Manage test fixtures and approve proposals
          </p>
        </div>
        <button className="btn btn-success">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Approve All
        </button>
      </div>

      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>You have {pendingFixtures.length} fixtures awaiting approval</span>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Pending Fixtures</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Operation</th>
                  <th>Source</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingFixtures.map((fixture) => (
                  <tr key={fixture.id}>
                    <td>{fixture.service}</td>
                    <td>
                      <code className="bg-base-200 px-2 py-1 rounded">
                        {fixture.operation}
                      </code>
                    </td>
                    <td>
                      <span className={`badge ${
                        fixture.source === 'consumer' ? 'badge-primary' : 'badge-secondary'
                      }`}>
                        {fixture.source}
                      </span>
                    </td>
                    <td>{new Date(fixture.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-success btn-sm">Approve</button>
                        <button className="btn btn-error btn-sm">Reject</button>
                        <button className="btn btn-ghost btn-sm">View</button>
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

export default Fixtures