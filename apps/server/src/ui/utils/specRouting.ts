import type { SpecType } from '@entente/types'

export interface SpecRouteParams {
  serviceName: string
  serviceId?: string
  version?: string
  versionId?: string
}

/**
 * Get the appropriate route for viewing a spec based on its type
 */
export function getSpecViewerRoute(
  specType: SpecType | string | null | undefined,
  params: SpecRouteParams
): string {
  const normalizedSpecType = specType || 'openapi'

  switch (normalizedSpecType) {
    case 'graphql':
      // GraphQL playground requires serviceName and version
      if (params.serviceName && params.version) {
        return `/graphql/service/${params.serviceName}/${params.version}`
      }
      // Fallback to latest if we don't have specific version
      if (params.serviceName) {
        return `/graphql/service/${params.serviceName}/latest`
      }
      // Fallback to OpenAPI if we don't have serviceName
      return `/openapi/service/${params.serviceName}?version=${params.versionId || 'latest'}`

    case 'asyncapi':
      // AsyncAPI viewer (if implemented)
      return `/asyncapi/service/${params.serviceName}?version=${params.versionId || 'latest'}`

    case 'grpc':
      // gRPC viewer (if implemented)
      return `/grpc/service/${params.serviceName}?version=${params.versionId || 'latest'}`

    case 'soap':
      // SOAP viewer (if implemented)
      return `/soap/service/${params.serviceName}?version=${params.versionId || 'latest'}`

    case 'openapi':
    default:
      // OpenAPI viewer
      return `/openapi/service/${params.serviceName}?version=${params.versionId || 'latest'}`
  }
}

/**
 * Get the button text for viewing a spec
 */
export function getSpecViewerButtonText(specType: SpecType | string | null | undefined): string {
  const normalizedSpecType = specType || 'openapi'

  switch (normalizedSpecType) {
    case 'graphql':
      return 'Open Playground'
    case 'asyncapi':
      return 'View AsyncAPI'
    case 'grpc':
      return 'View gRPC'
    case 'soap':
      return 'View SOAP'
    case 'openapi':
    default:
      return 'View OpenAPI'
  }
}
