import type { Contract } from '@entente/types'
import { Link, useParams } from 'react-router-dom'
import ContractsPanel from '../components/ContractsPanel'
import GitHubIntegrationPanel from '../components/GitHubIntegrationPanel'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VerificationPanel from '../components/VerificationPanel'
import VersionBadge from '../components/VersionBadge'
import { useContractsByProvider, useContractsByConsumer } from '../hooks/useContracts'
import { useDeploymentHistory } from '../hooks/useDeployments'
import { useFixtures } from '../hooks/useFixtures'
import { useGitHubInstallation } from '../hooks/useGitHubIntegration'
import { useInteractions } from '../hooks/useInteractions'
import { useService } from '../hooks/useServices'
import { useServiceVersions } from '../hooks/useServices'
import { usePendingVerificationTasks, useVerificationsByProvider, useVerificationsByConsumer } from '../hooks/useVerifications'
import { getSpecViewerButtonText, getSpecViewerRoute } from '../utils/specRouting'

function ServiceDetail() {
  const { name } = useParams<{ name: string }>()

  // Fetch service (without type parameter since we removed it)
  const {
    data: service,
    isLoading: serviceLoading,
    error: serviceError,
  } = useService(name || '', { enabled: !!name })

  // Fetch contracts where this service is the provider
  const { data: providerContracts, isLoading: providerContractsLoading } = useContractsByProvider(name || '', {
    enabled: !!name,
  })

  // Fetch contracts where this service is the consumer
  const { data: consumerContracts, isLoading: consumerContractsLoading } = useContractsByConsumer(name || '', {
    enabled: !!name,
  })

  // Fetch verification results for both roles
  const { data: providerVerificationResults, isLoading: providerVerificationLoading } = useVerificationsByProvider(
    name || '',
    { enabled: !!name }
  )

  const { data: consumerVerificationResults, isLoading: consumerVerificationLoading } = useVerificationsByConsumer(
    name || '',
    { enabled: !!name }
  )

  const { data: pendingTasks, isLoading: pendingTasksLoading } = usePendingVerificationTasks({
    enabled: !!name,
  })

  const { data: deployments, isLoading: deploymentsLoading } = useDeploymentHistory(
    name || '',
    undefined,
    { enabled: !!name }
  )

  const { data: fixtures, isLoading: fixturesLoading } = useFixtures(
    {
      service: name,
    },
    { enabled: !!name }
  )

  // Fetch interactions for both roles
  const { data: providerInteractions } = useInteractions(
    {
      provider: name,
    },
    { enabled: !!name }
  )

  const { data: consumerInteractions } = useInteractions(
    {
      consumer: name,
    },
    { enabled: !!name }
  )

  // Check if tenant has GitHub app installation
  const { data: githubInstallation } = useGitHubInstallation()

  // Fetch service versions
  const { data: serviceVersions, isLoading: serviceVersionsLoading } = useServiceVersions(
    name || '',
    { enabled: !!name }
  )

  // Determine service roles
  const isProvider = (providerContracts?.length || 0) > 0
  const isConsumer = (consumerContracts?.length || 0) > 0
  const isDualRole = isProvider && isConsumer

  // Interaction counts
  const getContractInteractionCount = (contract: Contract): number => {
    return contract.interactionCount
  }

  const totalProviderInteractions = providerInteractions?.length || 0
  const totalConsumerInteractions = consumerInteractions?.length || 0

  if (serviceLoading) {
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

  if (serviceError || !service) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Error loading service details</span>
        </div>
      </div>
    )
  }

  const activeDeployments = deployments?.filter(d => d.active === true) || []
  const blockedDeployments = deployments?.filter(d => d.status === 'failed') || []
  const pendingFixtures = fixtures?.filter(f => f.status === 'draft') || []

  // Get pending tasks for this service (as both provider and consumer)
  const servicePendingTasks = pendingTasks?.filter(task =>
    task.provider === name || task.consumer === name
  ) || []

  // Get role badges
  const getRoleBadges = () => {
    const badges = []
    if (isProvider) {
      badges.push(<div key="provider" className="badge badge-secondary">provider</div>)
    }
    if (isConsumer) {
      badges.push(<div key="consumer" className="badge badge-primary">consumer</div>)
    }
    if (!isProvider && !isConsumer) {
      badges.push(<div key="service" className="badge badge-neutral">service</div>)
    }
    return badges
  }

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
            {service.name}
            <div className="flex gap-2">
              {getRoleBadges()}
            </div>
          </h1>
          <p className="text-base-content/70 mt-1">
            {isDualRole ? 'Service acting as both provider and consumer' :
             isProvider ? 'Provider service contract details and verification status' :
             isConsumer ? 'Consumer service interactions and dependency tracking' :
             'Service overview and configuration'}
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
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="label">
                    <span className="label-text">Description</span>
                  </label>
                  <div className="bg-base-200/50 p-4 rounded-lg">
                    <p className="text-base-content/80">
                      {service.description || 'No description available'}
                    </p>
                  </div>
                </div>

                {/* Status, Last Updated, Spec Type, API Spec row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <div className="badge badge-success">active</div>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Last Updated</span>
                    </label>
                    <TimestampDisplay timestamp={service.updatedAt} />
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Spec Type</span>
                    </label>
                    <SpecBadge specType={service.specType || 'openapi'} size="sm" />
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">API Spec</span>
                    </label>
                    <Link
                      to={getSpecViewerRoute(service.specType, {
                        serviceName: service.name,
                        serviceId: service.id,
                        version: 'latest',
                      })}
                      className="btn btn-sm btn-primary"
                    >
                      {getSpecViewerButtonText(service.specType)}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Verification */}
          {!pendingTasksLoading && servicePendingTasks.length > 0 && (
            <VerificationPanel
              title="Pending Verification"
              pendingTasks={servicePendingTasks}
              isLoading={pendingTasksLoading}
              serviceName={name || ''}
              viewAllUrl="/verification"
              isPending={true}
            />
          )}

          {/* Provider Section - Show if service acts as provider */}
          {isProvider && (
            <>
              {/* Provider Verification Results */}
              <VerificationPanel
                title="Provider Verification Results"
                verificationResults={providerVerificationResults}
                isLoading={providerVerificationLoading}
                serviceName={name || ''}
                viewAllUrl={`/verification?provider=${name}`}
              />

              {/* Consumer Contracts (when this service is the provider) */}
              <ContractsPanel
                title="Consumer Contracts"
                contracts={providerContracts}
                isLoading={providerContractsLoading}
                serviceName={name || ''}
                totalInteractions={totalProviderInteractions}
                viewAllUrl={`/contracts?provider=${name}`}
                getContractInteractionCount={getContractInteractionCount}
              />
            </>
          )}

          {/* Consumer Section - Show if service acts as consumer */}
          {isConsumer && (
            <>
              {/* Consumer Verification Results */}
              <VerificationPanel
                title="Consumer Verification Results"
                verificationResults={consumerVerificationResults}
                isLoading={consumerVerificationLoading}
                serviceName={name || ''}
                viewAllUrl={`/verification?consumer=${name}`}
              />

              {/* Provider Contracts (when this service is the consumer) */}
              <ContractsPanel
                title="Provider Dependencies"
                contracts={consumerContracts}
                isLoading={consumerContractsLoading}
                serviceName={name || ''}
                totalInteractions={totalConsumerInteractions}
                viewAllUrl={`/contracts?consumer=${name}`}
                getContractInteractionCount={getContractInteractionCount}
              />
            </>
          )}

          {/* GitHub Integration */}
          <GitHubIntegrationPanel
            serviceName={name || ''}
            gitRepositoryUrl={service.gitRepositoryUrl}
            hasGitHubApp={!!githubInstallation}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Service Versions */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-base">Service Versions</h3>
              {serviceVersionsLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              ) : serviceVersions && serviceVersions.length > 0 ? (
                <div className="space-y-2">
                  {serviceVersions.slice(0, 5).map(version => (
                    <Link
                      key={version.id}
                      to={`/services/${name}/versions/${version.version}`}
                      className="block hover:bg-base-200 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <VersionBadge version={version.version} size="sm" />
                        <TimestampDisplay timestamp={version.createdAt} relative />
                      </div>
                    </Link>
                  ))}
                  {serviceVersions.length > 5 && (
                    <Link to={`/services/${name}/versions`} className="btn btn-sm btn-ghost w-full">
                      View All Versions ({serviceVersions.length})
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-base-content/60 text-sm">No versions found</p>
              )}
            </div>
          </div>

          {/* Active Deployments */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-base">Active Deployments</h3>
              {deploymentsLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                </div>
              ) : activeDeployments.length > 0 ? (
                <div className="space-y-2">
                  {activeDeployments.map(deployment => (
                    <div key={deployment.id} className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{deployment.environment}</span>
                        <VersionBadge version={deployment.version} size="xs" />
                      </div>
                      <TimestampDisplay timestamp={deployment.deployedAt} className="text-xs" />
                    </div>
                  ))}
                  <Link to="/deployments" className="btn btn-sm btn-ghost w-full">
                    View All Deployments
                  </Link>
                </div>
              ) : (
                <p className="text-base-content/60 text-sm">No active deployments</p>
              )}
            </div>
          </div>

          {/* Fixtures Status */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-base">Fixtures</h3>
              {fixturesLoading ? (
                <div className="skeleton h-8 w-full" />
              ) : (
                <div className="stats stats-vertical shadow">
                  <div className="stat">
                    <div className="stat-title">Total</div>
                    <div className="stat-value text-lg">{fixtures?.length || 0}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Pending Approval</div>
                    <div className="stat-value text-lg text-warning">{pendingFixtures.length}</div>
                  </div>
                </div>
              )}
              <Link to={`/fixtures?service=${name}`} className="btn btn-sm btn-ghost w-full">
                Manage Fixtures
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-base">Quick Actions</h3>
              <div className="space-y-2">
                <Link to={`/interactions?${isProvider ? 'provider' : 'consumer'}=${name}`} className="btn btn-sm btn-outline w-full">
                  View Interactions
                </Link>
                {blockedDeployments.length > 0 && (
                  <Link to={`/deployments?service=${name}&status=failed`} className="btn btn-sm btn-error btn-outline w-full">
                    Fix Blocked Deployments ({blockedDeployments.length})
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceDetail