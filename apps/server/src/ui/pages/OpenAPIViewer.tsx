import 'swagger-ui-react/swagger-ui.css'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SwaggerUI from 'swagger-ui-react'
import { useServiceVersions } from '../hooks/useServices'
import { serviceVersionApi } from '../utils/api'

function OpenAPIViewer() {
  const navigate = useNavigate()
  const { serviceName } = useParams<{ serviceName: string }>()
  const [searchParams] = useSearchParams()
  const version = searchParams.get('version') || 'latest'
  const isLatestView = version === 'latest'

  // Fetch specific service version for version view (when version is a service version ID)
  const {
    data: serviceVersion,
    isLoading: serviceVersionLoading,
    error: serviceVersionError,
  } = useQuery({
    queryKey: ['service-version', version],
    queryFn: () => serviceVersionApi.getById(version),
    enabled: !isLatestView && !!version,
  })

  // Fetch service versions for latest view
  const {
    data: serviceVersions,
    isLoading: serviceVersionsLoading,
    error: serviceVersionsError,
  } = useServiceVersions(serviceName || '', { enabled: isLatestView && !!serviceName })

  // Find the latest version with a spec for latest view
  const latestVersionWithSpec = serviceVersions
    ?.filter(version => version.spec)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  const displayVersion = serviceVersion || latestVersionWithSpec
  const isLoading = serviceVersionLoading || serviceVersionsLoading
  const error = serviceVersionError || serviceVersionsError

  const handleBack = () => {
    if (!serviceName) {
      navigate(-1)
      return
    }

    if (isLatestView && displayVersion) {
      // For latest view, go back to the service page (provider or consumer)
      const serviceType = displayVersion.serviceType || 'provider'
      navigate(`/services/${serviceType}/${serviceName}`)
    } else if (!isLatestView) {
      // For specific version view, go back to the version detail page
      navigate(`/service-versions/${version}`)
    } else {
      // Fallback to browser back
      navigate(-1)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="btn btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <div className="skeleton h-8 w-64" />
        </div>
        <div className="skeleton h-96 w-full" />
      </div>
    )
  }

  if (error || !displayVersion || !displayVersion.spec) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="btn btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-base-content">OpenAPI Specification</h1>
        </div>
        <div className="alert alert-error">
          <span>
            {error
              ? 'Error loading OpenAPI specification'
              : 'No OpenAPI specification available for this service'}
          </span>
        </div>
      </div>
    )
  }

  const title = isLatestView
    ? `${displayVersion.serviceName} - Latest OpenAPI Spec`
    : `${displayVersion.serviceName} v${displayVersion.version} - OpenAPI Spec`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="btn btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-base-content">{title}</h1>
          <p className="text-base-content/70 mt-1">
            Interactive API documentation generated from OpenAPI specification
          </p>
        </div>
      </div>

      {/* OpenAPI Viewer */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-0">
          <div className="swagger-ui-container">
            <SwaggerUI
              spec={displayVersion.spec}
              deepLinking={true}
              displayOperationId={false}
              defaultModelsExpandDepth={1}
              defaultModelExpandDepth={1}
              defaultModelRendering="example"
              displayRequestDuration={true}
              docExpansion="list"
              filter={true}
              showExtensions={true}
              showCommonExtensions={true}
              tryItOutEnabled={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpenAPIViewer
