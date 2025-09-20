import { isGraphQLRequest, isHTTPRequest } from '@entente/fixtures'
import type { SpecType, UnifiedRequest } from '@entente/types'

// Pure function to detect request type from request properties
export const detectRequestType = (request: UnifiedRequest): SpecType | null => {
  // AsyncAPI detection (moved up in priority)
  if (isWebSocketUpgrade(request) || isSSERequest(request) || isAsyncAPIPath(request.path)) {
    return 'asyncapi'
  }

  // GraphQL detection
  if (isGraphQLRequestDetected(request)) {
    return 'graphql'
  }

  // gRPC detection (future)
  if (isGRPCRequest(request)) {
    return 'grpc'
  }

  // Default to OpenAPI for REST
  if (isHTTPRequest(request)) {
    return 'openapi'
  }

  return null
}

// Pure function to detect GraphQL requests
const isGraphQLRequestDetected = (request: UnifiedRequest): boolean => {
  // Check if path is /graphql or configured endpoint
  if (isGraphQLPath(request.path)) {
    return true
  }

  // Check if body contains GraphQL query
  if (isGraphQLRequest(request)) {
    return true
  }

  // Check Content-Type header
  if (isGraphQLContentType(request.headers)) {
    return true
  }

  return false
}

// Pure function to check GraphQL paths
const isGraphQLPath = (path?: string): boolean => {
  if (!path) return false

  return path === '/graphql' || path.endsWith('/graphql') || path.includes('graphql')
}

// Pure function to check GraphQL content type
const isGraphQLContentType = (headers?: Record<string, string>): boolean => {
  if (!headers) return false

  const contentType = headers['content-type'] || headers['Content-Type'] || ''
  return contentType.includes('application/graphql')
}

// Pure function to detect WebSocket upgrade requests
export const isWebSocketUpgrade = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const upgrade = request.headers['upgrade'] || request.headers['Upgrade']
  const connection = request.headers['connection'] || request.headers['Connection']

  return upgrade === 'websocket' || connection?.toLowerCase().includes('upgrade')
}

// Pure function to detect Server-Sent Events requests
export const isSSERequest = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const accept = request.headers['accept'] || request.headers['Accept'] || ''
  return accept.includes('text/event-stream')
}

// Pure function to detect AsyncAPI paths
export const isAsyncAPIPath = (path?: string): boolean => {
  if (!path) return false

  const asyncPaths = ['/ws', '/websocket', '/events', '/stream', '/sse']
  return asyncPaths.some(asyncPath => path.includes(asyncPath))
}

// Pure function to detect gRPC requests
const isGRPCRequest = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const contentType = request.headers['content-type'] || request.headers['Content-Type'] || ''
  return contentType === 'application/grpc'
}

// Higher-order function to create a request detector with custom rules
export const createRequestDetector = (customRules?: {
  graphqlPaths?: string[]
  asyncapiPaths?: string[]
  grpcContentTypes?: string[]
}) => {
  return (request: UnifiedRequest): SpecType | null => {
    // Apply custom rules if provided
    if (customRules?.graphqlPaths?.some(path => request.path === path)) {
      return 'graphql'
    }

    if (customRules?.asyncapiPaths?.some(path => request.path === path)) {
      return 'asyncapi'
    }

    if (
      customRules?.grpcContentTypes?.some(type =>
        (request.headers?.['content-type'] || request.headers?.['Content-Type'] || '').includes(
          type
        )
      )
    ) {
      return 'grpc'
    }

    // Fall back to default detection
    return detectRequestType(request)
  }
}

// Export pre-configured detector for common use cases
export const defaultRequestDetector = createRequestDetector()
