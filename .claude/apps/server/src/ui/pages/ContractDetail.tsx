import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import GitShaLink from '../components/GitShaLink'
import TimestampDisplay from '../components/TimestampDisplay'
import VersionBadge from '../components/VersionBadge'
import { contractApi, verificationApi } from '../utils/api'

function ContractDetail() {
  const { id } = useParams<{ id: string }>()

  const {
    data: contract,
    isLoading: contractLoading,
    error: contractError,
  } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractApi.getById(id!),
    enabled: !!id,
  })

  const {
    data: interactions,
    isLoading: interactionsLoading,
    error: interactionsError,
  } = useQuery({
    queryKey: ['contract-interactions', id],
    queryFn: () => contractApi.getInteractions(id!, 100),
    enabled: !!id,
  })

  const {
    data: verificationData,
    isLoading: verificationLoading,
    error: verificationError,
  } = useQuery({
    queryKey: ['contract-verification', id],
    queryFn: () => verificationApi.getByContract(id!),
    enabled: !!id,
  })

  const isLoading = contractLoading || interactionsLoading || verificationLoading
  const error = contractError || interactionsError || verificationError

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success'
      case 'archived':
        return 'badge-warning'
      case 'deprecated':
        return 'badge-error'
      default:
        return 'badge-neutral'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-64 mb-2" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="skeleton h-6 w-32 mb-4" />
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="skeleton h-6 w-48 mb-4" />
                <div className="skeleton h-64 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Contract Details</h1>
          <p className="text-base-content/70 mt-1">
            Contract relationship details and interactions
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Error loading contract data</span>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Contract Not Found</h1>
          <p className="text-base-content/70 mt-1">The requested contract could not be found.</p>
        </div>
        <div className="alert alert-warning">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span>Contract not found or you don't have permission to view it.</span>
        </div>
        <Link to="/contracts" className="btn btn-primary">
          Back to Contracts
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/contracts">Contracts</Link>
            </li>
            <li>
              {contract.consumerName} → {contract.providerName}
            </li>
          </ul>
        </div>
        <h1 className="text-3xl font-bold text-base-content">
          {contract.consumerName} → {contract.providerName}
        </h1>
        <p className="text-base-content/70 mt-1">
          Contract relationship details and recorded interactions
        </p>
      </div>

      {/* Contract Details - Horizontal Layout */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-start mb-6">
            <h2 className="card-title">Contract Details</h2>
            <Link to="/contracts" className="btn btn-ghost btn-sm">
              Back to Contracts
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div>
              <label className="label">
                <span className="label-text font-medium">Consumer</span>
              </label>
              <Link
                to={`/services/consumer/${contract.consumerName}`}
                className="link link-primary font-medium"
              >
                {contract.consumerName}
              </Link>
              {contract.consumerGitSha && (
                <div className="text-sm text-base-content/70 mt-1">
                  <GitShaLink sha={contract.consumerGitSha} />
                </div>
              )}
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Consumer Version</span>
              </label>
              <VersionBadge
                version={contract.consumerVersion}
                serviceName={contract.consumerName}
                serviceType="consumer"
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Provider</span>
              </label>
              <Link
                to={`/services/provider/${contract.providerName}`}
                className="link link-primary font-medium"
              >
                {contract.providerName}
              </Link>
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Provider Version</span>
              </label>
              <VersionBadge
                version={contract.providerVersion}
                serviceName={contract.providerName}
                serviceType="provider"
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Status</span>
              </label>
              <span className={`badge ${getStatusBadgeClass(contract.status)}`}>
                {contract.status}
              </span>
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Last Activity</span>
              </label>
              <TimestampDisplay timestamp={contract.lastSeen} />
            </div>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            Verification Status
            <span className="text-base font-normal text-base-content/70">
              (
              {(verificationData?.pendingTasks?.length || 0) +
                (verificationData?.completedResults?.length || 0)}{' '}
              total)
            </span>
          </h2>

          {verificationData &&
          (verificationData.pendingTasks.length > 0 ||
            verificationData.completedResults.length > 0) ? (
            <div className="space-y-6">
              {/* Pending Verifications */}
              {verificationData.pendingTasks.length > 0 && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Provider Version</th>
                          <th>Consumer Version</th>
                          <th>Interactions</th>
                          <th>Status</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verificationData.pendingTasks.map(task => (
                          <tr key={task.id}>
                            <td>
                              <VersionBadge
                                version={task.providerVersion}
                                serviceName={contract.providerName}
                                serviceType="provider"
                              />
                            </td>
                            <td>
                              <VersionBadge
                                version={task.consumerVersion}
                                serviceName={contract.consumerName}
                                serviceType="consumer"
                              />
                            </td>
                            <td>
                              <span className="text-sm">
                                {Array.isArray(task.interactions) ? task.interactions.length : 0}{' '}
                                interactions
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-warning">Pending</span>
                            </td>
                            <td>
                              <TimestampDisplay timestamp={task.createdAt} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Completed Verifications */}
              {verificationData.completedResults.length > 0 && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Provider Version</th>
                          <th>Consumer Version</th>
                          <th>Results</th>
                          <th>Status</th>
                          <th>Completed</th>
                          <th>Git SHA</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verificationData.completedResults.map(result => (
                          <tr key={result.id}>
                            <td>
                              <VersionBadge
                                version={result.providerVersion}
                                serviceName={contract.providerName}
                                serviceType="provider"
                              />
                            </td>
                            <td>
                              <VersionBadge
                                version={result.consumerVersion || 'N/A'}
                                serviceName={contract.consumerName}
                                serviceType="consumer"
                              />
                            </td>
                            <td>
                              <span className="text-sm">
                                {result.passed}/{result.total}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  result.status === 'passed' ? 'badge-success' : 'badge-error'
                                }`}
                              >
                                {result.status}
                              </span>
                            </td>
                            <td>
                              <TimestampDisplay timestamp={result.submittedAt} />
                            </td>
                            <td>
                              {result.providerGitSha && <GitShaLink sha={result.providerGitSha} />}
                            </td>
                            <td>
                              <Link
                                to={`/verification/${result.id}`}
                                className="btn btn-ghost btn-xs"
                              >
                                View Details
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/70">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-base-content/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="font-medium">No verification data available</div>
              <div className="text-sm">
                Verification tasks will appear here once the provider starts verifying against this
                contract.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactions List - Full Width */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            Recorded Interactions
            <span className="text-base font-normal text-base-content/70">
              ({interactions?.length || 0} interactions)
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Method & Path</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!interactions || interactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/70 py-8">
                      No interactions recorded for this contract yet.
                    </td>
                  </tr>
                ) : (
                  interactions.slice(0, 50).map(interaction => (
                    <tr key={interaction.id}>
                      <td>
                        <span className="font-mono text-sm">{interaction.operation}</span>
                      </td>
                      <td>
                        <span className="font-mono text-sm text-base-content/70">
                          {interaction.request.method} {interaction.request.path}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            interaction.response?.status >= 200 &&
                            interaction.response?.status < 300
                              ? 'badge-success'
                              : interaction.response?.status >= 500
                                ? 'badge-error'
                                : interaction.response?.status >= 300
                                  ? 'badge-warning'
                                  : 'badge-neutral'
                          }`}
                        >
                          {interaction.response?.status || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-sm">{interaction.duration}ms</span>
                      </td>
                      <td>
                        <TimestampDisplay timestamp={interaction.timestamp} />
                      </td>
                      <td>
                        <Link
                          to={`/interactions/${interaction.id}`}
                          className="btn btn-sm btn-ghost"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {interactions && interactions.length > 50 && (
            <div className="alert alert-info mt-4">
              <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Showing the 50 most recent interactions. Total: {interactions.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContractDetail
