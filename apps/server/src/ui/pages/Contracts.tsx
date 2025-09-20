import type { Contract } from '@entente/types'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import ConsumerFilter from '../components/ConsumerFilter'
import GetStartedButton from '../components/GetStartedButton'
import ProviderFilter from '../components/ProviderFilter'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VersionBadge from '../components/VersionBadge'
import ContractsExample from '../components/get-started-examples/ContractsExample'
import { useContracts } from '../hooks/useContracts'

function Contracts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedProvider, setSelectedProvider] = useState<string>(
    searchParams.get('provider') || ''
  )
  const [selectedConsumer, setSelectedConsumer] = useState<string>(
    searchParams.get('consumer') || ''
  )
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || '')
  const [displayedContracts, setDisplayedContracts] = useState<Contract[]>([])
  const [currentOffset, setCurrentOffset] = useState(0)
  const pageSize = 10

  // Update filters when URL params change
  useEffect(() => {
    const provider = searchParams.get('provider')
    const consumer = searchParams.get('consumer')
    const status = searchParams.get('status')
    if (provider) setSelectedProvider(provider)
    if (consumer) setSelectedConsumer(consumer)
    if (status) setSelectedStatus(status)
  }, [searchParams])

  const {
    data: contracts,
    isLoading: contractsLoading,
    error: contractsError,
    hasNextPage,
    totalCount,
    statistics,
    isFetching,
  } = useContracts({
    provider: selectedProvider || undefined,
    consumer: selectedConsumer || undefined,
    status: selectedStatus as 'active' | 'archived' | 'deprecated' | undefined,
    limit: pageSize,
    offset: currentOffset,
  })

  // Reset pagination when filters change (MUST run before data update)
  useEffect(() => {
    setCurrentOffset(0)
    setDisplayedContracts([])
  }, [selectedProvider, selectedConsumer, selectedStatus])

  // Update displayed contracts when new data is loaded
  useEffect(() => {
    if (contracts !== undefined) {
      if (contracts.length === 0 && currentOffset === 0) {
        // Empty result set - clear displayed results
        setDisplayedContracts([])
        return
      }

      if (contracts.length > 0) {
        if (currentOffset === 0) {
          // First page - replace all results
          setDisplayedContracts(contracts)
        } else {
          // Additional pages - append to existing results, avoiding duplicates
          setDisplayedContracts(prev => {
            const existingIds = new Set(prev.map(item => item.id))
            const newItems = contracts.filter(item => !existingIds.has(item.id))
            return [...prev, ...newItems]
          })
        }
      }
    }
  }, [contracts])

  // Handle filter changes
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    updateUrlParams({
      provider: provider || undefined,
      consumer: selectedConsumer || undefined,
      status: selectedStatus || undefined,
    })
  }

  const handleConsumerChange = (consumer: string) => {
    setSelectedConsumer(consumer)
    updateUrlParams({
      provider: selectedProvider || undefined,
      consumer: consumer || undefined,
      status: selectedStatus || undefined,
    })
  }

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status)
    updateUrlParams({
      provider: selectedProvider || undefined,
      consumer: selectedConsumer || undefined,
      status: status || undefined,
    })
  }

  const updateUrlParams = (params: {
    provider?: string
    consumer?: string
    status?: string
  }) => {
    const newParams: Record<string, string> = {}
    if (params.provider) newParams.provider = params.provider
    if (params.consumer) newParams.consumer = params.consumer
    if (params.status) newParams.status = params.status
    setSearchParams(Object.keys(newParams).length > 0 ? newParams : {})
  }

  const clearFilters = () => {
    setSelectedProvider('')
    setSelectedConsumer('')
    setSelectedStatus('')
    setSearchParams({})
  }

  const handleShowMore = () => {
    // Loading more contracts...
    setCurrentOffset(prev => prev + pageSize)
  }

  // Only show full loading state for initial load
  const isLoading = contractsLoading && currentOffset === 0
  const error = contractsError

  // Use displayedContracts for rendering
  const contractsToDisplay = displayedContracts.length > 0 ? displayedContracts : contracts || []

  // Create filter summary for display
  const getFilterSummary = () => {
    const parts = []
    if (selectedProvider) parts.push(`Provider: ${selectedProvider}`)
    if (selectedConsumer) parts.push(`Consumer: ${selectedConsumer}`)
    if (selectedStatus) parts.push(`Status: ${selectedStatus}`)
    return parts.length > 0 ? ` • ${parts.join(' • ')}` : ''
  }

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
          <h1 className="text-3xl font-bold text-base-content">Contracts</h1>
          <p className="text-base-content/70 mt-1">
            View contract relationships between consumers and providers
          </p>
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Consumer</th>
                    <th>Version</th>
                    <th>Provider</th>
                    <th>Provider Version</th>
                    <th>Interactions</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      <td>
                        <div className="skeleton h-4 w-24" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-16" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-24" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-16" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-12" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-16" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-20" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-12" />
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

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Contracts</h1>
          <p className="text-base-content/70 mt-1">
            View contract relationships between consumers and providers
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
          <span>Error loading contracts data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-base-content">
            Contracts
            <span className="text-lg font-normal text-base-content/70">{getFilterSummary()}</span>
          </h1>
          <p className="text-base-content/70 mt-1">
            View contract relationships between consumers and providers
          </p>
        </div>
        <div className="flex-shrink-0">
          <GetStartedButton>
            <ContractsExample />
          </GetStartedButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter value={selectedProvider} onChange={handleProviderChange} />
        <ConsumerFilter value={selectedConsumer} onChange={handleConsumerChange} />

        <div className="form-control">
          <label className="label">
            <span className="label-text">Status</span>
          </label>
          <select
            className="select select-bordered w-full max-w-xs"
            value={selectedStatus}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

        {(selectedProvider || selectedConsumer || selectedStatus) && (
          <div className="form-control">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            Contract Relationships
            <span className="text-base font-normal text-base-content/70">
              ({contractsToDisplay.length || 0} results)
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Consumer</th>
                  <th>Version</th>
                  <th>Provider</th>
                  <th>Provider Version</th>
                  <th>Spec Type</th>
                  <th>Interactions</th>
                  <th>Status</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!contractsToDisplay || contractsToDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-base-content/70 py-8">
                      {selectedProvider || selectedConsumer || selectedStatus
                        ? 'No contracts found with current filters'
                        : 'No contracts found. Contracts will appear here after interactions are recorded.'}
                    </td>
                  </tr>
                ) : (
                  contractsToDisplay.map(contract => (
                    <tr key={contract.id}>
                      <td>
                        <Link
                          to={`/services/consumer/${contract.consumerName}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {contract.consumerName}
                        </Link>
                      </td>
                      <td>
                        <VersionBadge
                          version={contract.consumerVersion}
                          serviceName={contract.consumerName}
                          serviceType="consumer"
                        />
                      </td>
                      <td>
                        <Link
                          to={`/services/provider/${contract.providerName}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {contract.providerName}
                        </Link>
                      </td>
                      <td>
                        <VersionBadge
                          version={contract.providerVersion || 'latest'}
                          serviceName={contract.providerName}
                          serviceType="provider"
                        />
                      </td>
                      <td>
                        <SpecBadge specType={contract.specType} size="sm" />
                      </td>
                      <td>
                        <span className="font-mono text-sm">{contract.interactionCount}</span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(contract.status)}`}>
                          {contract.status}
                        </span>
                      </td>
                      <td>
                        <TimestampDisplay timestamp={contract.lastSeen} />
                      </td>
                      <td>
                        <Link to={`/contracts/${contract.id}`} className="btn btn-sm btn-ghost">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasNextPage && (
            <div className="card-actions justify-center pt-4">
              <button
                className="btn btn-outline btn-sm"
                onClick={handleShowMore}
                disabled={isFetching}
              >
                {isFetching && currentOffset > 0 ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Loading...
                  </>
                ) : (
                  'Show More'
                )}
              </button>
              {totalCount && (
                <span className="text-sm text-base-content/70 ml-2">
                  Showing {contractsToDisplay.length} of {totalCount} results
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Contracts
