import type { Fixture } from '@entente/types'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GetStartedButton from '../components/GetStartedButton'
import FixturesExample from '../components/get-started-examples/FixturesExample'
import ProviderFilter from '../components/ProviderFilter'
import TimestampDisplay from '../components/TimestampDisplay'
import { useAuth } from '../hooks/useAuth'
import {
  useFixtures,
  useApproveFixture,
  useRejectFixture,
  useRevokeFixture,
  useApproveAllFixtures,
  useFixtureServicesSummary,
} from '../hooks/useFixtures'

function Fixtures() {
  const { authenticated, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [providerFilter, setProviderFilter] = useState(
    searchParams.get('provider') || searchParams.get('service') || ''
  )
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')

  // Update filters when URL params change
  useEffect(() => {
    const provider = searchParams.get('provider') || searchParams.get('service') // Support legacy 'service' param
    const status = searchParams.get('status')
    if (provider) setProviderFilter(provider)
    if (status) setStatusFilter(status)
  }, [searchParams])

  const {
    data: fixtures,
    isLoading,
    error,
    isEmpty,
  } = useFixtures(
    {
      provider: providerFilter || undefined,
      status:
        statusFilter !== 'all' ? (statusFilter as 'draft' | 'approved' | 'rejected') : undefined,
    },
    {
      enabled: Boolean(authenticated),
    }
  )

  const displayedFixtures = fixtures || []
  const draftFixtures = fixtures?.filter(f => f.status === 'draft') || []

  // Service summary (counts without fetching all fixture data)
  const { data: servicesSummary, isLoading: summaryLoading } = useFixtureServicesSummary({
    enabled: Boolean(authenticated),
  })

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({})
  const toggleService = (service: string) => {
    setExpandedServices(prev => ({ ...prev, [service]: !prev[service] }))
  }

  const filteredServicesSummary =
    servicesSummary?.filter(s => (providerFilter ? s.service === providerFilter : true)) || []

  const totalDraftsVisible = filteredServicesSummary.reduce((acc, s) => acc + s.draft, 0)

  // Handle filter changes
  const handleProviderFilterChange = (provider: string) => {
    setProviderFilter(provider)
    updateUrlParams({
      provider: provider || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
  }

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status)
    updateUrlParams({
      provider: providerFilter || undefined,
      status: status !== 'all' ? status : undefined,
    })
  }

  const clearFilters = () => {
    setProviderFilter('')
    setStatusFilter('all')
    setSearchParams({})
  }

  const updateUrlParams = (params: { provider?: string; status?: string }) => {
    const newParams: Record<string, string> = {}
    if (params.provider) newParams.provider = params.provider
    if (params.status) newParams.status = params.status
    setSearchParams(Object.keys(newParams).length > 0 ? newParams : {})
  }

  // Mutation hooks with optimistic updates
  const approveMutation = useApproveFixture()
  const rejectMutation = useRejectFixture()
  const revokeMutation = useRevokeFixture()
  const approveAllMutation = useApproveAllFixtures()

  const handleApprove = (fixture: Fixture) => {
    approveMutation.mutate({
      id: fixture.id,
      approvedBy: user?.username || 'unknown',
    })
  }

  const handleReject = (fixture: Fixture) => {
    rejectMutation.mutate({
      id: fixture.id,
      rejectedBy: user?.username || 'unknown',
    })
  }

  const handleRevoke = (fixture: Fixture) => {
    revokeMutation.mutate({
      id: fixture.id,
      revokedBy: user?.username || 'unknown',
    })
  }

  const handleApproveAll = () => {
    if (displayedFixtures.length > 0) {
      const visibleDrafts = displayedFixtures.filter(
        f =>
          (providerFilter ? f.service === providerFilter : true) &&
          f.status === 'draft' &&
          (statusFilter === 'all' || f.status === statusFilter)
      )
      if (visibleDrafts.length > 0) {
        approveAllMutation.mutate({
          fixtures: visibleDrafts,
          approvedBy: user?.username || 'unknown',
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Fixtures</h1>
            <p className="text-base-content/70 mt-1">Manage test fixtures and approve proposals</p>
          </div>
          <div className="skeleton h-10 w-32" />
        </div>
        <div className="skeleton h-16 w-full" />
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

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixtures</h1>
          <p className="text-base-content/70 mt-1">Manage test fixtures and approve proposals</p>
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
          <span>Error loading fixtures data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-base-content">
            Fixtures
            {providerFilter && (
              <span className="text-lg font-normal text-base-content/70">
                {' '}
                • Provider: {providerFilter}
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="text-lg font-normal text-base-content/70"> • {statusFilter}</span>
            )}
          </h1>
          <p className="text-base-content/70 mt-1">Manage test fixtures and approve proposals</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <GetStartedButton>
            <FixturesExample />
          </GetStartedButton>
          <button
            className="btn btn-success btn-sm whitespace-nowrap"
            disabled={totalDraftsVisible === 0 || approveAllMutation.isPending}
            onClick={handleApproveAll}
          >
            {approveAllMutation.isPending ? (
              <span className="loading loading-spinner loading-sm mr-2" />
            ) : (
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            Approve All ({totalDraftsVisible})
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter value={providerFilter} onChange={handleProviderFilterChange} />
        <div className="form-control">
          <label className="label">
            <span className="label-text">Status</span>
          </label>
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={e => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft Only</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>
        {(providerFilter || statusFilter !== 'all') && (
          <div className="form-control">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title flex justify-between items-center w-full">
            <span>Services with Fixtures</span>
            <span className="text-sm font-normal text-base-content/60">
              {filteredServicesSummary.length} services
            </span>
          </h2>
          {summaryLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : filteredServicesSummary.length === 0 ? (
            <div className="text-center py-8 text-base-content/70">
              {providerFilter ? 'No services match current filter' : 'No fixtures available yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServicesSummary.map(service => {
                const isExpanded = expandedServices[service.service]
                const serviceFixtures = displayedFixtures.filter(
                  f =>
                    f.service === service.service &&
                    (statusFilter === 'all' || f.status === statusFilter)
                )
                const draftCount = service.draft
                const approveAllDisabled = draftCount === 0 || approveAllMutation.isPending
                const handleApproveAllService = () => {
                  const serviceDrafts = serviceFixtures.filter(f => f.status === 'draft')
                  if (serviceDrafts.length > 0) {
                    approveAllMutation.mutate({
                      fixtures: serviceDrafts,
                      approvedBy: user?.username || 'unknown',
                    })
                  }
                }
                return (
                  <div key={service.service} className="border border-base-300 rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleService(service.service)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-base-200/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                        <span className="font-medium">{service.service}</span>
                        <div className="flex gap-2">
                          <span
                            className="badge badge-warning"
                            aria-label={`${service.draft} draft`}
                          >
                            {service.draft}
                            <span className="hidden sm:inline ml-1">draft</span>
                          </span>
                          <span
                            className="badge badge-success"
                            aria-label={`${service.approved} approved`}
                          >
                            {service.approved}
                            <span className="hidden sm:inline ml-1">approved</span>
                          </span>
                          <span
                            className="badge badge-error"
                            aria-label={`${service.rejected} rejected`}
                          >
                            {service.rejected}
                            <span className="hidden sm:inline ml-1">rejected</span>
                          </span>
                          <span
                            className="badge badge-neutral"
                            aria-label={`${service.total} total`}
                          >
                            {service.total}
                            <span className="hidden sm:inline ml-1">total</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {draftCount > 0 && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleApproveAllService()
                            }}
                            className="btn btn-success btn-xs"
                            disabled={approveAllDisabled}
                          >
                            {approveAllMutation.isPending ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              `Approve ${draftCount}`
                            )}
                          </button>
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {serviceFixtures.length === 0 ? (
                          <div className="text-sm text-base-content/60 py-2">
                            No fixtures matching status filter
                          </div>
                        ) : (
                          <div className="overflow-x-auto mt-2 bg-base-200 rounded-md p-2">
                            <table className="table table-compact text-sm">
                              <thead>
                                <tr>
                                  <th className="w-1/4">Operation</th>
                                  <th className="w-16">Status</th>
                                  <th className="w-20">Source</th>
                                  <th className="w-32">Date</th>
                                  <th className="w-40">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {serviceFixtures.map(fixture => (
                                  <tr key={fixture.id}>
                                    <td>
                                      <code className="font-mono text-sm text-base-content/80">
                                        {fixture.operation}
                                      </code>
                                    </td>
                                    <td>
                                      <span
                                        className={`badge ${fixture.status === 'draft' ? 'badge-warning' : fixture.status === 'approved' ? 'badge-success' : fixture.status === 'rejected' ? 'badge-error' : 'badge-info'}`}
                                      >
                                        {fixture.status}
                                      </span>
                                    </td>
                                    <td>
                                      <span
                                        className={`badge ${fixture.source === 'consumer' ? 'badge-primary' : 'badge-secondary'}`}
                                      >
                                        {fixture.source}
                                      </span>
                                    </td>
                                    <td className="text-xs">
                                      <TimestampDisplay
                                        timestamp={
                                          fixture.status === 'approved'
                                            ? fixture.approvedAt || fixture.createdAt
                                            : fixture.createdAt
                                        }
                                      />
                                    </td>
                                    <td>
                                      <div className="flex gap-1 flex-wrap">
                                        {fixture.status === 'draft' ? (
                                          <>
                                            <button
                                              className="btn btn-success btn-xs"
                                              onClick={() => handleApprove(fixture)}
                                              disabled={
                                                approveMutation.isPending &&
                                                approveMutation.variables?.id === fixture.id
                                              }
                                            >
                                              {approveMutation.isPending &&
                                              approveMutation.variables?.id === fixture.id ? (
                                                <span className="loading loading-spinner loading-xs" />
                                              ) : (
                                                'Approve'
                                              )}
                                            </button>
                                            <button
                                              className="btn btn-error btn-xs"
                                              onClick={() => handleReject(fixture)}
                                              disabled={
                                                rejectMutation.isPending &&
                                                rejectMutation.variables?.id === fixture.id
                                              }
                                            >
                                              {rejectMutation.isPending &&
                                              rejectMutation.variables?.id === fixture.id ? (
                                                <span className="loading loading-spinner loading-xs" />
                                              ) : (
                                                'Reject'
                                              )}
                                            </button>
                                          </>
                                        ) : fixture.status === 'approved' ? (
                                          <button
                                            className="btn btn-error btn-xs"
                                            onClick={() => handleRevoke(fixture)}
                                            disabled={
                                              revokeMutation.isPending &&
                                              revokeMutation.variables?.id === fixture.id
                                            }
                                          >
                                            {revokeMutation.isPending &&
                                            revokeMutation.variables?.id === fixture.id ? (
                                              <span className="loading loading-spinner loading-xs" />
                                            ) : (
                                              'Reject'
                                            )}
                                          </button>
                                        ) : (
                                          <button
                                            className="btn btn-success btn-xs"
                                            onClick={() => handleApprove(fixture)}
                                            disabled={
                                              approveMutation.isPending &&
                                              approveMutation.variables?.id === fixture.id
                                            }
                                          >
                                            {approveMutation.isPending &&
                                            approveMutation.variables?.id === fixture.id ? (
                                              <span className="loading loading-spinner loading-xs" />
                                            ) : (
                                              'Approve'
                                            )}
                                          </button>
                                        )}
                                        <Link
                                          to={`/fixtures/${fixture.id}`}
                                          className="btn btn-ghost btn-xs"
                                        >
                                          View
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Fixtures
