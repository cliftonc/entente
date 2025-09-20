import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import CodeBlock from '../components/CodeBlock'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VersionBadge from '../components/VersionBadge'
import { contractApi, interactionApi } from '../utils/api'

function InteractionDetails() {
  const { id } = useParams<{ id: string }>()

  const {
    data: interaction,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['interaction', id],
    queryFn: () => {
      if (!id) throw new Error('Interaction ID is required')
      return interactionApi.getById(id)
    },
    enabled: !!id,
  })

  // Fetch contract details if interaction has contractId
  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ['contract', interaction?.contractId],
    queryFn: () => contractApi.getById(interaction!.contractId!),
    enabled: !!interaction?.contractId,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/contracts">Contracts</Link>
            </li>
            <li>Loading...</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Interaction Details</h1>
          <p className="text-base-content/70 mt-1">Loading interaction details...</p>
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
              <Link to="/contracts">Contracts</Link>
            </li>
            <li>Error</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Interaction Details</h1>
          <p className="text-base-content/70 mt-1">Error loading interaction details</p>
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
          <span>Failed to load interaction details</span>
        </div>
      </div>
    )
  }

  if (!interaction) {
    return (
      <div className="space-y-6">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/contracts">Contracts</Link>
            </li>
            <li>Not Found</li>
          </ul>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-base-content">Interaction Details</h1>
          <p className="text-base-content/70 mt-1">Interaction not found</p>
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
          <span>The requested interaction could not be found.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="breadcrumbs text-sm">
        <ul>
          <li>
            <Link to="/contracts">Contracts</Link>
          </li>
          {contract ? (
            <>
              <li>
                <Link to={`/contracts/${contract.id}`}>
                  {contract.consumerName} → {contract.providerName}
                </Link>
              </li>
              <li>Interaction</li>
            </>
          ) : (
            <li>
              {interaction.consumer} → {interaction.service}
            </li>
          )}
        </ul>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-base-content">Interaction Details</h1>
        <p className="text-base-content/70 mt-1">Detailed view of consumer-provider interaction</p>
      </div>

      {/* Overview Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <strong>Service:</strong>{' '}
                <Link
                  to={`/services/provider/${interaction.service}`}
                  className="font-medium hover:underline text-primary"
                >
                  {interaction.service}
                </Link>
              </div>
              <div>
                <strong>Consumer:</strong>{' '}
                <Link
                  to={`/services/consumer/${interaction.consumer}`}
                  className="font-medium hover:underline text-primary"
                >
                  {interaction.consumer}
                </Link>
              </div>
              <div>
                <strong>Consumer Version:</strong>{' '}
                <VersionBadge
                  version={interaction.consumerVersion}
                  serviceName={interaction.consumer}
                  serviceType="consumer"
                />
              </div>
              <div>
                <strong>Spec Type:</strong>
                <div className="mt-1">
                  <SpecBadge specType={interaction?.specType || 'openapi'} size="sm" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <strong>Operation:</strong> {interaction.operation}
              </div>
              <div>
                <strong>Environment:</strong> {interaction.environment}
              </div>
              <div>
                <strong>Status:</strong>
                <span
                  className={`badge ml-2 ${
                    interaction.response.status >= 200 && interaction.response.status < 300
                      ? 'badge-success'
                      : interaction.response.status >= 400
                        ? 'badge-error'
                        : 'badge-warning'
                  }`}
                >
                  {interaction.response.status}
                </span>
              </div>
              <div>
                <strong>Timestamp:</strong> <TimestampDisplay timestamp={interaction.timestamp} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request & Response - Two Column Layout */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">HTTP Request & Response</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-primary border-b border-primary/20 pb-2">
                📤 Request
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-base-content/70 mb-2">Method & Path</h4>
                  <div className="bg-base-200 p-3 rounded font-mono text-sm">
                    <span className="badge badge-primary badge-sm mr-2">
                      {interaction.request.method}
                    </span>
                    {interaction.request.path}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-base-content/70 mb-2">Headers</h4>
                  <div className="bg-base-200 p-1 rounded">
                    <CodeBlock
                      code={JSON.stringify(interaction.request.headers, null, 2)}
                      language="json"
                      showLineNumbers={false}
                    />
                  </div>
                </div>

                {interaction.request.query && Object.keys(interaction.request.query).length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-base-content/70 mb-2">
                      Query Parameters
                    </h4>
                    <div className="bg-base-200 p-1 rounded">
                      <CodeBlock
                        code={JSON.stringify(interaction.request.query, null, 2)}
                        language="json"
                        showLineNumbers={false}
                      />
                    </div>
                  </div>
                )}

                {interaction.request.body != null && (
                  <div>
                    <h4 className="font-medium text-sm text-base-content/70 mb-2">Body</h4>
                    <div className="bg-base-200 p-1 rounded">
                      <CodeBlock
                        code={
                          typeof interaction.request.body === 'string'
                            ? interaction.request.body
                            : JSON.stringify(interaction.request.body, null, 2) || ''
                        }
                        language={typeof interaction.request.body === 'string' ? 'json' : 'json'}
                        showLineNumbers={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Response Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-secondary border-b border-secondary/20 pb-2">
                📥 Response
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-base-content/70 mb-2">Status</h4>
                  <div className="bg-base-200 p-3 rounded">
                    <span
                      className={`badge badge-lg ${
                        interaction.response.status >= 200 && interaction.response.status < 300
                          ? 'badge-success'
                          : interaction.response.status >= 500
                            ? 'badge-error'
                            : interaction.response.status >= 300
                              ? 'badge-warning'
                              : 'badge-neutral'
                      }`}
                    >
                      {interaction.response.status}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-base-content/70 mb-2">Headers</h4>
                  <div className="bg-base-200 p-1 rounded">
                    <CodeBlock
                      code={JSON.stringify(interaction.response.headers, null, 2)}
                      language="json"
                      showLineNumbers={false}
                    />
                  </div>
                </div>

                {interaction.response.body != null && (
                  <div>
                    <h4 className="font-medium text-sm text-base-content/70 mb-2">Body</h4>
                    <div className="bg-base-200 p-1 rounded">
                      <CodeBlock
                        code={
                          typeof interaction.response.body === 'string'
                            ? interaction.response.body
                            : JSON.stringify(interaction.response.body, null, 2) || ''
                        }
                        language={typeof interaction.response.body === 'string' ? 'json' : 'json'}
                        showLineNumbers={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Info */}
      {interaction.clientInfo && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Client Information</h2>
            <div className="bg-base-200 p-1 rounded">
              <CodeBlock
                code={JSON.stringify(interaction.clientInfo, null, 2)}
                language="json"
                showLineNumbers={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InteractionDetails
