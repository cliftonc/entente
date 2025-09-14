import type { VerificationResult } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorDetails from '../components/ErrorDetails'
import TimestampDisplay from '../components/TimestampDisplay'
import { verificationApi } from '../utils/api'

function VerificationDetail() {
  const { id } = useParams<{ id: string }>()
  const [selectedResult, setSelectedResult] = useState<VerificationResult | null>(null)
  const [showModal, setShowModal] = useState(false)

  const {
    data: verification,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['verification', id],
    queryFn: () => {
      if (!id) throw new Error('Verification ID is required')
      return verificationApi.getById(id)
    },
    enabled: !!id,
  })

  const openModal = (result: VerificationResult) => {
    setSelectedResult(result)
    setShowModal(true)
  }

  const closeModal = () => {
    setSelectedResult(null)
    setShowModal(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/verification">Verification</Link>
            </li>
            <li>Loading...</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Verification Details</h1>
          <p className="text-base-content/70 mt-1">Loading verification details...</p>
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
              <Link to="/verification">Verification</Link>
            </li>
            <li>Error</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Verification Details</h1>
          <p className="text-base-content/70 mt-1">Error loading verification details</p>
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
          <span>Failed to load verification details</span>
        </div>
      </div>
    )
  }

  if (!verification) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/verification">Verification</Link>
            </li>
            <li>Not Found</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Verification Details</h1>
          <p className="text-base-content/70 mt-1">Verification not found</p>
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
          <span>The requested verification could not be found.</span>
        </div>
      </div>
    )
  }

  const passRate =
    verification.total > 0 ? Math.round((verification.passed / verification.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="breadcrumbs text-sm">
        <ul>
          <li>
            <Link to="/verification">Verification</Link>
          </li>
          <li>
            {verification.provider} v{verification.providerVersion}
          </li>
        </ul>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-base-content">Verification Details</h1>
        <p className="text-base-content/70 mt-1">Detailed view of provider verification results</p>
      </div>

      {/* Overview Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <strong>Provider:</strong> {verification.provider}
              </div>
              <div>
                <strong>Provider Version:</strong> v{verification.providerVersion}
              </div>
              <div>
                <strong>Consumer:</strong> {verification.consumer || 'N/A'}
              </div>
              <div>
                <strong>Consumer Version:</strong> {verification.consumerVersion || 'N/A'}
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <strong>Task ID:</strong>{' '}
                <span className="font-mono text-sm">{verification.taskId}</span>
              </div>
              <div>
                <strong>Status:</strong>
                <span
                  className={`badge ml-2 ${
                    verification.status === 'passed'
                      ? 'badge-success'
                      : verification.status === 'failed'
                        ? 'badge-error'
                        : 'badge-warning'
                  }`}
                >
                  {verification.status}
                </span>
              </div>
              <div>
                <strong>Submitted:</strong>{' '}
                <TimestampDisplay timestamp={verification.submittedAt} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Pass Rate</div>
            <div
              className={`stat-value ${passRate >= 95 ? 'text-success' : passRate >= 80 ? 'text-warning' : 'text-error'}`}
            >
              {passRate}%
            </div>
            <div className="stat-desc">
              {verification.passed}/{verification.total} tests passed
            </div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total Tests</div>
            <div className="stat-value">{verification.total}</div>
            <div className="stat-desc">interactions verified</div>
          </div>
        </div>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Failed Tests</div>
            <div className="stat-value text-error">{verification.failed}</div>
            <div className="stat-desc">require attention</div>
          </div>
        </div>
      </div>

      {/* Test Results Details */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test Results</h2>
          {verification.results && verification.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Test #</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Operation</th>
                    <th>Response Status</th>
                    <th>Status</th>
                    <th>Response Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verification.results.map((result, index) => (
                    <tr key={result.interactionId || `result-${index}`}>
                      <td>#{index + 1}</td>
                      <td>
                        <span className="badge badge-outline">
                          {result.interaction?.method || 'N/A'}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{result.interaction?.path || 'N/A'}</td>
                      <td className="text-sm">{result.interaction?.operation || 'N/A'}</td>
                      <td>
                        <span
                          className={`badge ${
                            result.actualResponse?.status >= 200 &&
                            result.actualResponse?.status < 300
                              ? 'badge-success'
                              : result.actualResponse?.status >= 500
                                ? 'badge-error'
                                : 'badge-warning'
                          }`}
                        >
                          {result.actualResponse?.status || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${result.success ? 'badge-success' : 'badge-error'}`}
                        >
                          {result.success ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="text-sm">
                        {result.actualResponse?.headers?.['content-length'] || 'Unknown'} bytes
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => openModal(result)}>
                          View JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-base-content/70 py-8">
              No detailed test results available
            </div>
          )}
        </div>
      </div>

      {/* Error Details (if any failures) */}
      {verification.failed > 0 && verification.results && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Failed Tests Details</h2>
            <div className="space-y-4">
              {verification.results
                .filter(result => !result.success)
                .map((result, index) => (
                  <div
                    key={result.interactionId || `failed-${index}`}
                    className="card bg-base-100 shadow border border-error/20"
                  >
                    <div className="card-body">
                      <div className="font-semibold">
                        {result.interaction?.method || 'Unknown'}{' '}
                        {result.interaction?.path || 'Unknown'}
                      </div>
                      <div className="text-sm mt-1">
                        Operation: {result.interaction?.operation || 'N/A'} • Response Status:{' '}
                        {result.actualResponse?.status || 'Unknown'} • Service:{' '}
                        {result.interaction?.service || 'N/A'}
                      </div>
                      {result.actualResponse?.body && (
                        <div className="bg-base-300/20 p-2 rounded mt-2">
                          <div className="text-xs font-semibold mb-1">Response Body:</div>
                          <pre className="text-xs overflow-x-auto">
                            {typeof result.actualResponse.body === 'string'
                              ? result.actualResponse.body
                              : JSON.stringify(result.actualResponse.body, null, 2)}
                          </pre>
                        </div>
                      )}
                      <ErrorDetails
                        errorDetails={result.errorDetails}
                        fallbackError={result.error}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Modal */}
      {showModal && selectedResult && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Raw Test Result JSON</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Test Information Header */}
              <div className="bg-base-200 p-3 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Method:</strong> {selectedResult.interaction?.method || 'N/A'}
                  </div>
                  <div>
                    <strong>Path:</strong> {selectedResult.interaction?.path || 'N/A'}
                  </div>
                  <div>
                    <strong>Operation:</strong> {selectedResult.interaction?.operation || 'N/A'}
                  </div>
                  <div>
                    <strong>Success:</strong>
                    <span
                      className={`badge ml-2 ${selectedResult.success ? 'badge-success' : 'badge-error'}`}
                    >
                      {selectedResult.success ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Details (if failed) */}
              {!selectedResult.success && (
                <div>
                  <h4 className="font-semibold mb-2">Error Analysis:</h4>
                  <ErrorDetails
                    errorDetails={selectedResult.errorDetails}
                    fallbackError={selectedResult.error}
                  />
                </div>
              )}

              {/* Full JSON Data */}
              <div>
                <h4 className="font-semibold mb-2">Complete Test Result:</h4>
                <div className="bg-base-300 p-4 rounded max-h-96 overflow-auto">
                  <pre className="text-xs">{JSON.stringify(selectedResult, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeModal} />
        </div>
      )}
    </div>
  )
}

export default VerificationDetail
