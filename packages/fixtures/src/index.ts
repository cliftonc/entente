import type { Fixture, FixtureProposal, FixtureUpdate } from '@entente/types'

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
