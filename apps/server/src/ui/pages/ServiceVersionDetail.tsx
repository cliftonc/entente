import type { Contract } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ContractsPanel from '../components/ContractsPanel'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VerificationPanel from '../components/VerificationPanel'
import VersionBadge from '../components/VersionBadge'
import { useServiceVersion, useServiceVersionByNameAndVersion } from '../hooks/useServices'
import {
  contractApi,
  deploymentApi,
  interactionApi,
  verificationApi,
} from '../utils/api'
import { getSpecViewerButtonText, getSpecViewerRoute } from '../utils/specRouting'

function ServiceVersionDetail() {
  const { id, serviceName, version } = useParams<{ id?: string; serviceName?: string; version?: string }>()

  // Use appropriate hook based on URL pattern
  const serviceVersionById = useServiceVersion(id || '', { enabled: !!id })
  const serviceVersionByNameAndVersion = useServiceVersionByNameAndVersion(
    serviceName || '',
    version || '',
    { enabled: !!(serviceName && version) }
  )

  // Determine which result to use
  const serviceVersionResult = id ? serviceVersionById : serviceVersionByNameAndVersion
  const {
    data: serviceVersion,
    isLoading: serviceVersionLoading,
    error: serviceVersionError,
  } = serviceVersionResult

  const { data: deployments, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['deployments', serviceVersion?.serviceName],
    queryFn: () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return deploymentApi.getHistory(serviceVersion.serviceName)
    },
    enabled: !!serviceVersion,
  })

  // For verification results, we need to check both provider and consumer results since services can be both
  const { data: providerVerificationResults, isLoading: providerVerificationLoading } = useQuery({
    queryKey: ['provider-verification', serviceVersion?.serviceName],
    queryFn: () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return verificationApi.getByProvider(serviceVersion.serviceName)
    },
    enabled: !!serviceVersion,
  })

  const { data: consumerVerificationResults, isLoading: consumerVerificationLoading } = useQuery({
    queryKey: ['consumer-verification', serviceVersion?.serviceName],
    queryFn: () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return verificationApi.getByConsumer(serviceVersion.serviceName)
    },
    enabled: !!serviceVersion,
  })

  // Fetch contracts where this service is a provider
  const { data: providerContractsData, isLoading: providerContractsLoading } = useQuery({
    queryKey: ['provider-contracts', serviceVersion?.serviceName],
    queryFn: async () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return contractApi.getByProvider(serviceVersion.serviceName)
    },
    enabled: !!serviceVersion,
  })

  // Fetch contracts where this service is a consumer
  const { data: consumerContractsData, isLoading: consumerContractsLoading } = useQuery({
    queryKey: ['consumer-contracts', serviceVersion?.serviceName],
    queryFn: async () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return contractApi.getAll({ consumer: serviceVersion.serviceName })
    },
    enabled: !!serviceVersion,
  })

  // Filter contracts to only show those with matching versions
  const providerContracts = providerContractsData?.results || []
  const consumerContracts = consumerContractsData?.results || []

  const versionProviderContracts = providerContracts.filter((contract: Contract) => {
    return contract.providerVersion === serviceVersion?.version
  })

  const versionConsumerContracts = consumerContracts.filter((contract: Contract) => {
    return contract.consumerVersion === serviceVersion?.version
  })

  // Combine all contracts for this version
  const allVersionContracts = [...versionProviderContracts, ...versionConsumerContracts]

  // Fetch interactions for this service version (both as provider and consumer)
  const { data: providerInteractions } = useQuery({
    queryKey: ['provider-interactions', serviceVersion?.serviceName],
    queryFn: () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return interactionApi.getAll({ provider: serviceVersion.serviceName })
    },
    enabled: !!serviceVersion,
  })

  const { data: consumerInteractions } = useQuery({
    queryKey: ['consumer-interactions', serviceVersion?.serviceName],
    queryFn: () => {
      if (!serviceVersion) throw new Error('Service version is required')
      return interactionApi.getAll({ consumer: serviceVersion.serviceName })
    },
    enabled: !!serviceVersion,
  })

  // Filter interactions to only show those with matching versions
  const versionProviderInteractions = Array.isArray(providerInteractions)
    ? providerInteractions.filter(interaction => {
        // For provider interactions, we might not have providerVersion, so we'll be more lenient
        return true
      })
    : []

  const versionConsumerInteractions = Array.isArray(consumerInteractions)
    ? consumerInteractions.filter(interaction => {
        return interaction.consumerVersion === serviceVersion?.version
      })
    : []

  // Combine all interactions for this version
  const allVersionInteractions = [...versionProviderInteractions, ...versionConsumerInteractions]

  // Calculate interaction count for contracts
  const getContractInteractionCount = (contract: Contract): number => {
    return contract.interactionCount
  }

  // Calculate total interactions count
  const totalInteractions = allVersionInteractions?.length || 0

  // Determine if this service has provider or consumer roles
  const hasProviderRole = versionProviderContracts.length > 0
  const hasConsumerRole = versionConsumerContracts.length > 0
  const combinedVerificationResults = [...(providerVerificationResults || []), ...(consumerVerificationResults || [])]
  const verificationLoading = providerVerificationLoading || consumerVerificationLoading
  const contractsLoading = providerContractsLoading || consumerContractsLoading

  if (serviceVersionLoading) {
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

  if (serviceVersionError || !serviceVersion) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Error loading service version details</span>
        </div>
      </div>
    )
  }

  // Filter deployments for this version
  const versionDeployments = Array.isArray(deployments)
    ? deployments.filter(d => d.version === serviceVersion.version)
    : []
  const activeDeployments = versionDeployments.filter(d => d.active === true)
  const blockedDeployments = versionDeployments.filter(d => d.status === 'failed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/services/${serviceVersion.serviceName}`}
          className="btn btn-ghost btn-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to {serviceVersion.serviceName}
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
            {serviceVersion.serviceName} v{serviceVersion.version}
            <div className="flex gap-2">
              {hasProviderRole && <div className="badge badge-secondary">provider</div>}
              {hasConsumerRole && <div className="badge badge-primary">consumer</div>}
              {!hasProviderRole && !hasConsumerRole && <div className="badge badge-neutral">service</div>}
            </div>
          </h1>
          <p className="text-base-content/70 mt-1">Service version details and related data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Version Overview */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Version Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Version</span>
                  </label>
                  <VersionBadge
                    version={serviceVersion.version}
                    serviceName={serviceVersion.serviceName}
                    serviceVersionId={serviceVersion.id}
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Created</span>
                  </label>
                  <TimestampDisplay timestamp={serviceVersion.createdAt} />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Spec Type</span>
                  </label>
                  <SpecBadge specType={serviceVersion.specType || 'openapi'} size="sm" />
                </div>
                {serviceVersion.gitSha && (
                  <div>
                    <label className="label">
                      <span className="label-text">Git SHA</span>
                    </label>
                    <code className="text-sm bg-base-200 px-2 py-1 rounded">
                      {serviceVersion.gitSha.substring(0, 8)}
                    </code>
                  </div>
                )}
                <div>
                  <label className="label">
                    <span className="label-text">Created By</span>
                  </label>
                  <span className="text-sm">{serviceVersion.createdBy}</span>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">OpenAPI Spec</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div
                      className={`badge ${serviceVersion.spec ? 'badge-success' : 'badge-warning'}`}
                    >
                      {serviceVersion.spec ? 'available' : 'not available'}
                    </div>
                    {serviceVersion.spec && (
                      <Link
                        to={getSpecViewerRoute(serviceVersion.specType, {
                          serviceName: serviceVersion.serviceName,
                          serviceId: serviceVersion.serviceId,
                          version: serviceVersion.version,
                          versionId: serviceVersion.id,
                        })}
                        className="btn btn-xs btn-primary"
                      >
                        {getSpecViewerButtonText(serviceVersion.specType)}
                      </Link>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Package Info</span>
                  </label>
                  <div
                    className={`badge ${serviceVersion.packageJson ? 'badge-success' : 'badge-warning'}`}
                  >
                    {serviceVersion.packageJson ? 'available' : 'not available'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Results */}
          <VerificationPanel
            title="Verification Results"
            verificationResults={combinedVerificationResults}
            isLoading={verificationLoading}
            serviceName={serviceVersion.serviceName}
            viewAllUrl={`/verification?service=${serviceVersion.serviceName}`}
          />

          {/* Contracts for this Version */}
          <ContractsPanel
            title={`Contracts (v${serviceVersion.version})`}
            contracts={allVersionContracts}
            isLoading={contractsLoading}
            serviceName={serviceVersion.serviceName}
            totalInteractions={totalInteractions}
            viewAllUrl={`/contracts?service=${serviceVersion.serviceName}`}
            getContractInteractionCount={getContractInteractionCount}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active Deployments for this Version */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h3 className="card-title text-lg">Deployments (v{serviceVersion.version})</h3>
                <Link
                  to={`/deployments?service=${serviceVersion.serviceName}`}
                  className="btn btn-ghost btn-xs"
                >
                  View All
                </Link>
              </div>
              {deploymentsLoading ? (
                <div className="skeleton h-20 w-full" />
              ) : versionDeployments.length > 0 ? (
                <div className="space-y-3">
                  {versionDeployments.slice(0, 3).map((deployment, idx) => (
                    <div
                      key={
                        deployment.id || `${deployment.environment}-${deployment.version}-${idx}`
                      }
                      className="bg-base-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{deployment.environment}</span>
                        <div className="flex items-center gap-2">
                          {deployment.specType && (
                            <span
                              className={`badge badge-outline badge-xs ${
                                deployment.specType === 'openapi'
                                  ? 'badge-primary'
                                  : deployment.specType === 'graphql'
                                    ? 'badge-secondary'
                                    : deployment.specType === 'asyncapi'
                                      ? 'badge-accent'
                                      : deployment.specType === 'grpc'
                                        ? 'badge-info'
                                        : deployment.specType === 'soap'
                                          ? 'badge-neutral'
                                          : 'badge-ghost'
                              }`}
                            >
                              {deployment.specType}
                            </span>
                          )}
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
                  {versionDeployments.length > 3 && (
                    <div className="text-center">
                      <Link
                        to={`/deployments?service=${serviceVersion.serviceName}&version=${serviceVersion.version}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View {versionDeployments.length - 3} more deployments
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
                  <div className="text-sm font-medium">No deployments</div>
                  <div className="text-xs">This version has not been deployed</div>
                </div>
              )}
            </div>
          </div>

          {/* Version Statistics */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Version Statistics</h3>
              <div className="stats stats-vertical">
                <div className="stat">
                  <div className="stat-title">Contracts</div>
                  <div className="stat-value text-lg">{allVersionContracts?.length || 0}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Interactions</div>
                  <div className="stat-value text-lg">{totalInteractions}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Active Deployments</div>
                  <div className="stat-value text-lg">{activeDeployments.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceVersionDetail
