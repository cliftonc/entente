import type { Contract } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import VerificationPanel from '../components/VerificationPanel'
import ContractsPanel from '../components/ContractsPanel'
import GitHubIntegrationPanel from '../components/GitHubIntegrationPanel'
import {
  contractApi,
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

  const { data: pendingTasks, isLoading: pendingTasksLoading } = useQuery({
    queryKey: ['verification', 'pending', name],
    queryFn: () => verificationApi.getPendingTasks(),
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

  // Fetch contracts for this provider (contracts where this service is the provider)
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', 'provider', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return contractApi.getByProvider(name)
    },
    enabled: !!name,
  })

  // Fetch all interactions for this provider to get accurate counts
  const { data: providerInteractions } = useQuery({
    queryKey: ['interactions', 'provider', name],
    queryFn: () => {
      if (!name) throw new Error('Provider name is required')
      return interactionApi.getAll({ provider: name })
    },
    enabled: !!name,
  })

  // Check if tenant has GitHub app installation
  const { data: githubInstallation } = useQuery({
    queryKey: ['github-installation'],
    queryFn: async () => {
      const response = await fetch('/api/settings/github')
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to fetch GitHub installation')
      }
      return response.json()
    },
  })

  // Interaction counts are now calculated dynamically by the API
  const getContractInteractionCount = (contract: Contract): number => {
    return contract.interactionCount
  }

  // Calculate total interactions count
  const totalInteractions = providerInteractions?.length || 0

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
  const blockedDeployments = deployments?.filter(d => d.status === 'failed') || []
  const providerPendingTasks = pendingTasks?.filter(task => task.provider === name) || []
  const pendingFixtures = fixtures?.filter(f => f.status === 'draft') || []

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

          {/* Pending Verification */}
          <VerificationPanel
            title="Pending Verification"
            pendingTasks={providerPendingTasks}
            isLoading={pendingTasksLoading}
            serviceName={name || ''}
            serviceType="provider"
            viewAllUrl="/verification"
            isPending={true}
          />

          {/* Verification Results */}
          <VerificationPanel
            title="Recent Verification Results"
            verificationResults={verificationResults}
            isLoading={verificationLoading}
            serviceName={name || ''}
            serviceType="provider"
            viewAllUrl={`/verification?provider=${name}`}
          />

          {/* Consumer Contracts Summary */}
          <ContractsPanel
            title="Consumer Contracts"
            contracts={contracts}
            isLoading={contractsLoading}
            serviceName={name || ''}
            serviceType="provider"
            totalInteractions={totalInteractions}
            viewAllUrl={`/contracts?provider=${name}`}
            getContractInteractionCount={getContractInteractionCount}
          />
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
                            className={`badge badge-sm px-2 ${
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

          {/* Blocked Deployments */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg text-error">Blocked Deployments</h3>
                <Link to={`/deployments?service=${name}&include-failures=true`} className="btn btn-ghost btn-xs">
                  View All
                </Link>
              </div>
              {deploymentsLoading ? (
                <div className="skeleton h-20 w-full" />
              ) : blockedDeployments.length > 0 ? (
                <div className="space-y-3">
                  {blockedDeployments.slice(0, 3).map((deployment, idx) => (
                    <div
                      key={
                        deployment.id || `blocked-${deployment.environment}-${deployment.version}-${idx}`
                      }
                      className="bg-error/10 border border-error/20 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{deployment.environment}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-error/20 px-2 py-1 rounded">
                            {deployment.version}
                          </span>
                          <div className="badge badge-sm badge-error px-2">
                            blocked
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-error mb-2">
                        {deployment.failureReason || 'Deployment blocked by compatibility check'}
                      </div>
                      <div className="flex justify-between items-center text-xs text-base-content/70">
                        <span>
                          Attempted <TimestampDisplay timestamp={deployment.deployedAt} />
                        </span>
                      </div>
                    </div>
                  ))}
                  {blockedDeployments.length > 3 && (
                    <div className="text-center">
                      <Link
                        to={`/deployments?service=${name}&include-failures=true`}
                        className="text-xs text-error hover:underline"
                      >
                        View {blockedDeployments.length - 3} more blocked deployments
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-base-content/70">
                  <svg
                    className="w-8 h-8 mx-auto mb-2 text-success/50"
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
                  <div className="text-sm font-medium">No blocked deployments</div>
                  <div className="text-xs">All deployment attempts have been successful</div>
                </div>
              )}
            </div>
          </div>

          {/* GitHub Integration */}
          <GitHubIntegrationPanel
            serviceName={name || ''}
            serviceType="provider"
            gitRepositoryUrl={provider.gitRepositoryUrl}
            hasGitHubApp={!!githubInstallation}
          />

          {/* Draft Fixtures */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg">Draft Fixtures</h3>
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
                          className={`badge badge-sm px-2 ml-2 ${
                            fixture.status === 'draft'
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
                        to={`/fixtures?service=${name}&status=draft`}
                        className="text-xs text-primary hover:underline"
                      >
                        View {pendingFixtures.length - 3} more draft fixtures
                      </Link>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-base-300">
                    <Link
                      to={`/fixtures?service=${name}&status=draft`}
                      className="btn btn-warning btn-xs w-full"
                    >
                      Review Draft Fixtures
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
                  <div className="text-sm font-medium">No draft fixtures</div>
                  <div className="text-xs">All fixtures have been approved</div>
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
