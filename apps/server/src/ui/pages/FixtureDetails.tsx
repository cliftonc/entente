import type { HTTPRequest, HTTPResponse } from '@entente/types'
import { Link, useParams } from 'react-router-dom'
import CodeBlock from '../components/CodeBlock'
import TimestampDisplay from '../components/TimestampDisplay'
import { useAuth } from '../hooks/useAuth'
import {
  useApproveFixture,
  useFixture,
  useRejectFixture,
  useRevokeFixture,
} from '../hooks/useFixtures'

function FixtureDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const { data: fixture, isLoading, error } = useFixture(id || '')

  // Mutation hooks with optimistic updates
  const approveMutation = useApproveFixture()
  const rejectMutation = useRejectFixture()
  const revokeMutation = useRevokeFixture()

  const handleApprove = () => {
    if (!id) return
    approveMutation.mutate({
      id,
      approvedBy: user?.username || 'unknown',
    })
  }

  const handleReject = () => {
    if (!id) return
    if (window.confirm('Are you sure you want to reject this fixture?')) {
      rejectMutation.mutate({
        id,
        rejectedBy: user?.username || 'unknown',
      })
    }
  }

  const handleRevoke = () => {
    if (!id) return
    if (window.confirm('Are you sure you want to reject this approved fixture?')) {
      revokeMutation.mutate({
        id,
        revokedBy: user?.username || 'unknown',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/fixtures">Fixtures</Link>
            </li>
            <li>Loading...</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixture Details</h1>
          <p className="text-base-content/70 mt-1">Loading fixture details...</p>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="skeleton h-4 w-full mb-2" />
            <div className="skeleton h-4 w-3/4 mb-2" />
            <div className="skeleton h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/fixtures">Fixtures</Link>
            </li>
            <li>Error</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixture Details</h1>
          <p className="text-base-content/70 mt-1">Error loading fixture details</p>
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
          <span>Failed to load fixture details</span>
        </div>
      </div>
    )
  }

  if (!fixture) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/fixtures">Fixtures</Link>
            </li>
            <li>Not Found</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixture Details</h1>
          <p className="text-base-content/70 mt-1">Fixture not found</p>
        </div>

        <div className="alert alert-warning">
          <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span>The requested fixture could not be found.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="breadcrumbs text-sm">
        <ul>
          <li>
            <Link to="/fixtures">Fixtures</Link>
          </li>
          <li>
            <Link to={`/services/provider/${fixture.service}`} className="link link-primary">
              {fixture.service}
            </Link>{' '}
            • {fixture.operation}
          </li>
        </ul>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Fixture Details</h1>
          <p className="text-base-content/70 mt-1">Detailed view of test fixture</p>
        </div>
        <div className="flex gap-2">
          {fixture.status === 'draft' ? (
            <>
              <button
                className="btn btn-success"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm mr-2" />
                ) : (
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                Approve
              </button>
              <button
                className="btn btn-error"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm mr-2" />
                ) : (
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                Reject
              </button>
            </>
          ) : fixture.status === 'approved' ? (
            <button
              className="btn btn-error"
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <span className="loading loading-spinner loading-sm mr-2" />
              ) : (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              Reject
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
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
              Approve
            </button>
          )}
        </div>
      </div>

      {/* Overview Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <strong>Service:</strong>{' '}
                <Link to={`/services/provider/${fixture.service}`} className="link link-primary">
                  {fixture.service}
                </Link>
              </div>
              <div>
                <strong>Service Versions:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {fixture.serviceVersions && fixture.serviceVersions.length > 0 ? (
                    fixture.serviceVersions.map((version, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 border border-gray-300 rounded-md"
                      >
                        v{version}
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 border border-gray-300 rounded-md">
                      v{fixture.serviceVersion}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <strong>Operation:</strong>
                <code className="bg-base-200 px-2 py-1 rounded text-sm ml-2">
                  {fixture.operation}
                </code>
              </div>
              <div>
                <strong>Priority:</strong> {fixture.priority}
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <strong>Status:</strong>
                <span
                  className={`badge ml-2 ${
                    fixture.status === 'draft'
                      ? 'badge-warning'
                      : fixture.status === 'approved'
                        ? 'badge-success'
                        : fixture.status === 'rejected'
                          ? 'badge-error'
                          : 'badge-info'
                  }`}
                >
                  {fixture.status}
                </span>
              </div>
              <div>
                <strong>Source:</strong>
                <span
                  className={`badge ml-2 ${
                    fixture.source === 'consumer' ? 'badge-primary' : 'badge-secondary'
                  }`}
                >
                  {fixture.source}
                </span>
              </div>
              <div>
                <strong>Created:</strong> <TimestampDisplay timestamp={fixture.createdAt} />
              </div>
              {fixture.approvedAt && fixture.approvedBy && (
                <div>
                  <strong>Approved:</strong> <TimestampDisplay timestamp={fixture.approvedAt} /> by{' '}
                  {fixture.approvedBy}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Creation Context */}
      {fixture.createdFrom && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Creation Context</h2>
            <div className="bg-base-200 p-1 rounded">
              <CodeBlock
                code={JSON.stringify(fixture.createdFrom, null, 2)}
                language="json"
                showLineNumbers={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fixture Data - Two Column Layout */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">HTTP Request & Response</h2>
          {(() => {
            const request = fixture.data.request as HTTPRequest | undefined
            const response = fixture.data.response as HTTPResponse | undefined

            if (!request && !response) {
              return (
                <div>
                  <h3 className="font-semibold text-lg mb-4">Raw Data</h3>
                  <div className="bg-base-200 p-1 rounded">
                    <CodeBlock
                      code={JSON.stringify(fixture.data, null, 2)}
                      language="json"
                      showLineNumbers={false}
                    />
                  </div>
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Request Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-primary border-b border-primary/20 pb-2">
                    📤 Request
                  </h3>
                  {request ? (
                    <div className="space-y-3">
                      {request.method && request.path && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">
                            Method & Path
                          </h4>
                          <div className="bg-base-200 p-3 rounded font-mono text-sm">
                            <span className="badge badge-primary badge-sm mr-2">
                              {request.method}
                            </span>
                            {request.path}
                          </div>
                        </div>
                      )}

                      {request.headers && Object.keys(request.headers).length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">Headers</h4>
                          <div className="bg-base-200 p-1 rounded">
                            <CodeBlock
                              code={JSON.stringify(request.headers, null, 2)}
                              language="json"
                              showLineNumbers={false}
                            />
                          </div>
                        </div>
                      )}

                      {request.query && Object.keys(request.query).length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">
                            Query Parameters
                          </h4>
                          <div className="bg-base-200 p-1 rounded">
                            <CodeBlock
                              code={JSON.stringify(request.query, null, 2)}
                              language="json"
                              showLineNumbers={false}
                            />
                          </div>
                        </div>
                      )}

                      {request.body !== undefined && request.body !== null && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">Body</h4>
                          <div className="bg-base-200 p-1 rounded">
                            <CodeBlock
                              code={
                                typeof request.body === 'string'
                                  ? request.body
                                  : JSON.stringify(request.body, null, 2)
                              }
                              language="json"
                              showLineNumbers={false}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-base-content/50 italic text-sm">
                      No request data available
                    </div>
                  )}
                </div>

                {/* Response Column */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-secondary border-b border-secondary/20 pb-2">
                    📥 Response
                  </h3>
                  {response ? (
                    <div className="space-y-3">
                      {response.status && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">Status</h4>
                          <div className="bg-base-200 p-3 rounded">
                            <span
                              className={`badge badge-lg ${
                                response.status >= 200 && response.status < 300
                                  ? 'badge-success'
                                  : response.status >= 400
                                    ? 'badge-error'
                                    : 'badge-warning'
                              }`}
                            >
                              {response.status}
                            </span>
                          </div>
                        </div>
                      )}

                      {response.headers && Object.keys(response.headers).length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">Headers</h4>
                          <div className="bg-base-200 p-1 rounded">
                            <CodeBlock
                              code={JSON.stringify(response.headers, null, 2)}
                              language="json"
                              showLineNumbers={false}
                            />
                          </div>
                        </div>
                      )}

                      {response.body !== undefined && response.body !== null && (
                        <div>
                          <h4 className="font-medium text-sm text-base-content/70 mb-2">Body</h4>
                          <div className="bg-base-200 p-1 rounded">
                            <CodeBlock
                              code={
                                typeof response.body === 'string'
                                  ? response.body
                                  : JSON.stringify(response.body, null, 2)
                              }
                              language="json"
                              showLineNumbers={false}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-base-content/50 italic text-sm">
                      No response data available
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Notes */}
      {fixture.notes && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Notes</h2>
            <div className="bg-base-200 p-3 rounded">
              <p className="text-sm">{fixture.notes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FixtureDetails
