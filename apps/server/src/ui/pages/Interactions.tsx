function Interactions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Interactions</h1>
        <p className="text-base-content/70 mt-1">
          View recorded consumer interactions and usage patterns
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Recent Interactions</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Consumer</th>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>order-service</td>
                  <td>web-app</td>
                  <td>getOrder</td>
                  <td><span className="badge badge-success">200</span></td>
                  <td>142ms</td>
                  <td>2 min ago</td>
                </tr>
                <tr>
                  <td>payment-service</td>
                  <td>web-app</td>
                  <td>processPayment</td>
                  <td><span className="badge badge-success">201</span></td>
                  <td>256ms</td>
                  <td>5 min ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Interactions