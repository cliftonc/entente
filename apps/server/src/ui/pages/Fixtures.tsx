import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { fixtureApi } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import TimestampDisplay from '../components/TimestampDisplay'
import ProviderFilter from '../components/ProviderFilter'
import { useState, useEffect } from 'react'

function Fixtures() {
  const { authenticated, user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [providerFilter, setProviderFilter] = useState(searchParams.get('provider') || searchParams.get('service') || '')
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
    error
  } = useQuery({
    queryKey: ['fixtures', providerFilter, statusFilter],
    queryFn: () => {
      const params: any = {}
      if (providerFilter) params.provider = providerFilter
      if (statusFilter !== 'all') params.status = statusFilter
      return fixtureApi.getAll(params)
    },
    enabled: Boolean(authenticated),
    staleTime: 1000 * 30,
    retry: 1,
  })

  const displayedFixtures = fixtures || []
  const draftFixtures = fixtures?.filter(f => f.status === 'draft') || []

  // Handle filter changes
  const handleProviderFilterChange = (provider: string) => {
    setProviderFilter(provider)
    updateUrlParams({
      provider: provider || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined
    })
  }

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status)
    updateUrlParams({
      provider: providerFilter || undefined,
      status: status !== 'all' ? status : undefined
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

  // Approve fixture mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      fixtureApi.approve(id, user?.username || 'unknown', notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
    },
  })

  // Reject fixture mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      fixtureApi.reject(id, user?.username || 'unknown', notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
    },
  })

  // Revoke fixture mutation
  const revokeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      fixtureApi.revoke(id, user?.username || 'unknown', notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
    },
  })

  // Approve all mutations
  const approveAllMutation = useMutation({
    mutationFn: async (fixtures: any[]) => {
      const promises = fixtures.map(fixture =>
        fixtureApi.approve(fixture.id, user?.username || 'unknown')
      )
      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
    },
  })

  const handleApprove = (fixture: any) => {
    approveMutation.mutate({ id: fixture.id })
  }

  const handleReject = (fixture: any) => {
    rejectMutation.mutate({ id: fixture.id })
  }

  const handleRevoke = (fixture: any) => {
    revokeMutation.mutate({ id: fixture.id })
  }

  const handleApproveAll = () => {
    if (draftFixtures.length > 0) {
      approveAllMutation.mutate(draftFixtures)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-base-content">Fixtures</h1>
            <p className="text-base-content/70 mt-1">
              Manage test fixtures and approve proposals
            </p>
          </div>
          <div className="skeleton h-10 w-32"></div>
        </div>
        <div className="skeleton h-16 w-full"></div>
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
          <h1 className="text-3xl font-bold text-base-content">Fixtures</h1>
          <p className="text-base-content/70 mt-1">
            Manage test fixtures and approve proposals
          </p>
        </div>
        <div className="alert alert-error">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Error loading fixtures data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Fixtures
            {providerFilter && <span className="text-lg font-normal text-base-content/70"> • Provider: {providerFilter}</span>}
            {statusFilter !== 'all' && <span className="text-lg font-normal text-base-content/70"> • {statusFilter}</span>}
          </h1>
          <p className="text-base-content/70 mt-1">
            Manage test fixtures and approve proposals
          </p>
        </div>
        <button
          className="btn btn-success"
          disabled={draftFixtures.length === 0 || approveAllMutation.isPending}
          onClick={handleApproveAll}
        >
          {approveAllMutation.isPending ? (
            <span className="loading loading-spinner loading-sm mr-2"></span>
          ) : (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Approve All ({draftFixtures.length})
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex gap-4 items-end bg-base-100 p-4 rounded-lg shadow">
        <ProviderFilter
          value={providerFilter}
          onChange={handleProviderFilterChange}
        />
        <div className="form-control">
          <label className="label">
            <span className="label-text">Status</span>
          </label>
          <select
            className="select select-bordered"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft Only</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>
        {(providerFilter || statusFilter !== 'all') && (
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

      {statusFilter !== 'approved' && (
        <div className="alert alert-info">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>You have {draftFixtures.length} draft fixtures awaiting approval</span>
        </div>
      )}

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            {statusFilter === 'draft' ? 'Draft Fixtures' :
             statusFilter === 'approved' ? 'Approved Fixtures' :
             'All Fixtures'}
            {providerFilter && <span className="text-sm font-normal">• Provider: {providerFilter}</span>}
          </h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedFixtures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/70 py-8">
                      {providerFilter ?
                        'No fixtures found with current filters' :
                        statusFilter === 'draft' ? 'No draft fixtures' :
                        statusFilter === 'approved' ? 'No approved fixtures' :
                        'No fixtures available'
                      }
                    </td>
                  </tr>
                ) : (
                  displayedFixtures.map((fixture) => (
                    <tr key={fixture.id}>
                      <td>{fixture.service}</td>
                      <td>
                        <code className="bg-base-200 px-2 py-1 rounded text-sm">
                          {fixture.operation}
                        </code>
                      </td>
                      <td>
                        <span className={`badge ${
                          fixture.status === 'draft' ? 'badge-warning' :
                          fixture.status === 'approved' ? 'badge-success' :
                          fixture.status === 'rejected' ? 'badge-error' :
                          'badge-info'
                        }`}>
                          {fixture.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          fixture.source === 'consumer' ? 'badge-primary' : 'badge-secondary'
                        }`}>
                          {fixture.source}
                        </span>
                      </td>
                      <td>
                        <TimestampDisplay timestamp={
                          fixture.status === 'approved' ? (fixture.approvedAt || fixture.createdAt) : fixture.createdAt
                        } />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {fixture.status === 'draft' ? (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove(fixture)}
                                disabled={approveMutation.isPending && approveMutation.variables?.id === fixture.id}
                              >
                                {approveMutation.isPending && approveMutation.variables?.id === fixture.id ? (
                                  <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                  'Approve'
                                )}
                              </button>
                              <button
                                className="btn btn-error btn-sm"
                                onClick={() => handleReject(fixture)}
                                disabled={rejectMutation.isPending && rejectMutation.variables?.id === fixture.id}
                              >
                                {rejectMutation.isPending && rejectMutation.variables?.id === fixture.id ? (
                                  <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                  'Reject'
                                )}
                              </button>
                            </>
                          ) : fixture.status === 'approved' ? (
                            <button
                              className="btn btn-error btn-sm"
                              onClick={() => handleRevoke(fixture)}
                              disabled={revokeMutation.isPending && revokeMutation.variables?.id === fixture.id}
                            >
                              {revokeMutation.isPending && revokeMutation.variables?.id === fixture.id ? (
                                <span className="loading loading-spinner loading-xs"></span>
                              ) : (
                                'Reject'
                              )}
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(fixture)}
                              disabled={approveMutation.isPending && approveMutation.variables?.id === fixture.id}
                            >
                              {approveMutation.isPending && approveMutation.variables?.id === fixture.id ? (
                                <span className="loading loading-spinner loading-xs"></span>
                              ) : (
                                'Approve'
                              )}
                            </button>
                          )}
                          <Link to={`/fixtures/${fixture.id}`} className="btn btn-ghost btn-sm">View</Link>
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

export default Fixtures