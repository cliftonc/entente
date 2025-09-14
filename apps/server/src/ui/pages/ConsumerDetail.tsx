import type { ClientInteraction, ServiceDependency } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import {
  consumerApi,
  dependenciesApi,
  deploymentApi,
  fixtureApi,
  interactionApi,
  verificationApi,
} from '../utils/api'

function ConsumerDetail() {
  const { name } = useParams<{ name: string }>()

  const {
    data: consumer,
    isLoading: consumerLoading,
    error: consumerError,
  } = useQuery({
    queryKey: ['consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return consumerApi.getOne(name)
    },
    enabled: !!name,
  })

  const { data: deployments, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['deployments', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return deploymentApi.getHistory(name)
    },
    enabled: !!name,
  })

  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['fixtures', 'all', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return fixtureApi.getAllByService(name)
    },
    enabled: !!name,
  })

  const { data: verificationResults, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return verificationApi.getByConsumer(name)
    },
    enabled: !!name,
  })

  // Fetch interactions for this consumer (interactions where this service is the consumer)
  const { data: interactions, isLoading: interactionsLoading } = useQuery({
    queryKey: ['interactions', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return interactionApi.getByConsumer(name, 'latest')
    },
    enabled: !!name,
  })

  // Fetch dependencies for this consumer (providers this consumer depends on)
  const { data: dependencies, isLoading: dependenciesLoading } = useQuery({
    queryKey: ['dependencies', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return dependenciesApi.getByConsumer(name)
    },
    enabled: !!name,
  })

  if (consumerLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="skeleton h-6 w-32 mb-4" />
                <div className="skeleton h-20 w-full" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="skeleton h-6 w-24 mb-4" />
                <div className="skeleton h-16 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (consumerError || !consumer) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Error loading consumer details</span>
        </div>
      </div>
    )
  }

  const _recentVerification = verificationResults?.[0]
  const activeDeployments = deployments?.filter(d => d.active === true) || []
  const pendingFixtures = fixtures?.filter(f => f.status === 'pending') || []
  const approvedFixtures = fixtures?.filter(f => f.status === 'approved') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/services" className="btn btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Services
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
            {consumer.name}
            <div className="badge badge-primary">consumer</div>
          </h1>
          <p className="text-base-content/70 mt-1">
            Consumer service interactions and dependency tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Overview */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Service Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Description</span>
                  </label>
                  <p className="text-base-content/80">
                    {consumer.description || 'No description available'}
                  </p>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Last Updated</span>
                  </label>
                  <TimestampDisplay timestamp={consumer.updatedAt} />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Version</span>
                  </label>
                  <span className="font-mono text-sm">{consumer.version || 'latest'}</span>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Status</span>
                  </label>
                  <div className="badge badge-success">active</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Test Results */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h2 className="card-title">Recent Test Results</h2>
                <Link to={`/verification?consumer=${name}`} className="btn btn-ghost btn-sm">
                  View All
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>

              {verificationLoading ? (
                <div className="skeleton h-16 w-full" />
              ) : verificationResults && verificationResults.length > 0 ? (
                <div className="space-y-3">
                  {verificationResults.slice(0, 3).map(verification => (
                    <div key={verification.id} className="bg-base-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`badge ${
                              verification.summary &&
                              verification.summary.passed === verification.summary.total
                                ? 'badge-success'
                                : verification.summary && verification.summary.failed > 0
                                  ? 'badge-error'
                                  : 'badge-warning'
                            }`}
                          >
                            {verification.summary &&
                            verification.summary.passed === verification.summary.total
                              ? 'passed'
                              : verification.summary && verification.summary.failed > 0
                                ? 'failed'
                                : 'pending'}
                          </div>
                          <span className="text-sm text-base-content/70">
                            <TimestampDisplay timestamp={verification.submittedAt} />
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {verification.summary?.passed || 0}/{verification.summary?.total || 0}{' '}
                          tests
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-base-content/80">
                          Provider: {verification.provider || 'Unknown'}
                        </span>
                        <span className="text-base-content/80">
                          Version: {verification.consumerVersion || 'latest'}
                        </span>
                      </div>
                      {verification.summary && typeof verification.summary === 'string' && (
                        <p className="text-sm text-base-content/70 mt-2">{verification.summary}</p>
                      )}
                    </div>
                  ))}
                  {verificationResults.length > 3 && (
                    <div className="text-center">
                      <Link
                        to={`/verification?consumer=${name}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View {verificationResults.length - 3} more results
                      </Link>
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
                  <div className="font-medium">No test results</div>
                  <div className="text-sm">Run contract tests to see test results</div>
                </div>
              )}
            </div>
          </div>

          {/* Provider Interactions Summary */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h2 className="card-title">Provider Interactions</h2>
                <Link to={`/interactions?consumer=${name}`} className="btn btn-ghost btn-sm">
                  View All
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>

              {interactionsLoading ? (
                <div className="space-y-3">
                  <div className="skeleton h-16 w-full" />
                  <div className="skeleton h-16 w-full" />
                </div>
              ) : interactions && interactions.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{interactions.length}</div>
                      <div className="text-sm text-base-content/70">Total Calls</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-secondary">
                        {new Set(interactions.map(i => i.provider)).size}
                      </div>
                      <div className="text-sm text-base-content/70">Providers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {new Set(interactions.map(i => i.operation)).size}
                      </div>
                      <div className="text-sm text-base-content/70">Operations</div>
                    </div>
                  </div>

                  {/* Recent interactions by provider */}
                  <div className="divider">Recent Interactions by Provider</div>
                  <div className="space-y-3">
                    {Object.entries(
                      interactions.slice(0, 10).reduce(
                        (acc, interaction) => {
                          const provider = interaction.provider || 'Unknown'
                          if (!acc[provider]) acc[provider] = []
                          acc[provider].push(interaction)
                          return acc
                        },
                        {} as Record<string, ClientInteraction[]>
                      )
                    )
                      .slice(0, 3)
                      .map(([provider, providerInteractions]) => (
                        <div key={provider} className="bg-base-200 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium text-sm">{provider}</div>
                            <div className="flex items-center gap-2">
                              <div className="badge badge-primary badge-xs">
                                {providerInteractions.length} calls
                              </div>
                              <TimestampDisplay
                                timestamp={providerInteractions[0]?.timestamp}
                                className="text-xs text-base-content/70"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            {providerInteractions.slice(0, 2).map((interaction, idx) => (
                              <div
                                key={interaction.id || `${interaction.operation}-${idx}`}
                                className="flex justify-between items-center text-xs"
                              >
                                <span className="font-mono">
                                  <span
                                    className={`${
                                      interaction.request?.method === 'GET'
                                        ? 'text-success'
                                        : interaction.request?.method === 'POST'
                                          ? 'text-primary'
                                          : interaction.request?.method === 'PUT'
                                            ? 'text-warning'
                                            : interaction.request?.method === 'DELETE'
                                              ? 'text-error'
                                              : 'text-base-content'
                                    }`}
                                  >
                                    {interaction.request?.method || 'GET'}
                                  </span>{' '}
                                  <span className="text-base-content/70">
                                    {interaction.operation}
                                  </span>
                                </span>
                                <span
                                  className={`badge badge-xs ${
                                    interaction.response?.statusCode >= 200 &&
                                    interaction.response?.statusCode < 300
                                      ? 'badge-success'
                                      : interaction.response?.statusCode >= 400
                                        ? 'badge-error'
                                        : 'badge-warning'
                                  }`}
                                >
                                  {interaction.response?.statusCode || '200'}
                                </span>
                              </div>
                            ))}
                            {providerInteractions.length > 2 && (
                              <div className="text-xs text-base-content/60 text-center">
                                +{providerInteractions.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <div className="font-medium">No provider interactions</div>
                  <div className="text-sm">This consumer hasn't called any providers yet</div>
                </div>
              )}
            </div>
          </div>

          {/* Provider Dependencies */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Provider Dependencies</h2>
              {dependenciesLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              ) : dependencies && dependencies.length > 0 ? (
                <div className="space-y-3">
                  {dependencies.map((dep: ServiceDependency) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/services/provider/${dep.provider.name}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {dep.provider.name}
                          </Link>
                          <span className="text-sm text-base-content/60">
                            v{dep.providerVersion}
                          </span>
                          <span className="badge badge-xs badge-secondary">{dep.environment}</span>
                        </div>
                        <div className="text-sm text-base-content/70 mt-1">
                          Consumer v{dep.consumerVersion} → Provider v{dep.providerVersion}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`badge ${
                            dep.status === 'verified'
                              ? 'badge-success'
                              : dep.status === 'failed'
                                ? 'badge-error'
                                : 'badge-warning'
                          } badge-sm`}
                        >
                          {dep.status}
                        </div>
                        {dep.verifiedAt && (
                          <div className="text-xs text-base-content/50">
                            <TimestampDisplay timestamp={dep.verifiedAt} relative />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <div className="font-medium">No provider dependencies</div>
                  <div className="text-sm">
                    This consumer doesn't have any registered provider dependencies
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active Deployments */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg">Active Deployments</h3>
                <Link to={`/deployments?service=${name}`} className="btn btn-ghost btn-xs">
                  View All
                </Link>
              </div>
              {deploymentsLoading ? (
                <div className="skeleton h-20 w-full" />
              ) : activeDeployments.length > 0 ? (
                <div className="space-y-3">
                  {activeDeployments.slice(0, 3).map((deployment, idx) => (
                    <div
                      key={
                        deployment.id || `${deployment.environment}-${deployment.version}-${idx}`
                      }
                      className="bg-base-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{deployment.environment}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded">
                            {deployment.version}
                          </span>
                          <div
                            className={`badge badge-xs ${
                              deployment.active ? 'badge-success' : 'badge-error'
                            }`}
                          >
                            {deployment.active ? 'active' : 'inactive'}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-base-content/70">
                        <span>
                          Deployed <TimestampDisplay timestamp={deployment.deployedAt} />
                        </span>
                        {deployment.deployedBy && <span>by {deployment.deployedBy}</span>}
                      </div>
                    </div>
                  ))}
                  {activeDeployments.length > 3 && (
                    <div className="text-center">
                      <Link
                        to={`/deployments?service=${name}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View {activeDeployments.length - 3} more deployments
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-base-content/70">
                  <svg
                    className="w-8 h-8 mx-auto mb-2 text-base-content/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                  <div className="text-sm font-medium">No active deployments</div>
                  <div className="text-xs">Deploy this consumer to see deployment status</div>
                </div>
              )}
            </div>
          </div>

          {/* Test Fixtures */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg">Test Fixtures</h3>
                <Link to={`/fixtures?service=${name}`} className="btn btn-ghost btn-xs">
                  View All
                </Link>
              </div>
              {fixturesLoading ? (
                <div className="skeleton h-16 w-full" />
              ) : pendingFixtures.length > 0 ? (
                <div className="space-y-3">
                  {pendingFixtures.slice(0, 3).map(fixture => (
                    <div key={fixture.id} className="bg-base-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{fixture.operation}</div>
                          <div className="text-xs text-base-content/70">
                            {fixture.service} • v{fixture.serviceVersion || 'latest'}
                          </div>
                        </div>
                        <div
                          className={`badge badge-xs ml-2 ${
                            fixture.status === 'pending'
                              ? 'badge-warning'
                              : fixture.status === 'approved'
                                ? 'badge-success'
                                : 'badge-info'
                          }`}
                        >
                          {fixture.status}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-base-content/70">
                        <span>
                          Created <TimestampDisplay timestamp={fixture.createdAt} />
                        </span>
                        {fixture.createdFrom?.provider && (
                          <span>for {fixture.createdFrom.provider}</span>
                        )}
                      </div>
                      {fixture.notes && (
                        <div className="text-xs text-base-content/60 mt-1 truncate">
                          {fixture.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  {pendingFixtures.length > 3 && (
                    <div className="text-center">
                      <Link
                        to={`/fixtures?service=${name}&status=pending`}
                        className="text-xs text-primary hover:underline"
                      >
                        View {pendingFixtures.length - 3} more pending fixtures
                      </Link>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-base-300">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span>Summary</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Approved</span>
                      <div className="badge badge-success badge-sm">{approvedFixtures.length}</div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Pending Review</span>
                      <div className="badge badge-warning badge-sm">{pendingFixtures.length}</div>
                    </div>
                    {pendingFixtures.length > 0 && (
                      <div className="mt-2">
                        <Link
                          to={`/fixtures?service=${name}&status=pending`}
                          className="btn btn-warning btn-xs w-full"
                        >
                          Review Pending Fixtures
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-base-content/70">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span>Approved</span>
                      <div className="badge badge-success badge-sm">{approvedFixtures.length}</div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Pending Review</span>
                      <div className="badge badge-warning badge-sm">{pendingFixtures.length}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <svg
                      className="w-8 h-8 mx-auto mb-2 text-base-content/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="text-sm font-medium">No pending fixtures</div>
                    <div className="text-xs">All fixtures have been reviewed</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsumerDetail
