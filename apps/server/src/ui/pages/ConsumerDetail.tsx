import type { Contract } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import VerificationPanel from '../components/VerificationPanel'
import ContractsPanel from '../components/ContractsPanel'
import {
  consumerApi,
  contractApi,
  deploymentApi,
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


  const { data: verificationResults, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return verificationApi.getByConsumer(name)
    },
    enabled: !!name,
  })

  const { data: pendingTasks, isLoading: pendingTasksLoading } = useQuery({
    queryKey: ['verification', 'pending', name],
    queryFn: () => verificationApi.getPendingTasks(),
    enabled: !!name,
  })

  // Fetch contracts for this consumer (contracts where this service is the consumer)
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return contractApi.getAll({ consumer: name })
    },
    enabled: !!name,
  })

  // Fetch all interactions for this consumer to get accurate counts
  const { data: consumerInteractions } = useQuery({
    queryKey: ['interactions', 'consumer', name],
    queryFn: () => {
      if (!name) throw new Error('Consumer name is required')
      return interactionApi.getAll({ consumer: name })
    },
    enabled: !!name,
  })


  // Interaction counts are now calculated dynamically by the API
  const getContractInteractionCount = (contract: Contract): number => {
    return contract.interactionCount
  }

  // Calculate total interactions count
  const totalInteractions = consumerInteractions?.length || 0

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
  const blockedDeployments = deployments?.filter(d => d.status === 'failed') || []
  const consumerPendingTasks = pendingTasks?.filter(task => task.consumer === name) || []

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

          {/* Pending Verification */}
          {!pendingTasksLoading && consumerPendingTasks.length > 0 && (
            <VerificationPanel
              title="Pending Verification"
              pendingTasks={consumerPendingTasks}
              isLoading={pendingTasksLoading}
              serviceName={name || ''}
              serviceType="consumer"
              viewAllUrl="/verification"
              isPending={true}
            />
          )}

          {/* Contract Test Results */}
          <VerificationPanel
            title="Recent Verification Results"
            verificationResults={verificationResults}
            isLoading={verificationLoading}
            serviceName={name || ''}
            serviceType="consumer"
            viewAllUrl={`/verification?consumer=${name}`}
          />

          {/* Provider Contracts */}
          <ContractsPanel
            title="Provider Contracts"
            contracts={contracts}
            isLoading={contractsLoading}
            serviceName={name || ''}
            serviceType="consumer"
            totalInteractions={totalInteractions}
            viewAllUrl={`/contracts?consumer=${name}`}
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
                  <div className="text-xs">Deploy this consumer to see deployment status</div>
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

        </div>
      </div>
    </div>
  )
}

export default ConsumerDetail
