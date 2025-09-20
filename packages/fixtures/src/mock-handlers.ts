import type {
  APIOperation,
  APISpec,
  Fixture,
  SpecHandler,
  UnifiedRequest,
  UnifiedResponse,
} from '@entente/types'
import { specRegistry } from './spec-handlers/index.js'

export interface MockHandler {
  match: (request: UnifiedRequest) => boolean
  respond: (request: UnifiedRequest) => UnifiedResponse
}

// Pure function to create mock handlers from spec and fixtures
export const createUnifiedMockHandler = (spec: APISpec, fixtures: Fixture[]): MockHandler[] => {
  const handler = specRegistry.getHandler(spec.type)
  if (!handler) {
    throw new Error(`No handler found for spec type: ${spec.type}`)
  }

  const operations = handler.extractOperations(spec)
  return createMockHandlersFromOperations(handler, operations, fixtures)
}

// Pure function to create mock handlers from operations
const createMockHandlersFromOperations = (
  handler: SpecHandler,
  operations: APIOperation[],
  fixtures: Fixture[]
): MockHandler[] => {
  return operations.map(operation => ({
    match: (request: UnifiedRequest) => {
      const matchResult = handler.matchOperation({
        request,
        operations: [operation],
        specType: handler.type
      })
      return matchResult.selected?.operation.id === operation.id
    },
    respond: (request: UnifiedRequest) => {
      const matchResult = handler.matchOperation({
        request,
        operations: [operation],
        specType: handler.type
      })
      if (!matchResult.selected) {
        return {
          status: 404,
          headers: { 'content-type': 'application/json' },
          body: { error: 'Not Found', message: 'No matching operation found' },
          success: false,
        }
      }

      return handler.generateResponse({
        operation,
        fixtures,
        request,
        match: matchResult.selected,
      })
    },
  }))
}

// Pure function to handle unified mock request
export const handleUnifiedMockRequest = (
  request: UnifiedRequest,
  handlers: MockHandler[]
): UnifiedResponse => {
  const handler = findMatchingHandler(request, handlers)

  if (handler) {
    return handler.respond(request)
  }

  // No handler matched - return 404
  return createNotFoundResponse()
}

// Pure function to find matching handler
const findMatchingHandler = (
  request: UnifiedRequest,
  handlers: MockHandler[]
): MockHandler | null => {
  return handlers.find(handler => handler.match(request)) || null
}

// Pure function to create 404 response
const createNotFoundResponse = (): UnifiedResponse => ({
  status: 404,
  headers: { 'content-type': 'application/json' },
  body: {
    error: 'Not Found',
    message: 'No matching operation found for request',
  },
  success: false,
})

// Legacy compatibility functions (pure)
export const convertHTTPToUnified = (
  method: string,
  path: string,
  headers: Record<string, string>,
  query: Record<string, unknown>,
  body: unknown
): UnifiedRequest => ({
  method,
  path,
  headers,
  query,
  body,
})

export const convertUnifiedToHTTP = (
  response: UnifiedResponse
): {
  status: number
  headers: Record<string, string>
  body: unknown
} => ({
  status: response.status || 200,
  headers: response.headers || {},
  body: response.body,
})
