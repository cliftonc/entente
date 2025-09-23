import type {
  EntityData,
  EntityRelationship,
  Fixture,
  FixtureProposal,
  FixtureUpdate,
  HTTPRequest,
  HTTPResponse,
  NormalizedFixtures,
  OpenAPISpec,
} from '@entente/types'
import { debugLog } from '@entente/types'
import { specRegistry } from './spec-handlers/index.js'

export interface FixtureManager {
  approve: (fixtureId: string, approver: string, notes?: string) => Promise<Fixture>
  update: (fixtureId: string, updates: FixtureUpdate) => Promise<Fixture>
  getPending: (service?: string) => Promise<Fixture[]>
  getByOperation: (
    service: string,
    version: string,
    operation: string,
    status?: string
  ) => Promise<Fixture[]>
  propose: (proposal: FixtureProposal) => Promise<Fixture>
  bulkApprove: (testRunId: string, approver: string) => Promise<number>
  deprecate: (fixtureId: string, reason?: string) => Promise<Fixture>
}

export const createFixtureManager = (serviceUrl: string, apiKey: string): FixtureManager => {
  const apiCall = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${serviceUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`Fixture API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  return {
    approve: async (fixtureId: string, approver: string, notes?: string): Promise<Fixture> => {
      return apiCall(`/api/fixtures/${fixtureId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy: approver, notes }),
      })
    },

    update: async (fixtureId: string, updates: FixtureUpdate): Promise<Fixture> => {
      return apiCall(`/api/fixtures/${fixtureId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    getPending: async (service?: string): Promise<Fixture[]> => {
      const params = new URLSearchParams({ status: 'draft' })
      if (service) {
        params.set('service', service)
      }

      return apiCall(`/api/fixtures/pending?${params}`)
    },

    getByOperation: async (
      service: string,
      version: string,
      operation: string,
      status = 'approved'
    ): Promise<Fixture[]> => {
      const params = new URLSearchParams({
        service,
        version,
        status,
      })

      return apiCall(`/api/fixtures/${operation}?${params}`)
    },

    propose: async (proposal: FixtureProposal): Promise<Fixture> => {
      return apiCall('/api/fixtures', {
        method: 'POST',
        body: JSON.stringify(proposal),
      })
    },

    bulkApprove: async (testRunId: string, approver: string): Promise<number> => {
      // Get all fixtures from this test run
      const fixtures = await getFixturesByTestRun(serviceUrl, apiKey, testRunId)
      const pendingFixtures = fixtures.filter(f => f.status === 'draft')

      let approvedCount = 0
      for (const fixture of pendingFixtures) {
        try {
          await apiCall(`/api/fixtures/${fixture.id}/approve`, {
            method: 'POST',
            body: JSON.stringify({
              approvedBy: approver,
              notes: `Bulk approved from successful test run ${testRunId}`,
            }),
          })
          approvedCount++
        } catch (error) {
          console.error(`Failed to approve fixture ${fixture.id}:`, error)
        }
      }

      return approvedCount
    },

    deprecate: async (fixtureId: string, reason?: string): Promise<Fixture> => {
      return apiCall(`/api/fixtures/${fixtureId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'deprecated',
          notes: reason,
        }),
      })
    },
  }
}

// Helper function to get fixtures by test run
const getFixturesByTestRun = async (
  serviceUrl: string,
  apiKey: string,
  testRunId: string
): Promise<Fixture[]> => {
  const response = await fetch(`${serviceUrl}/api/fixtures?testRun=${testRunId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get fixtures for test run ${testRunId}`)
  }

  return response.json()
}

// Utility functions for fixture management
export const validateFixtureData = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false
  }

  const fixtureData = data as Record<string, unknown>

  // Must have response data
  if (!fixtureData.response) {
    return false
  }

  // If request is provided, it should be an object
  if (fixtureData.request && typeof fixtureData.request !== 'object') {
    return false
  }

  // If state is provided, it should be an object
  if (fixtureData.state && typeof fixtureData.state !== 'object') {
    return false
  }

  return true
}

export const prioritizeFixtures = (fixtures: Fixture[]): Fixture[] => {
  return fixtures
    .filter(f => f.status === 'approved')
    .sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }

      // Provider fixtures over consumer fixtures
      const sourceOrder = { provider: 3, manual: 2, consumer: 1 }
      return sourceOrder[b.source] - sourceOrder[a.source]
    })
}

// Extract operation ID from OpenAPI spec operations (preferred method)
// OpenAPI operation from spec
interface SpecOperation {
  method: string
  path: string
  iid?: string
  operationId?: string
}

export const extractOperationFromSpec = (
  method: string,
  path: string,
  operations: SpecOperation[]
): string => {
  if (!operations || operations.length === 0) {
    return extractOperationFromPath(method, path)
  }

  // Find the matching operation in the spec
  const matchingOperation = operations.find(op => {
    if (!op.method || !op.path) return false

    // Method must match (case insensitive)
    const methodMatches = op.method.toLowerCase() === method.toLowerCase()
    if (!methodMatches) return false

    // Check if path matches the spec path pattern
    return pathMatchesSpecPattern(path, op.path)
  })

  // Prism uses 'iid' field, fallback to 'operationId', then path-based extraction
  return (
    matchingOperation?.iid ||
    matchingOperation?.operationId ||
    extractOperationFromPath(method, path)
  )
}

// Check if a request path matches an OpenAPI spec path pattern
const pathMatchesSpecPattern = (requestPath: string, specPath: string): boolean => {
  const requestSegments = requestPath.split('/').filter(Boolean)
  const specSegments = specPath.split('/').filter(Boolean)

  if (requestSegments.length !== specSegments.length) {
    return false
  }

  for (let i = 0; i < specSegments.length; i++) {
    const specSegment = specSegments[i]
    const requestSegment = requestSegments[i]

    // If spec segment is a parameter (e.g., {id}), it matches any value
    if (specSegment.startsWith('{') && specSegment.endsWith('}')) {
      continue
    }

    // Otherwise, must be exact match
    if (specSegment !== requestSegment) {
      return false
    }
  }

  return true
}

// Fallback: Extract operation from path (less reliable)
export const extractOperationFromPath = (method: string, path: string): string => {
  // Convert HTTP method and path to operation ID
  // Examples:
  // GET /orders/{id} -> getOrder
  // GET /orders/550e8400-e29b-41d4-a716-446655440000 -> getOrder
  // POST /orders -> createOrder
  // PUT /orders/{id} -> updateOrder
  // DELETE /castles/550e8400-e29b-41d4-a716-446655440000 -> deleteCastle

  const pathSegments = path
    .replace(/\/$/, '') // Remove trailing slash
    .split('/')
    .filter(Boolean)

  // Filter out segments that look like IDs (UUIDs, numbers, etc.)
  const resourceSegments = pathSegments.filter(segment => {
    // Remove OpenAPI path parameters
    if (segment.startsWith('{') && segment.endsWith('}')) {
      return false
    }

    // Remove UUID-like segments (8-4-4-4-12 format)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return false
    }

    // Remove numeric IDs
    if (/^\d+$/.test(segment)) {
      return false
    }

    // Remove other common ID patterns (alphanumeric IDs)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(segment)) {
      return false
    }

    return true
  })

  const cleanPath = resourceSegments.join('')
  const methodPrefix = method.toLowerCase()

  if (cleanPath) {
    // Convert to singular form for better operation names
    const singularPath =
      cleanPath.endsWith('s') && cleanPath.length > 1 ? cleanPath.slice(0, -1) : cleanPath

    return `${methodPrefix}${singularPath.charAt(0).toUpperCase()}${singularPath.slice(1)}`
  }

  return methodPrefix
}

// Generate a deterministic hash for fixture deduplication
export const generateFixtureHash = async (
  operation: string,
  data: { request?: unknown; response: unknown }
): Promise<string> => {
  // Create a normalized object for hashing
  const hashObject = {
    operation,
    request: normalizeForHashing(data.request),
    response: normalizeForHashing(data.response),
  }

  // Create deterministic JSON string
  const hashString = JSON.stringify(hashObject, null, 0)

  // Use Web Crypto API (available in Cloudflare Workers and browsers)
  const encoder = new TextEncoder()
  const data_buffer = encoder.encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data_buffer)

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

// Generate a deterministic hash for interaction deduplication
export const generateInteractionHash = async (
  service: string,
  consumer: string,
  consumerVersion: string,
  operation: string,
  request: unknown,
  response: unknown
): Promise<string> => {
  // Create a normalized object for hashing
  const hashObject = {
    service,
    consumer,
    consumerVersion,
    operation,
    request: normalizeForHashing(request),
    response: normalizeForHashing(response),
  }

  // Create deterministic JSON string
  const hashString = JSON.stringify(hashObject, null, 0)

  // Use Web Crypto API (available in Cloudflare Workers and browsers)
  const encoder = new TextEncoder()
  const data_buffer = encoder.encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data_buffer)

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

// Normalize data for consistent hashing
const normalizeForHashing = (data: unknown): unknown => {
  if (data === null || data === undefined) {
    return null
  }

  if (Array.isArray(data)) {
    return data.map(normalizeForHashing)
  }

  if (typeof data === 'object') {
    const normalized: Record<string, unknown> = {}

    // Sort keys for deterministic hashing
    const sortedKeys = Object.keys(data as Record<string, unknown>).sort()

    for (const key of sortedKeys) {
      const value = (data as Record<string, unknown>)[key]

      // Skip volatile fields that shouldn't affect fixture uniqueness
      if (isVolatileField(key)) {
        continue
      }

      normalized[key] = normalizeForHashing(value)
    }

    return normalized
  }

  return data
}

// Check if a field should be excluded from hashing (timestamps, IDs, etc.)
const isVolatileField = (key: string): boolean => {
  const volatilePatterns = [
    /timestamp/i,
    /created_?at/i,
    /updated_?at/i,
    /date/i,
    /time/i,
    // HTTP headers that can vary between test runs
    /^host$/i, // host: localhost:3001 (dynamic port)
    /^user-agent$/i, // user-agent can vary
    /^connection$/i, // connection: keep-alive/close
    /^accept-encoding$/i, // accept-encoding can vary
    /^content-length$/i, // content-length is derived from body
    // Keep IDs as they might be important for the contract
    // /id$/i,
  ]

  return volatilePatterns.some(pattern => pattern.test(key))
}

// Entity normalization functions
export const normalizeFixtures = (
  fixtures: Fixture[],
  service: string,
  version: string
): NormalizedFixtures => {
  const entities: Record<string, EntityData[]> = {}
  const mutations: Record<string, EntityData[]> = {}
  const relationships: EntityRelationship[] = []

  debugLog(`🔧 normalizeFixtures called with ${fixtures.length} fixtures for ${service}@${version}`)

  // Process each fixture and extract entities
  for (const fixture of fixtures) {
    debugLog(`🔧 Processing fixture ${fixture.id}: ${fixture.operation} (specType: ${fixture.specType})`)
    const entityData = extractEntitiesFromFixture(fixture)

    for (const entity of entityData.entities) {
      debugLog(`🔧 Processing entity ${entity.id} (type: ${entity.type}, operation: ${entity.operation})`)

      // Separate mutations from base entities
      if (entity.operation === 'update') {
        debugLog(`🔄 Adding entity ${entity.id} to mutations collection`)
        if (!mutations[entity.type]) {
          mutations[entity.type] = []
        }
        mutations[entity.type].push(entity)
      } else {
        // Handle create/read operations as base entities
        debugLog(`🏗️ Processing base entity ${entity.id} (operation: ${entity.operation})`)
        if (!entities[entity.type]) {
          entities[entity.type] = []
        }

        // Check if entity already exists (by ID)
        const existingIndex = entities[entity.type].findIndex(e => e.id === entity.id)
        if (existingIndex >= 0) {
          debugLog(`🔍 Found existing entity ${entity.id}, checking if should replace`)
          // Update existing entity if this operation is newer or higher priority
          const existing = entities[entity.type][existingIndex]
          if (entity.operation === 'delete' || shouldReplaceEntity(existing, entity, fixture)) {
            debugLog(`✅ Replacing existing entity ${entity.id}`)
            entities[entity.type][existingIndex] = entity
          } else {
            debugLog(`⏭️ Keeping existing entity ${entity.id}`)
          }
        } else {
          debugLog(`➕ Adding new base entity ${entity.id}`)
          entities[entity.type].push(entity)
        }
      }
    }

    relationships.push(...entityData.relationships)
  }

  debugLog(`🎯 Normalization complete: ${Object.keys(entities).reduce((total, type) => total + entities[type].length, 0)} base entities, ${Object.keys(mutations).reduce((total, type) => total + mutations[type].length, 0)} mutations`)

  return {
    entities,
    mutations,
    relationships,
    metadata: {
      service,
      version,
      totalFixtures: fixtures.length,
      extractedAt: new Date(),
    },
  }
}

export const extractEntitiesFromFixture = (
  fixture: Fixture
): {
  entities: EntityData[]
  relationships: EntityRelationship[]
} => {
  debugLog('🔧 Main Processing fixture:', fixture.operation, 'specType:', fixture.specType)
  debugLog('🔧 Available handlers:', specRegistry.getSupportedTypes())

  // Delegate to the appropriate spec handler based on specType
  const handler = specRegistry.getHandler(fixture.specType)
  debugLog(`🔧 Handler for ${fixture.specType}:`, !!handler)
  debugLog(`🔧 Handler has extractEntitiesFromFixture:`, !!(handler && handler.extractEntitiesFromFixture))

  if (handler && handler.extractEntitiesFromFixture) {
    debugLog(`🎯 Delegating to ${fixture.specType} handler for entity extraction`)
    const result = handler.extractEntitiesFromFixture(fixture)
    debugLog(`🎯 Handler returned:`, result.entities.length, 'entities')
    return result
  }

  // Fallback to empty result if no handler found
  debugLog(`❌ No handler found for specType: ${fixture.specType}`)
  return { entities: [], relationships: [] }
}

// Legacy function - now delegated to spec handlers
export const inferEntityType = (operation: string): string | null => {
  debugLog(
    '⚠️ Warning: inferEntityType called without specType - this should be handled by spec handlers'
  )
  return null
}

const extractEntityFromData = (
  data: unknown,
  entityType: string,
  operation: 'create' | 'update' | 'delete',
  source: string
): EntityData | null => {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>

  // Try to find an ID field
  const id = record.id || record._id || record.uuid || record.key
  if (!id) {
    return null
  }

  return {
    id: String(id),
    type: entityType,
    data: record,
    operation,
    source,
  }
}

const shouldReplaceEntity = (
  existing: EntityData,
  candidate: EntityData,
  fixture: Fixture
): boolean => {
  // Prefer higher priority fixtures
  if (fixture.priority > (existing.source === candidate.source ? 0 : 1)) {
    return true
  }

  // Prefer provider fixtures over consumer fixtures
  if (fixture.source === 'provider' && existing.source !== candidate.source) {
    return true
  }

  // Prefer more recent fixtures
  return fixture.createdAt > new Date(existing.source)
}

// Mock handler for fixture-based OpenAPI mocking
export interface MockRequest {
  method: string
  path: string
  headers: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown
}

export interface MockResponse {
  status: number
  headers: Record<string, string>
  body?: unknown
}

export interface MockHandler {
  match: (request: MockRequest) => boolean
  respond: (request: MockRequest) => MockResponse
}

export const createOpenAPIMockHandler = (spec: OpenAPISpec, fixtures: Fixture[]): MockHandler[] => {
  const handlers: MockHandler[] = []

  // Group fixtures by operation for faster lookup
  const fixturesByOperation = new Map<string, Fixture[]>()
  for (const fixture of fixtures) {
    const operation = fixture.operation
    if (!fixturesByOperation.has(operation)) {
      fixturesByOperation.set(operation, [])
    }
    fixturesByOperation.get(operation)?.push(fixture)
  }

  // Sort fixtures by priority (highest first)
  for (const [_, operationFixtures] of fixturesByOperation) {
    operationFixtures.sort((a, b) => b.priority - a.priority)
  }

  // Create handlers for each path/method combination in the spec
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation === 'object' && operation) {
        const operationId =
          (operation as any).operationId || extractOperationFromPath(method.toUpperCase(), path)

        handlers.push({
          match: (request: MockRequest) => {
            return (
              request.method.toLowerCase() === method.toLowerCase() &&
              pathMatchesSpecPattern(request.path, path)
            )
          },
          respond: (request: MockRequest) => {
            // Try to find matching fixture first
            const operationFixtures = fixturesByOperation.get(operationId) || []
            const matchingFixture = findMatchingFixture(request, operationFixtures)

            if (matchingFixture) {
              const fixtureResponse = matchingFixture.data.response as HTTPResponse
              return {
                status: fixtureResponse.status,
                headers: fixtureResponse.headers || { 'content-type': 'application/json' },
                body: fixtureResponse.body,
              }
            }

            // Fall back to OpenAPI examples if available
            const responses = (operation as any).responses || {}
            for (const [statusCode, response] of Object.entries(responses)) {
              if (statusCode.startsWith('2')) {
                // 2xx success responses
                const responseObj = response as any
                if (responseObj.content?.['application/json']?.example) {
                  return {
                    status: Number.parseInt(statusCode),
                    headers: { 'content-type': 'application/json' },
                    body: responseObj.content['application/json'].example,
                  }
                }
              }
            }

            // No fixture or example found
            return {
              status: 501,
              headers: { 'content-type': 'application/json' },
              body: {
                error: 'Not Implemented',
                message: `No fixture or example available for ${method.toUpperCase()} ${path}`,
                operation: operationId,
              },
            }
          },
        })
      }
    }
  }

  return handlers
}

const findMatchingFixture = (request: MockRequest, fixtures: Fixture[]): Fixture | null => {
  if (!fixtures || fixtures.length === 0) {
    return null
  }

  // Try exact match first (including body for POST/PUT requests)
  for (const fixture of fixtures) {
    const fixtureRequest = fixture.data.request as HTTPRequest | undefined
    if (!fixtureRequest) continue

    // Method must match
    if (fixtureRequest.method.toLowerCase() !== request.method.toLowerCase()) {
      continue
    }

    // Path must match
    if (fixtureRequest.path !== request.path) {
      continue
    }

    // For POST/PUT/PATCH requests, try to match body if both exist
    if (request.body && fixtureRequest.body) {
      try {
        const requestBodyStr = JSON.stringify(request.body)
        const fixtureBodyStr = JSON.stringify(fixtureRequest.body)
        if (requestBodyStr === fixtureBodyStr) {
          return fixture
        }
      } catch {
        // Fall through to string comparison
        if (String(request.body) === String(fixtureRequest.body)) {
          return fixture
        }
      }
    } else if (!request.body && !fixtureRequest.body) {
      // Both have no body - this is a match
      return fixture
    }
  }

  // Fall back to path/method match only (ignore body differences)
  for (const fixture of fixtures) {
    const fixtureRequest = fixture.data.request as HTTPRequest | undefined
    if (!fixtureRequest) continue

    if (
      fixtureRequest.method.toLowerCase() === request.method.toLowerCase() &&
      fixtureRequest.path === request.path
    ) {
      return fixture
    }
  }

  return null
}

export const handleMockRequest = (request: MockRequest, handlers: MockHandler[]): MockResponse => {
  for (const handler of handlers) {
    if (handler.match(request)) {
      return handler.respond(request)
    }
  }

  // No handler matched
  return {
    status: 404,
    headers: { 'content-type': 'application/json' },
    body: {
      error: 'Not Found',
      message: `No handler found for ${request.method} ${request.path}`,
    },
  }
}

// NEW: Multi-spec support exports
export {
  createSpecHandler,
  generateOperationId,
  normalizeHeaders,
  parseContentType,
  createValidationError,
  createValidationSuccess,
  combineValidationResults,
  isHTTPRequest,
  isGraphQLRequest,
  isEventRequest,
  isRPCRequest,
} from './spec-handlers/types.js'

export {
  createSpecRegistry,
  findSpecType,
  specRegistry,
} from './spec-handlers/registry.js'

export {
  canHandleOpenAPI,
  parseOpenAPISpec,
  extractOpenAPIOperations,
  matchOpenAPIOperation,
  generateOpenAPIResponseV2,
  validateOpenAPIResponse,
  generateOpenAPIMockData,
  getOpenAPIRequestSchema,
  getOpenAPIResponseSchema,
  createOpenAPIHandler,
} from './spec-handlers/openapi.js'

// Unified mock handler system
export {
  createUnifiedMockHandler,
  handleUnifiedMockRequest,
  convertHTTPToUnified,
  convertUnifiedToHTTP,
} from './mock-handlers.js'

// GraphQL-specific utilities
export { extractGraphQLOperationName } from './spec-handlers/graphql.js'

// V2 Router & Scoring (experimental)
export { createRequestRouter } from './router/request-router.js'
export { scoreFixturesDefault } from './scoring/fixture-scoring.js'

// Operation matching (for interceptors)
export { createOperationMatcher } from './matching/operation-matcher.js'
