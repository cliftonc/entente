import type { OpenAPISpec } from '@entente/types'

export type MockServerUrlType = 'latest' | 'version' | 'both'

// Helper function to inject mock server URLs into OpenAPI specs
export function injectMockServerUrls(
  spec: OpenAPISpec,
  serviceName: string,
  urlType: MockServerUrlType = 'both',
  serviceVersionId?: string
): OpenAPISpec {
  const modifiedSpec = JSON.parse(JSON.stringify(spec))

  // Initialize servers array if it doesn't exist
  if (!modifiedSpec.servers) {
    modifiedSpec.servers = []
  }

  // Add mock server URLs based on type
  if (urlType === 'latest' || urlType === 'both') {
    const mockByService = {
      url: `/api/mock/service/${serviceName}`,
      description: 'Mock server with fixture data (latest version)',
    }
    modifiedSpec.servers.unshift(mockByService)
  }

  if ((urlType === 'version' || urlType === 'both') && serviceVersionId) {
    const mockByVersion = {
      url: `/api/mock/version/${serviceVersionId}`,
      description: 'Mock server with fixture data (specific version)',
    }
    modifiedSpec.servers.unshift(mockByVersion)
  }

  return modifiedSpec
}
