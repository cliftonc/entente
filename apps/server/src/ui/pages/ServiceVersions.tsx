import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SpecBadge from '../components/SpecBadge'
import TimestampDisplay from '../components/TimestampDisplay'
import VersionBadge from '../components/VersionBadge'
import { serviceApi, serviceVersionApi } from '../utils/api'

function ServiceVersions() {
  const { serviceName } = useParams<{ serviceName: string }>()
  const [searchParams] = useSearchParams()
  const serviceType = searchParams.get('type') as 'consumer' | 'provider' | null

  const {
    data: service,
    isLoading: serviceLoading,
    error: serviceError,
  } = useQuery({
    queryKey: ['service', serviceName, serviceType],
    queryFn: () => {
      if (!serviceName || !serviceType) throw new Error('Service name and type are required')
      return serviceApi.getOne(serviceName, serviceType)
    },
    enabled: !!serviceName && !!serviceType,
  })

  const {
    data: versions,
    isLoading: versionsLoading,
    error: versionsError,
  } = useQuery({
    queryKey: ['service-versions', serviceName],
    queryFn: () => {
      if (!serviceName) throw new Error('Service name is required')
      return serviceVersionApi.getByService(serviceName)
    },
    enabled: !!serviceName,
  })

  if (serviceLoading || versionsLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="skeleton h-6 w-32 mb-4" />
            <div className="skeleton h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (serviceError || versionsError || !service) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Error loading service versions</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/services/${serviceType}/${serviceName}`} className="btn btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to {serviceName}
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
            {serviceName} Versions
            <div
              className={`badge ${
                serviceType === 'consumer' ? 'badge-primary' : 'badge-secondary'
              }`}
            >
              {serviceType}
            </div>
          </h1>
          <p className="text-base-content/70 mt-1">All versions for this service</p>
        </div>
      </div>

      {/* Versions Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Service Versions ({versions?.length || 0})</h2>
          </div>

          {versions && versions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Git SHA</th>
                    <th>Spec Type</th>
                    <th>API Spec</th>
                    <th>Package Info</th>
                    <th>Created By</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map(version => (
                    <tr key={version.id}>
                      <td>
                        <VersionBadge
                          version={version.version}
                          serviceName={version.serviceName}
                          serviceType={version.serviceType}
                          serviceVersionId={version.id}
                        />
                      </td>
                      <td>
                        {version.gitSha ? (
                          <code className="text-xs bg-base-200 px-2 py-1 rounded">
                            {version.gitSha.substring(0, 8)}
                          </code>
                        ) : (
                          <span className="text-base-content/50">-</span>
                        )}
                      </td>
                      <td>
                        <SpecBadge specType={version.specType || 'openapi'} size="sm" />
                      </td>
                      <td>
                        <div
                          className={`badge badge-sm ${
                            version.spec ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {version.spec ? 'available' : 'missing'}
                        </div>
                      </td>
                      <td>
                        <div
                          className={`badge badge-sm ${
                            version.packageJson ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {version.packageJson ? 'available' : 'missing'}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm">{version.createdBy}</span>
                      </td>
                      <td>
                        <TimestampDisplay timestamp={version.createdAt} />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link
                            to={`/service-versions/${version.id}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View Details
                          </Link>
                          {version.spec && (
                            <Link
                              to={`/specs/${serviceName}?version=${version.version}`}
                              className="btn btn-ghost btn-xs"
                            >
                              View Spec
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/70">
              <svg
                className="w-12 h-12 mx-auto mb-4 text-base-content/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="text-lg font-medium mb-2">No versions found</div>
              <div className="text-sm">
                Versions will appear here when you publish or deploy this service
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Service Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Service Information</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Name:</span> {service.name}
              </div>
              <div>
                <span className="font-medium">Type:</span>{' '}
                <span
                  className={`badge badge-sm ${
                    service.type === 'consumer' ? 'badge-primary' : 'badge-secondary'
                  }`}
                >
                  {service.type}
                </span>
              </div>
              <div>
                <span className="font-medium">Description:</span>{' '}
                {service.description || 'No description available'}
              </div>
              <div>
                <span className="font-medium">Created:</span>{' '}
                <TimestampDisplay timestamp={service.createdAt} />
              </div>
              <div>
                <span className="font-medium">Last Updated:</span>{' '}
                <TimestampDisplay timestamp={service.updatedAt} />
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Version Statistics</h3>
            <div className="stats stats-vertical">
              <div className="stat">
                <div className="stat-title">Total Versions</div>
                <div className="stat-value text-2xl">{versions?.length || 0}</div>
              </div>
              <div className="stat">
                <div className="stat-title">With OpenAPI Spec</div>
                <div className="stat-value text-2xl">
                  {versions?.filter(v => v.spec).length || 0}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">With Package Info</div>
                <div className="stat-value text-2xl">
                  {versions?.filter(v => v.packageJson).length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceVersions
