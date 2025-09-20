export * from './types.js'
export * from './registry.js'
export * from './openapi.js'
export * from './graphql.js'
export * from './asyncapi.js'

import { createAsyncAPIHandler } from './asyncapi.js'
import { createGraphQLHandler } from './graphql.js'
import { createOpenAPIHandler } from './openapi.js'
import { specRegistry } from './registry.js'

// Auto-register all handlers
specRegistry.register(createOpenAPIHandler())
specRegistry.register(createGraphQLHandler())
specRegistry.register(createAsyncAPIHandler())

// Export the singleton registry for convenience
export { specRegistry }
