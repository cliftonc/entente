import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConsumerFilter from '../components/ConsumerFilter'
import GetStartedButton from '../components/GetStartedButton'
import GitShaLink from '../components/GitShaLink'
import ProviderFilter from '../components/ProviderFilter'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VerificationBar from '../components/VerificationBar'
import VersionBadge from '../components/VersionBadge'
import VerificationExample from '../components/get-started-examples/VerificationExample'
import { usePendingVerificationTasks, useVerificationResults } from '../hooks/useVerifications'
import type { ExtendedVerificationResult } from '../lib/types'

function Verification() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [providerFilter, setProviderFilter] = useState(searchParams.get('provider') || '')
  const [consumerFilter, setConsumerFilter] = useState(searchParams.get('consumer') || '')
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '')
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '')
  const [displayedResults, setDisplayedResults] = useState<ExtendedVerificationResult[]>([])
  const [currentOffset, setCurrentOffset] = useState(0)
  const pageSize = 10

  // Track if we're updating from URL to prevent circular updates
  const isUpdatingFromUrl = useRef(false)

  // Update filters when URL params change
  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false
      return
    }

    const provider = searchParams.get('provider') || ''
    const consumer = searchParams.get('consumer') || ''
    const start = searchParams.get('startDate') || ''
    const end = searchParams.get('endDate') || ''

    setProviderFilter(provider)
    setConsumerFilter(consumer)
    setStartDate(start)
    setEndDate(end)
  }, [searchParams])

  const {
    data: verificationResults,
    isLoading: isLoadingCurrentPage,
    error,
    hasNextPage,
    totalCount,
    statistics,
    isFetching,
  } = useVerificationResults({
    limit: pageSize,
    offset: currentOffset,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const {
    data: pendingTasks,
    isLoading: isPendingLoading,
    error: pendingError,
  } = usePendingVerificationTasks()

  // Reset when filters change (MUST run before data update)
  useEffect(() => {
    setCurrentOffset(0)
    setDisplayedResults([])
  }, [providerFilter, consumerFilter, startDate, endDate])

  // Update displayed results when new data is loaded
  useEffect(() => {
    if (verificationResults !== undefined) {
      if (verificationResults.length === 0 && currentOffset === 0) {
        // Empty result set - clear displayed results only if not already empty
        setDisplayedResults(prev => (prev.length > 0 ? [] : prev))
        return
      }

      if (verificationResults.length > 0) {
        if (currentOffset === 0) {
          // First page - replace all results
          setDisplayedResults(verificationResults)
        } else {
          // Additional pages - append to existing results, avoiding duplicates
          setDisplayedResults(prev => {
            const existingIds = new Set(prev.map(item => item.id))
            const newItems = verificationResults.filter(item => !existingIds.has(item.id))
            return [...prev, ...newItems]
          })
        }
      }
    }
  }, [verificationResults])

  // Filter results based on provider and consumer filters
  const filteredResults =
    displayedResults?.filter(result => {
      if (providerFilter && (result.provider || '') !== providerFilter) return false
      if (consumerFilter) {
        // For now, this would need additional data from the backend to filter by consumer
        // This is a placeholder for when consumer data is available in verification results
        return true
      }
      return true
    }) || []

  // Filter pending tasks based on provider and consumer filters
  const filteredPendingTasks =
    pendingTasks?.filter(task => {
      if (providerFilter && task.provider !== providerFilter) return false
      if (consumerFilter && task.consumer !== consumerFilter) return false
      return true
    }) || []

  // Use statistics from API (independent of pagination and filtering)
  const totalVerifications = statistics?.totalVerifications || 0
  const passedVerifications = statistics?.passedVerifications || 0
  const failedVerifications = statistics?.failedVerifications || 0
  const overallPassRate = statistics?.overallPassRate || 0

  // Handle filter changes
  const handleProviderFilterChange = (provider: string) => {
    setProviderFilter(provider)
    updateUrlParams({
      provider: provider || undefined,
      consumer: consumerFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
  }

  const handleConsumerFilterChange = (consumer: string) => {
    setConsumerFilter(consumer)
    updateUrlParams({
      provider: providerFilter || undefined,
      consumer: consumer || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
  }

  const handleDateFilterChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
    updateUrlParams({
      provider: providerFilter || undefined,
      consumer: consumerFilter || undefined,
      startDate: start || undefined,
      endDate: end || undefined,
    })
  }

  const updateUrlParams = (params: {
    provider?: string
    consumer?: string
    startDate?: string
    endDate?: string
  }) => {
    const newParams: Record<string, string> = {}
    if (params.provider) newParams.provider = params.provider
    if (params.consumer) newParams.consumer = params.consumer
    if (params.startDate) newParams.startDate = params.startDate
    if (params.endDate) newParams.endDate = params.endDate

    isUpdatingFromUrl.current = true
    setSearchParams(Object.keys(newParams).length > 0 ? newParams : {})
  }

  const clearFilters = () => {
    setProviderFilter('')
    setConsumerFilter('')
    setStartDate('')
    setEndDate('')
    isUpdatingFromUrl.current = true
    setSearchParams({})
  }

  const handleShowMore = () => {
    console.log(`Loading more results: offset ${currentOffset} -> ${currentOffset + pageSize}`)
    setCurrentOffset(prev => prev + pageSize)
  }

  // Only show full loading state for initial load (first page)
  if ((isLoadingCurrentPage && currentOffset === 0) || isPendingLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Verification</h1>
            <p className="text-base-content/70 mt-1">
              Monitor provider verification results and contract compliance
            </p>
          </div>
          <div className="skeleton h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="stats shadow">
              <div className="stat">
                <div className="skeleton h-4 w-24 mb-2" />
                <div className="skeleton h-8 w-16 mb-2" />
                <div className="skeleton h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || pendingError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Verification</h1>
          <p className="text-base-content/70 mt-1">
            Monitor provider verification results and contract compliance
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
          <span>Error loading verification data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-base-content">
            Verification
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
            {startDate && endDate && (
              <span className="text-lg font-normal text-base-content/70">
                {' '}
                • Date: {startDate === endDate ? startDate : `${startDate} - ${endDate}`}
              </span>
            )}
          </h1>
          <p className="text-base-content/70 mt-1">
            Monitor provider verification results and contract compliance
          </p>
        </div>
        <div className="flex-shrink-0">
          <GetStartedButton>
            <VerificationExample />
          </GetStartedButton>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter
          value={providerFilter}
          onChange={handleProviderFilterChange}
          label="Provider Filter"
        />
        <ConsumerFilter
          value={consumerFilter}
          onChange={handleConsumerFilterChange}
          label="Consumer Filter"
        />
        <div className="form-control">
          <label className="label">
            <span className="label-text">Start Date</span>
          </label>
          <input
            type="date"
            className="input input-bordered"
            value={startDate || ''}
            onChange={e => {
              const newStartDate = e.target.value || ''
              handleDateFilterChange(newStartDate, endDate)
            }}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">End Date</span>
          </label>
          <input
            type="date"
            className="input input-bordered"
            value={endDate || ''}
            onChange={e => {
              const newEndDate = e.target.value || ''
              handleDateFilterChange(startDate, newEndDate)
            }}
          />
        </div>
        {(providerFilter || consumerFilter || startDate || endDate) && (
          <div className="form-control">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Verification Activity Bar */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <VerificationBar days={30} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Pending Verifications</div>
            <div className="stat-value text-warning">{filteredPendingTasks.length}</div>
            <div className="stat-desc">awaiting results</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Overall Pass Rate</div>
            <div
              className={`stat-value ${overallPassRate >= 95 ? 'text-success' : overallPassRate >= 80 ? 'text-warning' : 'text-error'}`}
            >
              {Math.round(overallPassRate * 10) / 10}%
            </div>
            <div className="stat-desc">Based on all verifications</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total Verifications</div>
            <div className="stat-value">{totalVerifications}</div>
            <div className="stat-desc">all time</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Failed Tests</div>
            <div className="stat-value text-error">{failedVerifications}</div>
            <div className="stat-desc">require attention</div>
          </div>
        </div>
      </div>

      {/* Pending Verifications Section */}
      {filteredPendingTasks.length > 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Pending Verifications</h2>
            <p className="text-base-content/70 mb-4">
              Verification tasks that have been created but haven't received results yet
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Provider Version</th>
                    <th>Consumer</th>
                    <th>Consumer Version</th>
                    <th>Spec Type</th>
                    <th>Interactions</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingTasks.map((task, index) => (
                    <tr key={task.id || index}>
                      <td>
                        <Link
                          to={`/services/provider/${task.provider}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {task.provider}
                        </Link>
                      </td>
                      <td>
                        <VersionBadge
                          version={task.providerVersion}
                          serviceName={task.provider}
                        />
                      </td>
                      <td>
                        <Link
                          to={`/services/consumer/${task.consumer}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {task.consumer}
                        </Link>
                      </td>
                      <td>
                        <VersionBadge
                          version={task.consumerVersion}
                          serviceName={task.consumer}
                        />
                      </td>
                      <td>
                        <SpecBadge specType={task.specType || 'openapi'} size="sm" />
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
                      <td>
                        {task.contractId ? (
                          <Link
                            to={`/contracts/${task.contractId}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View Contract
                          </Link>
                        ) : (
                          <span className="text-base-content/50 text-xs">No contract</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Verification Results */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Recent Verification Results</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Provider Version</th>
                  <th>Consumer</th>
                  <th>Consumer Version</th>
                  <th>Spec Type</th>
                  <th>Results</th>
                  <th>Status</th>
                  <th>Last Run</th>
                  <th>Actions</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-base-content/70 py-8">
                      {providerFilter
                        ? `No verification results found for provider "${providerFilter}"`
                        : 'No verification results available'}
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((result, index) => (
                    <tr key={result.id || index}>
                      <td>
                        <Link
                          to={`/services/provider/${result.provider || result.provider}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {result.provider || result.provider}
                        </Link>
                      </td>
                      <td>
                        <VersionBadge
                          version={result.providerVersion || result.version || '1.0.0'}
                          serviceName={result.provider || result.provider}
                        />
                      </td>
                      <td>
                        {result.consumer || result.consumer ? (
                          <Link
                            to={`/services/consumer/${result.consumer || result.consumer}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {result.consumer || result.consumer}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        {result.consumer || result.consumer ? (
                          <VersionBadge
                            version={result.consumerVersion || 'N/A'}
                            serviceName={result.consumer || result.consumer}
                          />
                        ) : (
                          <span className="text-sm text-base-content/50">N/A</span>
                        )}
                      </td>
                      <td>
                        <SpecBadge specType={result.specType || 'openapi'} size="sm" />
                      </td>
                      <td>
                        <span className="text-sm">
                          {result.passed || 0}/{result.total || 1}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            result.status === 'passed'
                              ? 'badge-success'
                              : result.status === 'failed'
                                ? 'badge-error'
                                : 'badge-warning'
                          }`}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td>
                        <TimestampDisplay
                          timestamp={result.createdAt || result.lastRun || new Date().toISOString()}
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Link to={`/verification/${result.id}`} className="btn btn-ghost btn-xs">
                            View
                          </Link>
                        </div>
                      </td>
                      <td>
                        {result.contractId ? (
                          <Link
                            to={`/contracts/${result.contractId}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View Contract
                          </Link>
                        ) : (
                          <span className="text-base-content/50 text-xs">No contract</span>
                        )}
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
                  Showing {filteredResults.length} of {totalCount} results
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Verification
