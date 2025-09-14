import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { interactionApi } from '../utils/api'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TimestampDisplay from '../components/TimestampDisplay'
import GitShaLink from '../components/GitShaLink'
import ProviderFilter from '../components/ProviderFilter'
import ConsumerFilter from '../components/ConsumerFilter'

function Interactions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedProvider, setSelectedProvider] = useState<string>(searchParams.get('provider') || searchParams.get('service') || '')
  const [selectedConsumer, setSelectedConsumer] = useState<string>(searchParams.get('consumer') || '')

  // Update filters when URL params change
  useEffect(() => {
    const provider = searchParams.get('provider') || searchParams.get('service') // Support legacy 'service' param
    const consumer = searchParams.get('consumer')
    if (provider) {
      setSelectedProvider(provider)
    }
    if (consumer) {
      setSelectedConsumer(consumer)
    }
  }, [searchParams])

  const {
    data: interactions,
    isLoading: interactionsLoading,
    error: interactionsError
  } = useQuery({
    queryKey: ['interactions', 'all', selectedProvider, selectedConsumer],
    queryFn: () => interactionApi.getAll({
      provider: selectedProvider || undefined,
      consumer: selectedConsumer || undefined,
      limit: 200
    }),
  })

  // Handle filter changes
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    updateUrlParams({ provider: provider || undefined, consumer: selectedConsumer || undefined })
  }

  const handleConsumerChange = (consumer: string) => {
    setSelectedConsumer(consumer)
    updateUrlParams({ provider: selectedProvider || undefined, consumer: consumer || undefined })
  }

  const updateUrlParams = (params: { provider?: string; consumer?: string }) => {
    const newParams: Record<string, string> = {}
    if (params.provider) newParams.provider = params.provider
    if (params.consumer) newParams.consumer = params.consumer
    setSearchParams(Object.keys(newParams).length > 0 ? newParams : {})
  }

  const clearFilters = () => {
    setSelectedProvider('')
    setSelectedConsumer('')
    setSearchParams({})
  }

  const isLoading = interactionsLoading
  const error = interactionsError

  // Create filter summary for display
  const getFilterSummary = () => {
    const parts = []
    if (selectedProvider) parts.push(`Provider: ${selectedProvider}`)
    if (selectedConsumer) parts.push(`Consumer: ${selectedConsumer}`)
    return parts.length > 0 ? ` • ${parts.join(' • ')}` : ''
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Interactions</h1>
          <p className="text-base-content/70 mt-1">
            View recorded consumer interactions and usage patterns
          </p>
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-48 mb-4"></div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Consumer</th>
                    <th>Operation</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      <td><div className="skeleton h-4 w-24"></div></td>
                      <td><div className="skeleton h-4 w-20"></div></td>
                      <td><div className="skeleton h-4 w-16"></div></td>
                      <td><div className="skeleton h-4 w-12"></div></td>
                      <td><div className="skeleton h-4 w-16"></div></td>
                      <td><div className="skeleton h-4 w-12"></div></td>
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
          <h1 className="text-3xl font-bold text-base-content">Interactions</h1>
          <p className="text-base-content/70 mt-1">
            View recorded consumer interactions and usage patterns
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Error loading interactions data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">
          Interactions
          <span className="text-lg font-normal text-base-content/70">{getFilterSummary()}</span>
        </h1>
        <p className="text-base-content/70 mt-1">
          View recorded consumer interactions and usage patterns
        </p>
      </div>

      {/* Provider and Consumer Filters */}
      <div className="flex gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter
          value={selectedProvider}
          onChange={handleProviderChange}
        />
        <ConsumerFilter
          value={selectedConsumer}
          onChange={handleConsumerChange}
        />
        {(selectedProvider || selectedConsumer) && (
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

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            Recorded Interactions
            {(selectedProvider || selectedConsumer) && (
              <span className="text-base font-normal text-base-content/70">
                ({interactions?.length || 0} results)
              </span>
            )}
          </h2>
            <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Consumer</th>
                  <th>Consumer Git SHA</th>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!interactions || interactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/70 py-8">
                      {selectedProvider || selectedConsumer ?
                        'No interactions found with current filters' :
                        'No interactions recorded yet. Use filters above to search for specific interactions.'
                      }
                    </td>
                  </tr>
                ) : (
                  interactions.slice(0, 100).map((interaction, index) => (
                    <tr key={interaction.id || index}>
                      <td>
                        <Link
                          to={`/services/provider/${interaction.service}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {interaction.service}
                        </Link>
                      </td>
                      <td>
                        <Link
                          to={`/services/consumer/${interaction.consumer}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {interaction.consumer}
                        </Link>
                      </td>
                      <td>
                        <GitShaLink
                          sha={interaction.consumerGitSha}
                          repositoryUrl={interaction.consumerGitRepositoryUrl}
                        />
                      </td>
                      <td>{interaction.operation}</td>
                      <td>
                        <span className={`badge ${
                          interaction.response?.status >= 200 && interaction.response?.status < 300 ? 'badge-success' :
                          interaction.response?.status >= 500 ? 'badge-error' :
                          interaction.response?.status >= 300 ? 'badge-warning' : 'badge-neutral'
                        }`}>
                          {interaction.response?.status || 'N/A'}
                        </span>
                      </td>
                      <td><TimestampDisplay timestamp={interaction.timestamp} /></td>
                      <td>
                        <Link
                          to={`/interactions/${interaction.id}`}
                          className="btn btn-sm btn-ghost"
                        >
                          View
                        </Link>
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

export default Interactions