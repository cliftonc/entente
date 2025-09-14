import type { VerificationErrorDetails } from '@entente/types'

interface ErrorDetailsProps {
  errorDetails?: VerificationErrorDetails
  fallbackError?: string
}

export default function ErrorDetails({ errorDetails, fallbackError }: ErrorDetailsProps) {
  if (!errorDetails && !fallbackError) {
    return null
  }

  // If we have structured error details, render them nicely
  if (errorDetails) {
    return (
      <div className="bg-base-200 border border-base-300 p-3 rounded mt-2">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <span>Error Details:</span>
          <span
            className={`badge badge-xs ${
              errorDetails.type === 'status_mismatch'
                ? 'badge-warning'
                : errorDetails.type === 'structure_mismatch'
                  ? 'badge-error'
                  : errorDetails.type === 'content_mismatch'
                    ? 'badge-info'
                    : 'badge-neutral'
            }`}
          >
            {errorDetails.type.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium">Message: </span>
            <span className="text-xs">{errorDetails.message}</span>
          </div>

          {errorDetails.field && (
            <div>
              <span className="text-xs font-medium">Field: </span>
              <span className="text-xs font-mono bg-base-200 px-1 rounded">
                {errorDetails.field}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {errorDetails.expected !== undefined && (
              <div>
                <div className="text-xs font-medium mb-1">Expected:</div>
                <div className="bg-base-200 border border-base-300 rounded p-2">
                  <pre className="text-xs overflow-x-auto">
                    {typeof errorDetails.expected === 'string'
                      ? errorDetails.expected
                      : JSON.stringify(errorDetails.expected, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {errorDetails.actual !== undefined && (
              <div>
                <div className="text-xs font-medium mb-1">Actual:</div>
                <div className="bg-base-200 border border-base-300 rounded p-2">
                  <pre className="text-xs overflow-x-auto">
                    {typeof errorDetails.actual === 'string'
                      ? errorDetails.actual
                      : JSON.stringify(errorDetails.actual, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fall back to the plain error string
  return (
    <div className="bg-base-300/20 p-2 rounded mt-2">
      <div className="text-xs font-semibold mb-1">Error Details:</div>
      <pre className="text-xs overflow-x-auto">{fallbackError}</pre>
    </div>
  )
}
