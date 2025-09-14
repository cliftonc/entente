import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { verificationApi } from '../utils/api'
import TimestampDisplay from '../components/TimestampDisplay'
import GitShaLink from '../components/GitShaLink'
import ProviderFilter from '../components/ProviderFilter'
import ConsumerFilter from '../components/ConsumerFilter'
import { useState, useEffect } from 'react'

function Verification() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [providerFilter, setProviderFilter] = useState(searchParams.get('provider') || '')
  const [consumerFilter, setConsumerFilter] = useState(searchParams.get('consumer') || '')

  // Update filters when URL params change
  useEffect(() => {
    const provider = searchParams.get('provider')
    const consumer = searchParams.get('consumer')
    if (provider) setProviderFilter(provider)
    if (consumer) setConsumerFilter(consumer)
  }, [searchParams])

  const {
    data: verificationResults,
    isLoading,
    error
  } = useQuery({
    queryKey: ['verification-all'],
    queryFn: verificationApi.getAll,
  })

  // Filter results based on provider and consumer filters
  const filteredResults = verificationResults?.filter(result => {
    if (providerFilter && (result.provider || result.providerName || '') !== providerFilter) return false
    if (consumerFilter) {
      // For now, this would need additional data from the backend to filter by consumer
      // This is a placeholder for when consumer data is available in verification results
      return true
    }
    return true
  }) || []

  // Calculate statistics based on filtered results
  const totalVerifications = filteredResults.length
  const passedVerifications = filteredResults.filter(v => v.status === 'passed').length
  const failedVerifications = filteredResults.filter(v => v.status === 'failed').length
  const overallPassRate = totalVerifications > 0 ? (passedVerifications / totalVerifications) * 100 : 0

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
    setProviderFilter('')
    setConsumerFilter('')
    setSearchParams({})
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Verification</h1>
            <p className="text-base-content/70 mt-1">
              Monitor provider verification results and contract compliance
            </p>
          </div>
          <div className="skeleton h-10 w-40"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="stats shadow">
              <div className="stat">
                <div className="skeleton h-4 w-24 mb-2"></div>
                <div className="skeleton h-8 w-16 mb-2"></div>
                <div className="skeleton h-3 w-20"></div>
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
          <h1 className="text-3xl font-bold text-base-content">Verification</h1>
          <p className="text-base-content/70 mt-1">
            Monitor provider verification results and contract compliance
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Error loading verification data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Verification
            {providerFilter && <span className="text-lg font-normal text-base-content/70"> • Provider: {providerFilter}</span>}
            {consumerFilter && <span className="text-lg font-normal text-base-content/70"> • Consumer: {consumerFilter}</span>}
          </h1>
          <p className="text-base-content/70 mt-1">
            Monitor provider verification results and contract compliance
          </p>
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
        {(providerFilter || consumerFilter) && (
          <div className="form-control">
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Overall Pass Rate</div>
            <div className={`stat-value ${overallPassRate >= 95 ? 'text-success' : overallPassRate >= 80 ? 'text-warning' : 'text-error'}`}>
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

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Recent Verification Results</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Consumer</th>
                  <th>Version</th>
                  <th>Provider Git SHA</th>
                  <th>Consumer Git SHA</th>
                  <th>Results</th>
                  <th>Pass Rate</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-base-content/70 py-8">
                      {providerFilter ? `No verification results found for provider "${providerFilter}"` : 'No verification results available'}
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((result, index) => (
                    <tr key={result.id || index}>
                      <td>
                        <Link
                          to={`/services/provider/${result.providerName || result.provider}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {result.providerName || result.provider}
                        </Link>
                      </td>
                      <td>
                        {result.consumerName || result.consumer ? (
                          <Link
                            to={`/services/consumer/${result.consumerName || result.consumer}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {result.consumerName || result.consumer}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        <span className="badge badge-outline">
                          v{result.providerVersion || result.version || '1.0.0'}
                        </span>
                      </td>
                      <td>
                        <GitShaLink
                          sha={result.providerGitSha}
                          repositoryUrl={result.providerGitRepositoryUrl}
                        />
                      </td>
                      <td>
                        <GitShaLink
                          sha={result.consumerGitSha}
                          repositoryUrl={result.consumerGitRepositoryUrl}
                        />
                      </td>
                      <td>
                        <span className="text-sm">
                          {result.passed || 0}/{result.total || 1}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-base-300 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                result.status === 'passed' ? 'bg-success' : 'bg-error'
                              }`}
                              style={{ width: `${result.status === 'passed' ? 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm">
                            {result.status === 'passed' ? '100' : '0'}%
                          </span>
                        </div>
                      </td>
                      <td><TimestampDisplay timestamp={result.createdAt || result.lastRun} /></td>
                      <td>
                        <span className={`badge ${
                          result.status === 'passed' ? 'badge-success' :
                          result.status === 'failed' ? 'badge-error' : 'badge-warning'
                        }`}>
                          {result.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Link to={`/verification/${result.id}`} className="btn btn-ghost btn-xs">
                            View
                          </Link>
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

export default Verification