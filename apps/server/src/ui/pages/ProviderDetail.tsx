import type { ClientInteraction } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import {
  deploymentApi,
  fixtureApi,
  interactionApi,
  providerApi,
  verificationApi,
} from '../utils/api'

function ProviderDetail() {
  const { name } = useParams<{ name: string }>()

  const {
    data: provider,
    isLoading: providerLoading,
    error: providerError,
  } = useQuery({
    queryKey: ['provider', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return providerApi.getOne(name)
    },
    enabled: !!name,
  })

  const { data: verificationResults, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', 'history', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return verificationApi.getByProvider(name)
    },
    enabled: !!name,
  })

  const { data: deployments, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['deployments', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return deploymentApi.getHistory(name)
    },
    enabled: !!name,
  })

  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['fixtures', 'all', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return fixtureApi.getAllByService(name)
    },
    enabled: !!name,
  })

  // Fetch interactions for this provider (interactions where this service is the provider)
  const { data: interactions, isLoading: interactionsLoading } = useQuery({
    queryKey: ['interactions', 'provider', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return interactionApi.getByService(name, 'latest')
    },
    enabled: !!name,
  })

  if (providerLoading) {
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

  if (providerError || !provider) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Error loading provider details</span>
        </div>
      </div>
    )
  }

  const _recentVerification = verificationResults?.[0]
  const activeDeployments = deployments?.filter(d => d.active === true) || []
  const pendingFixtures = fixtures?.filter(f => f.status === 'pending') || []

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
            {provider.name}
            <div className="badge badge-secondary">provider</div>
          </h1>
          <p className="text-base-content/70 mt-1">
            Provider service contract details and verification status
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
                    {provider.description || 'No description available'}
                  </p>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Last Updated</span>
                  </label>
                  <TimestampDisplay timestamp={provider.updatedAt} />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Version</span>
                  </label>
                  <span className="font-mono text-sm">{provider.version || 'latest'}</span>
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

          {/* Verification Results */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h2 className="card-title">Recent Verification</h2>
                <Link to={`/verification?provider=${name}`} className="btn btn-ghost btn-sm">
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
                          Version: {verification.providerVersion || 'latest'}
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
                        to={`/verification?provider=${name}`}
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
                  <div className="font-medium">No verification results</div>
                  <div className="text-sm">Run verification to see test results</div>
                </div>
              )}
            </div>
          </div>

          {/* Consumer Interactions Summary */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h2 className="card-title">Consumer Interactions</h2>
                <Link to={`/interactions?service=${name}`} className="btn btn-ghost btn-sm">
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
                        {new Set(interactions.map(i => i.consumer)).size}
                      </div>
                      <div className="text-sm text-base-content/70">Consumers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {new Set(interactions.map(i => i.operation)).size}
                      </div>
                      <div className="text-sm text-base-content/70">Operations</div>
                    </div>
                  </div>

                  {/* Recent interactions by consumer */}
                  <div className="divider">Recent Interactions by Consumer</div>
                  <div className="space-y-3">
                    {Object.entries(
                      interactions.slice(0, 10).reduce(
                        (acc, interaction) => {
                          const consumer = interaction.consumer || 'Unknown'
                          if (!acc[consumer]) acc[consumer] = []
                          acc[consumer].push(interaction)
                          return acc
                        },
                        {} as Record<string, ClientInteraction[]>
                      )
                    )
                      .slice(0, 3)
                      .map(([consumer, consumerInteractions]) => (
                        <div key={consumer} className="bg-base-200 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium text-sm">{consumer}</div>
                            <div className="flex items-center gap-2">
                              <div className="badge badge-primary badge-xs">
                                {consumerInteractions.length} calls
                              </div>
                              <TimestampDisplay
                                timestamp={consumerInteractions[0]?.timestamp}
                                className="text-xs text-base-content/70"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            {consumerInteractions.slice(0, 2).map((interaction, idx) => (
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
                            {consumerInteractions.length > 2 && (
                              <div className="text-xs text-base-content/60 text-center">
                                +{consumerInteractions.length - 2} more
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
                  <div className="font-medium">No consumer interactions</div>
                  <div className="text-sm">No consumers have called this provider yet</div>
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
                  <div className="text-xs">Deploy this provider to see deployment status</div>
                </div>
              )}
            </div>
          </div>

          {/* Pending Fixtures */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg">Pending Fixtures</h3>
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
                        {fixture.createdFrom?.consumer && (
                          <span>from {fixture.createdFrom.consumer}</span>
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
                    <Link
                      to={`/fixtures?service=${name}&status=pending`}
                      className="btn btn-warning btn-xs w-full"
                    >
                      Review Pending Fixtures
                    </Link>
                  </div>
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div className="text-sm font-medium">No pending fixtures</div>
                  <div className="text-xs">All fixtures have been reviewed</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProviderDetail
