import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../utils/api'

interface GraphQLPlaygroundProps {
  serviceName?: string
  version?: string
}

export function GraphQLPlayground({ serviceName, version }: GraphQLPlaygroundProps) {
  const params = useParams()
  const navigate = useNavigate()

  const actualServiceName = serviceName || params.serviceName
  const actualVersion = version || params.version

  const [query, setQuery] = useState(`# Welcome to GraphQL Playground
#
# Type your GraphQL queries here and press Ctrl+Enter to execute
#
# Example query:
query GetCastles {
  listCastles {
    id
    name
    region
    yearBuilt
  }
}`)

  const [variables, setVariables] = useState('{}')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch GraphQL schema for introspection
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['graphql-schema', actualServiceName, actualVersion],
    queryFn: async () => {
      if (!actualServiceName || !actualVersion) return null

      const response = await api.get<any>(`/specs/${actualServiceName}?version=${actualVersion}`)

      // Check if this is a GraphQL spec
      if (response?.specType === 'graphql') {
        return response // Return the full response, not just the spec
      }

      throw new Error('Service does not have a GraphQL specification')
    },
    enabled: !!actualServiceName && !!actualVersion,
  })

  const executeQuery = async () => {
    if (!actualServiceName || !actualVersion) {
      setError('Service name and version are required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let parsedVariables = {}
      if (variables.trim()) {
        parsedVariables = JSON.parse(variables)
      }

      // Use the GraphQL mock endpoint
      const graphqlEndpoint = `/mock/service/${actualServiceName}/graphql`

      const mockResponse = await api.post<any>(graphqlEndpoint, {
        query,
        variables: parsedVariables,
      })

      setResponse(mockResponse)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  if (!actualServiceName || !actualVersion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-warning">
          <div className="flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>Please select a service and version to use the GraphQL playground</span>
          </div>
        </div>
      </div>
    )
  }

  if (schemaLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
          <span className="ml-2">Loading GraphQL schema...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GraphQL Playground</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Interactive GraphQL query explorer for {actualServiceName}@{actualVersion}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/services/${actualServiceName}/versions`)}
            className="btn btn-ghost btn-sm"
          >
            Back to Service
          </button>
          <button onClick={executeQuery} disabled={loading} className="btn btn-primary btn-sm">
            {loading ? (
              <>
                <span className="loading loading-spinner loading-xs mr-1"></span>
                Executing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z"
                  />
                </svg>
                Execute (Ctrl+Enter)
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
        {/* Query Input Panel */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-header px-4 py-3 bg-base-200">
            <h3 className="card-title text-sm font-medium">Query</h3>
          </div>
          <div className="card-body p-0 flex-1">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your GraphQL query here..."
              className="textarea textarea-ghost w-full h-full resize-none font-mono text-sm border-0 focus:outline-0 rounded-none"
              style={{ minHeight: '300px' }}
            />
          </div>

          {/* Variables Panel */}
          <div className="border-t border-base-300">
            <div className="px-4 py-2 bg-base-200 border-b border-base-300">
              <span className="text-sm font-medium">Variables (JSON)</span>
            </div>
            <textarea
              value={variables}
              onChange={e => setVariables(e.target.value)}
              placeholder='{"id": "123"}'
              className="textarea textarea-ghost w-full resize-none font-mono text-sm border-0 focus:outline-0 rounded-none"
              rows={4}
            />
          </div>
        </div>

        {/* Response Panel */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-header px-4 py-3 bg-base-200">
            <h3 className="card-title text-sm font-medium">Response</h3>
          </div>
          <div className="card-body p-4 flex-1">
            {error ? (
              <div className="alert alert-error">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <div className="font-bold">Error</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            ) : response ? (
              <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-sm font-mono h-full">
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 mx-auto mb-2 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <p>Execute a query to see the response</p>
                  <p className="text-xs mt-1">Press Ctrl+Enter or click Execute</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schema Documentation Panel (Collapsible) */}
      {schema && (
        <div className="mt-6">
          <div className="collapse collapse-arrow bg-base-100 shadow-lg">
            <input type="checkbox" />
            <div className="collapse-title text-lg font-medium">Schema Documentation</div>
            <div className="collapse-content">
              <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-sm font-mono max-h-96 whitespace-pre-wrap">
                {typeof schema.spec === 'string' ? schema.spec : JSON.stringify(schema, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphQLPlayground
