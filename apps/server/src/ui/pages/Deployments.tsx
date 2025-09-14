import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConsumerFilter from '../components/ConsumerFilter'
import GitShaLink from '../components/GitShaLink'
import ProviderFilter from '../components/ProviderFilter'
import TimestampDisplay from '../components/TimestampDisplay'
import { deploymentApi } from '../utils/api'

function Deployments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [providerFilter, setProviderFilter] = useState(
    searchParams.get('provider') || searchParams.get('service') || ''
  )
  const [consumerFilter, setConsumerFilter] = useState(searchParams.get('consumer') || '')

  // Update filters when URL params change
  useEffect(() => {
    const provider = searchParams.get('provider') || searchParams.get('service') // Support legacy 'service' param
    const consumer = searchParams.get('consumer')
    if (provider) setProviderFilter(provider)
    if (consumer) setConsumerFilter(consumer)
  }, [searchParams])

  const { data: environments, isLoading: environmentsLoading } = useQuery({
    queryKey: ['deployments-environments'],
    queryFn: deploymentApi.getEnvironments,
  })

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['deployments-summary'],
    queryFn: deploymentApi.getSummary,
  })

  const { data: activeDeployments, isLoading: activeLoading } = useQuery({
    queryKey: ['deployments-active', selectedEnvironment],
    queryFn: () =>
      selectedEnvironment === 'ALL'
        ? deploymentApi.getActiveForAllEnvs()
        : deploymentApi.getActive(selectedEnvironment + '&include_inactive=true'),
  })

  // Filter deployments by provider, consumer, and status
  const filteredDeployments =
    activeDeployments?.filter(deployment => {
      if (providerFilter && deployment.service !== providerFilter) return false
      if (consumerFilter && deployment.consumer !== consumerFilter) return false
      if (statusFilter === 'active' && !deployment.active) return false
      if (statusFilter === 'inactive' && deployment.active) return false
      return true
    }) || []

  // Use environment breakdown from summary or calculate from filtered deployments
  const deploymentsByEnv =
    summary?.environmentBreakdown?.reduce(
      (acc, env) => {
        acc[env.environment] = env.count
        return acc
      },
      {} as Record<string, number>
    ) ||
    filteredDeployments?.reduce(
      (acc, deployment) => {
        acc[deployment.environment] = (acc[deployment.environment] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ) ||
    {}

  // Calculate total deployments across all environments
  const totalDeployments = Object.values(deploymentsByEnv).reduce((sum, count) => sum + count, 0)

  // Handle filter changes
  const handleProviderFilterChange = (provider: string) => {
    setProviderFilter(provider)
    updateUrlParams({ provider: provider || undefined, consumer: consumerFilter || undefined })
  }

  const handleConsumerFilterChange = (consumer: string) => {
    setConsumerFilter(consumer)
    updateUrlParams({ provider: providerFilter || undefined, consumer: consumer || undefined })
  }

  const updateUrlParams = (params: { provider?: string; consumer?: string }) => {
    const newParams: Record<string, string> = {}
    if (params.provider) newParams.provider = params.provider
    if (params.consumer) newParams.consumer = params.consumer
    setSearchParams(Object.keys(newParams).length > 0 ? newParams : {})
  }

  const clearFilters = () => {
    setStatusFilter('active')
    setProviderFilter('')
    setConsumerFilter('')
    setSearchParams({})
  }

  if (isLoading || activeLoading || environmentsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Deployments</h1>
          <p className="text-base-content/70 mt-1">Track service deployments across environments</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="stats shadow">
              <div className="stat">
                <div className="skeleton h-4 w-20 mb-2"></div>
                <div className="skeleton h-8 w-12 mb-2"></div>
                <div className="skeleton h-3 w-24"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-48 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-12 w-full"></div>
              ))}
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
          <h1 className="text-3xl font-bold text-base-content">Deployments</h1>
          <p className="text-base-content/70 mt-1">Track service deployments across environments</p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>Error loading deployments data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">
          Deployments
          {statusFilter !== 'all' && (
            <span className="text-lg font-normal text-base-content/70">
              {' '}
              • Status: {statusFilter}
            </span>
          )}
          {providerFilter && (
            <span className="text-lg font-normal text-base-content/70">
              {' '}
              • Provider: {providerFilter}
            </span>
          )}
          {consumerFilter && (
            <span className="text-lg font-normal text-base-content/70">
              {' '}
              • Consumer: {consumerFilter}
            </span>
          )}
        </h1>
        <p className="text-base-content/70 mt-1">Track service deployments across environments</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter value={providerFilter} onChange={handleProviderFilterChange} />
        <ConsumerFilter value={consumerFilter} onChange={handleConsumerFilterChange} />
        <div className="form-control">
          <label className="label">
            <span className="label-text">Status</span>
          </label>
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {(statusFilter !== 'active' || providerFilter || consumerFilter) && (
          <div className="form-control">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div
        className={`grid gap-6 ${environments && environments.length > 0 ? `grid-cols-1 md:grid-cols-${Math.min(environments.length + 1, 4)}` : 'grid-cols-1 md:grid-cols-2'}`}
      >
        <div
          className={`stats shadow cursor-pointer hover:shadow-lg transition-shadow ${
            selectedEnvironment === 'ALL' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setSelectedEnvironment('ALL')}
        >
          <div className="stat">
            <div className="stat-title">All Environments</div>
            <div className="stat-value text-primary">{totalDeployments}</div>
            <div className="stat-desc">
              {selectedEnvironment === 'ALL' ? 'selected' : 'all services'}
            </div>
          </div>
        </div>
        {environments?.map(environment => {
          const getEnvironmentColor = (env: string) => {
            if (env.toLowerCase().includes('prod')) return 'success'
            if (env.toLowerCase().includes('stag')) return 'warning'
            if (env.toLowerCase().includes('dev')) return 'info'
            if (env.toLowerCase().includes('test')) return 'secondary'
            return 'accent'
          }

          const colorClass = getEnvironmentColor(environment)

          return (
            <div
              key={environment}
              className={`stats shadow cursor-pointer hover:shadow-lg transition-shadow ${
                selectedEnvironment === environment ? `ring-2 ring-${colorClass}` : ''
              }`}
              onClick={() => setSelectedEnvironment(environment)}
            >
              <div className="stat">
                <div className="stat-title">
                  {environment.charAt(0).toUpperCase() + environment.slice(1)}
                </div>
                <div className={`stat-value text-${colorClass}`}>
                  {deploymentsByEnv[environment] || 0}
                </div>
                <div className="stat-desc">
                  {selectedEnvironment === environment ? 'selected' : 'active services'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            {selectedEnvironment === 'ALL' ? (
              'All Deployments'
            ) : (
              <>
                Deployments in{' '}
                <span
                  className={`badge ${
                    selectedEnvironment.toLowerCase().includes('prod')
                      ? 'badge-success'
                      : selectedEnvironment.toLowerCase().includes('stag')
                        ? 'badge-warning'
                        : selectedEnvironment.toLowerCase().includes('dev')
                          ? 'badge-info'
                          : selectedEnvironment.toLowerCase().includes('test')
                            ? 'badge-secondary'
                            : 'badge-accent'
                  }`}
                >
                  {selectedEnvironment}
                </span>
              </>
            )}
          </h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Version</th>
                  <th>Git SHA</th>
                  <th>Environment</th>
                  <th>Deployed By</th>
                  <th>Deployed At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeployments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/70 py-8">
                      {providerFilter || consumerFilter
                        ? 'No deployments found with current filters'
                        : 'No deployments found'}
                    </td>
                  </tr>
                ) : (
                  filteredDeployments.map((deployment, index) => (
                    <tr key={deployment.id || index}>
                      <td>
                        <Link
                          to={`/services/${deployment.serviceType}/${deployment.service}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {deployment.service}
                        </Link>
                      </td>
                      <td>
                        <span className="badge badge-outline">v{deployment.version}</span>
                      </td>
                      <td>
                        <GitShaLink
                          sha={deployment.gitSha}
                          repositoryUrl={deployment.gitRepositoryUrl}
                        />
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            deployment.environment.toLowerCase().includes('prod')
                              ? 'badge-success'
                              : deployment.environment.toLowerCase().includes('stag')
                                ? 'badge-warning'
                                : deployment.environment.toLowerCase().includes('dev')
                                  ? 'badge-info'
                                  : deployment.environment.toLowerCase().includes('test')
                                    ? 'badge-secondary'
                                    : 'badge-accent'
                          }`}
                        >
                          {deployment.environment}
                        </span>
                      </td>
                      <td>{deployment.deployedBy}</td>
                      <td>
                        <TimestampDisplay timestamp={deployment.deployedAt} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              deployment.active ? 'bg-success' : 'bg-error'
                            }`}
                          ></div>
                          <span className="text-sm">
                            {deployment.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Deployments
