import type {
  APIOperation,
  APISpec,
  EntityData,
  EntityRelationship,
  Fixture,
  FixtureSelectionResult,
  FixtureScoreBreakdown,
  LocalMockData,
  OpenAPISpec,
  OperationMatchCandidate,
  OperationMatchContext,
  OperationMatchResult,
  SpecHandler,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
} from '@entente/types'
import { match } from 'path-to-regexp'
import {
  createSpecHandler,
  createValidationError,
  createValidationSuccess,
  generateOperationId,
  normalizeHeaders,
} from './types.js'

// Convert OpenAPI path format to Express-style for path-to-regexp
const convertOpenAPIPathToExpress = (openApiPath: string): string => {
  // Convert {param} to :param for path-to-regexp
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1')
}

// Create a path matcher using path-to-regexp
const createPathMatcher = (operationPath: string) => {
  const expressPath = convertOpenAPIPathToExpress(operationPath)
  return match(expressPath, { decode: decodeURIComponent })
}

// Pure function to check if spec is OpenAPI
export const canHandleOpenAPI = (spec: any): boolean => {
  return !!(spec && typeof spec === 'object' && ('openapi' in spec || 'swagger' in spec))
}

// Pure function to parse OpenAPI spec
export const parseOpenAPISpec = (spec: any): APISpec => {
  const openApiSpec = spec as OpenAPISpec
  return {
    type: 'openapi',
    version: openApiSpec.openapi || openApiSpec.swagger || '3.0.0',
    spec: openApiSpec,
  }
}

// Pure function to extract operations from OpenAPI spec
export const extractOpenAPIOperations = (spec: APISpec): APIOperation[] => {
  const openApiSpec = spec.spec as OpenAPISpec
  const operations: APIOperation[] = []

  if (!openApiSpec.paths) {
    return operations
  }

  for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== 'object') {
        continue
      }

      const opData = operation as any
      // Support Prism's 'iid' field, fallback to operationId, then generate one
      const operationId = opData.iid || opData.operationId ||
                         generateOperationId(method.toUpperCase(), path)

      const apiOperation: APIOperation = {
        id: operationId,
        type: 'rest',
        method: method.toUpperCase(),
        path,
        description: opData.summary || opData.description,
        deprecated: opData.deprecated || false,
        request: extractRequestSchema(opData),
        response: extractResponseSchema(opData),
        errors: extractErrorSchemas(opData),
      }

      operations.push(apiOperation)
    }
  }

  return operations
}


// Pure function to validate OpenAPI response
export const validateOpenAPIResponse = (
  operation: APIOperation,
  expected: any,
  actual: any
): ValidationResult => {
  if (!actual) {
    return createValidationError('response', 'Response is null or undefined', expected, actual)
  }

  // Basic structure validation
  const expectedKeys = Object.keys(expected || {})

  for (const key of expectedKeys) {
    if (!(key in actual)) {
      return createValidationError(
        `response.${key}`,
        `Missing required field: ${key}`,
        expected[key],
        undefined
      )
    }
  }

  return createValidationSuccess()
}

// Pure function to generate mock data for OpenAPI operation
export const generateOpenAPIMockData = (operation: APIOperation): any => {
  return {
    message: `Mock response for ${operation.id}`,
    data: null,
  }
}

// Pure function to get request schema
export const getOpenAPIRequestSchema = (operation: APIOperation): any => {
  return operation.request?.schema
}

// Pure function to get response schema
export const getOpenAPIResponseSchema = (operation: APIOperation): any => {
  return operation.response?.schema
}

// Helper functions (pure)
const extractRequestSchema = (operation: any): any => {
  if (!operation.requestBody) return null

  const content = operation.requestBody.content
  if (!content) return null

  const firstContentType = Object.keys(content)[0]
  return content[firstContentType]?.schema
}

const extractResponseSchema = (operation: any): any => {
  if (!operation.responses) return null

  const response =
    operation.responses['200'] ||
    operation.responses['201'] ||
    operation.responses[Object.keys(operation.responses)[0]]

  if (!response?.content) return null

  const content = response.content
  const firstContentType = Object.keys(content)[0]
  return content[firstContentType]?.schema
}

const extractErrorSchemas = (operation: any): any[] => {
  if (!operation.responses) return []

  const errorSchemas = []
  for (const [status, response] of Object.entries(operation.responses)) {
    const statusCode = Number.parseInt(status, 10)
    if (statusCode >= 400 && response && typeof response === 'object') {
      errorSchemas.push({
        status: statusCode,
        schema: response,
      })
    }
  }

  return errorSchemas
}

// Legacy pathMatches function replaced by path-to-regexp in evaluatePathMatch
// Keeping for reference/compatibility if needed elsewhere
const pathMatches = (specPath: string, requestPath: string): boolean => {
  try {
    const matcher = createPathMatcher(specPath)
    return !!matcher(requestPath)
  } catch {
    return false
  }
}

// Function to find matching fixture using the same logic as the old createOpenAPIMockHandler
const findMatchingFixture = (
  request: UnifiedRequest,
  operation: APIOperation,
  fixtures: Fixture[]
): Fixture | null => {
  // Filter fixtures by operation first
  const operationFixtures = fixtures.filter(
    f => f.operation === operation.id && f.specType === 'openapi'
  )

  if (operationFixtures.length === 0) {
    return null
  }

  // Sort by priority (highest first)
  operationFixtures.sort((a, b) => b.priority - a.priority)

  // Try exact match first (including body for POST/PUT requests) - same as old findMatchingFixture
  for (const fixture of operationFixtures) {
    const fixtureRequest = fixture.data.request as any
    if (!fixtureRequest) continue

    // Method must match
    if (fixtureRequest.method?.toLowerCase() !== request.method?.toLowerCase()) {
      continue
    }

    // Path must match exactly
    if (fixtureRequest.path !== request.path) {
      continue
    }

    // For POST/PUT/PATCH requests, try to match body if both exist
    if (request.method && ['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
      if (request.body && fixtureRequest.body) {
        try {
          const requestBodyStr = JSON.stringify(request.body)
          const fixtureBodyStr = JSON.stringify(fixtureRequest.body)
          if (requestBodyStr !== fixtureBodyStr) {
            continue
          }
        } catch {
          // If JSON comparison fails, do string comparison
          if (String(request.body) !== String(fixtureRequest.body)) {
            continue
          }
        }
      }
    }

    // This fixture matches!
    return fixture
  }

  // No exact match found, return the highest priority fixture (fallback behavior)
  return operationFixtures[0] || null
}

const findBestFixture = (operation: APIOperation, fixtures: Fixture[]): Fixture | null => {
  // Filter fixtures by both operation and specType for isolation
  const matchingFixtures = fixtures.filter(
    f => f.operation === operation.id && f.specType === 'openapi'
  )

  if (matchingFixtures.length === 0) {
    return null
  }

  return matchingFixtures.sort((a, b) => {
    // Provider fixtures have higher priority than consumer fixtures
    if (a.source !== b.source) {
      const sourceOrder: Record<string, number> = { provider: 3, manual: 2, consumer: 1 }
      return (sourceOrder[b.source] || 0) - (sourceOrder[a.source] || 0)
    }

    return b.priority - a.priority
  })[0]
}


// V2 Methods: Rich operation matching with confidence scoring
export const matchOpenAPIOperation = (ctx: OperationMatchContext): OperationMatchResult => {
  const { request, operations } = ctx
  const candidates: OperationMatchCandidate[] = []

  if (!request.method || !request.path) {
    return { candidates: [], selected: null }
  }

  for (const operation of operations) {
    if (!operation.method || !operation.path) continue

    const candidate = evaluateOperationMatch(request, operation)
    if (candidate.confidence > 0) {
      candidates.push(candidate)
    }
  }

  // Sort by confidence (highest first), then by path specificity
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence
    }
    // Tie-breaker: more path parameters = more specific = higher priority
    const aParams = (a.parameters && Object.keys(a.parameters).length) || 0
    const bParams = (b.parameters && Object.keys(b.parameters).length) || 0
    return bParams - aParams
  })

  return {
    candidates,
    selected: candidates.length > 0 ? candidates[0] : null
  }
}

// Evaluate how well a single operation matches the request
const evaluateOperationMatch = (
  request: UnifiedRequest,
  operation: APIOperation
): OperationMatchCandidate => {
  const reasons: string[] = []
  const metrics: Record<string, number> = {}
  let confidence = 0
  const parameters: Record<string, unknown> = {}

  // Method matching (required)
  if (operation.method !== request.method) {
    return {
      operation,
      confidence: 0,
      reasons: ['Method mismatch'],
      metrics: { methodScore: 0 },
      parameters: {}
    }
  }

  confidence += 0.3
  reasons.push('Method matches')
  metrics.methodScore = 1

  // Path matching with parameter extraction
  const pathResult = evaluatePathMatch(operation.path!, request.path!)
  confidence += pathResult.score * 0.7 // Path is 70% of confidence

  if (pathResult.score > 0) {
    reasons.push(...pathResult.reasons)
    Object.assign(parameters, pathResult.parameters)
    metrics.pathScore = pathResult.score
  }

  return {
    operation,
    confidence: Math.min(confidence, 1), // Cap at 1.0
    reasons,
    metrics,
    parameters
  }
}

// Evaluate path matching and extract parameters using path-to-regexp
const evaluatePathMatch = (
  operationPath: string,
  requestPath: string
): { score: number; reasons: string[]; parameters: Record<string, unknown> } => {
  const reasons: string[] = []
  const parameters: Record<string, unknown> = {}

  // Exact match gets full score
  if (operationPath === requestPath) {
    reasons.push('Exact path match')
    return { score: 1.0, reasons, parameters }
  }

  try {
    // Use path-to-regexp for robust path matching
    const matcher = createPathMatcher(operationPath)
    const result = matcher(requestPath)

    if (!result) {
      reasons.push('Path does not match pattern')
      return { score: 0, reasons, parameters }
    }

    // Extract parameters from the match result
    Object.assign(parameters, result.params as Record<string, unknown>)

    // Calculate score based on match quality
    const paramCount = Object.keys(parameters).length
    const expressPath = convertOpenAPIPathToExpress(operationPath)

    if (paramCount > 0) {
      reasons.push(`Path pattern match with ${paramCount} parameters: ${JSON.stringify(parameters)}`)
    } else {
      reasons.push('Path pattern match (no parameters)')
    }

    // Higher score for exact matches, slightly lower for parameterized matches
    const score = paramCount > 0 ? 0.9 : 1.0
    return { score, reasons, parameters }

  } catch (error) {
    reasons.push(`Error matching path: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { score: 0, reasons, parameters }
  }
}

// V2 Methods: Response generation with fixture selection context
export const generateOpenAPIResponseV2 = (params: {
  operation: APIOperation
  fixtures: Fixture[]
  request: UnifiedRequest
  match: OperationMatchCandidate
  fixtureSelection?: FixtureSelectionResult
}): UnifiedResponse => {
  const { operation, fixtures, request, match, fixtureSelection } = params

  // Use selected fixture if available
  if (fixtureSelection?.selected) {
    const fixture = fixtures.find(f => f.id === fixtureSelection.selected!.fixtureId)
    if (fixture && fixture.data.response) {
      const responseData = fixture.data.response as any
      return {
        status: responseData.status || 200,
        headers: responseData.headers || { 'content-type': 'application/json' },
        body: responseData.body,
        success: (responseData.status || 200) < 400,
      }
    }
  }

  // Fall back to finding matching fixture using legacy logic for now
  const fixture = findMatchingFixture(request, operation, fixtures)
  if (fixture && fixture.data.response) {
    const responseData = fixture.data.response as any
    return {
      status: responseData.status || 200,
      headers: responseData.headers || { 'content-type': 'application/json' },
      body: responseData.body,
      success: (responseData.status || 200) < 400,
    }
  }

  // Generate mock response based on operation and extracted parameters
  return generateMockOpenAPIResponseV2(operation, match.parameters || {})
}

// Enhanced mock response generation that can use extracted parameters
const generateMockOpenAPIResponseV2 = (
  operation: APIOperation,
  parameters: Record<string, unknown>
): UnifiedResponse => {
  let body: any = null
  let status = 200

  if (operation.method === 'POST') {
    status = 201
    body = { id: 'mock-generated-id', message: 'Created successfully' }
  } else if (operation.method === 'DELETE') {
    status = 204
    body = null
  } else if (operation.method === 'GET') {
    if (operation.path?.includes('{')) {
      // Single resource with ID from path parameters
      const id = Object.values(parameters)[0] || 'mock-id'
      body = { id, name: 'Mock Resource', ...parameters }
    } else {
      // List resource
      body = [{ id: 'mock-id-1', name: 'Mock Resource 1' }]
    }
  } else if (operation.method === 'PUT' || operation.method === 'PATCH') {
    // Update operation - return updated resource
    const id = Object.values(parameters)[0] || 'mock-id'
    body = { id, name: 'Updated Mock Resource', ...parameters }
  }

  return {
    status,
    headers: { 'content-type': 'application/json' },
    body,
    success: status < 400,
  }
}

// OpenAPI/REST-specific entity extraction functions
export const inferOpenAPIEntityType = (operation: string): string | null => {
  // Extract entity name from operation ID
  // Examples: getUser -> User, createOrder -> Order, deleteCustomer -> Customer

  const methodPrefixes = ['get', 'create', 'update', 'delete', 'list', 'find', 'search']
  let entityName = operation

  for (const prefix of methodPrefixes) {
    if (operation.toLowerCase().startsWith(prefix)) {
      entityName = operation.slice(prefix.length)
      break
    }
  }

  if (!entityName) {
    return null
  }

  // Capitalize first letter and return singular form
  const capitalized = entityName.charAt(0).toUpperCase() + entityName.slice(1)

  // Convert plural to singular
  if (capitalized.endsWith('s') && capitalized.length > 1) {
    return capitalized.slice(0, -1)
  }

  return capitalized
}

// Convert LocalMockData to fixtures for OpenAPI specs
export const convertOpenAPIMockDataToFixtures = (
  mockData: LocalMockData,
  service: string,
  version: string,
  spec?: APISpec
): Fixture[] => {
  const fixtures: Fixture[] = []
  let fixtureId = 1

  // Create mapping from operation ID to path and method from the spec
  const operationMap = new Map<string, { path: string; method: string }>()

  if (spec?.spec) {
    const operations = extractOpenAPIOperations(spec)
    for (const op of operations) {
      operationMap.set(op.id, { path: op.path!, method: op.method! })
    }
  }

  for (const [operationId, scenarios] of Object.entries(mockData)) {
    for (const [scenarioName, mockResponse] of Object.entries(scenarios)) {
      // Use actual path/method from spec if available, otherwise infer
      const operationInfo = operationMap.get(operationId)
      const requestData = operationInfo
        ? generateRequestDataFromSpec(operationInfo.path, operationInfo.method, scenarioName, mockResponse)
        : generateBasicRequestData(operationId, scenarioName, mockResponse)

      const fixture: Fixture = {
        id: `local_${fixtureId++}`,
        service,
        serviceVersion: version,
        serviceVersions: [version],
        specType: 'openapi',
        operation: operationId,
        status: 'approved',
        source: 'manual',
        priority: scenarioName === 'success' || scenarioName === 'default' ? 2 : 1,
        data: {
          request: requestData,
          response: {
            status: mockResponse.status,
            headers: mockResponse.headers || { 'content-type': 'application/json' },
            body: mockResponse.body,
          },
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'local-mock-data',
        },
        createdAt: new Date(),
        notes: `Local mock data for ${operationId} - ${scenarioName}`,
      }
      fixtures.push(fixture)
    }
  }

  return fixtures
}

// Generate request data using actual spec paths and methods
const generateRequestDataFromSpec = (
  path: string,
  method: string,
  scenarioName: string,
  mockResponse: any
): any => {
  let actualPath = path
  let body: unknown = null

  // For POST/PUT/PATCH requests, use body from mock response if available
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    body = mockResponse.request?.body || null
  }

  // Replace path parameters with scenario-specific values
  if (path.includes('{')) {
    if (scenarioName === 'notFound') {
      // Use non-existent ID for not found scenarios
      actualPath = path.replace(/\{[^}]+\}/g, 'non-existent-id')
    } else {
      // Use a realistic UUID for other scenarios
      actualPath = path.replace(/\{[^}]+\}/g, '550e8400-e29b-41d4-a716-446655440000')
    }
  }

  const headers: Record<string, string> = {}
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
    headers['content-type'] = 'application/json'
  }

  return {
    method: method.toUpperCase(),
    path: actualPath,
    headers,
    query: {},
    body,
  }
}

// Generate basic request data without spec mapping (fallback)
const generateBasicRequestData = (
  operationId: string,
  scenarioName: string,
  mockResponse: any
): any => {
  let path = `/${operationId.toLowerCase()}`
  let method = 'GET'
  let body: unknown = null

  // Try to infer method from operation ID
  if (operationId.toLowerCase().startsWith('create')) {
    method = 'POST'
    path = `/${operationId.slice(6).toLowerCase()}s`
    body = mockResponse.request?.body || null
  } else if (operationId.toLowerCase().startsWith('update')) {
    method = 'PUT'
    path = `/${operationId.slice(6).toLowerCase()}s/{id}`
    body = mockResponse.request?.body || null
  } else if (operationId.toLowerCase().startsWith('delete')) {
    method = 'DELETE'
    path = `/${operationId.slice(6).toLowerCase()}s/{id}`
  } else if (operationId.toLowerCase().startsWith('get')) {
    method = 'GET'
    const entityName = operationId.slice(3).toLowerCase()
    path = entityName.endsWith('s') ? `/${entityName}` : `/${entityName}s/{id}`
  } else if (operationId.toLowerCase().startsWith('list')) {
    method = 'GET'
    path = `/${operationId.slice(4).toLowerCase()}s`
  }

  // Replace {id} with actual values based on scenario
  if (path.includes('{id}')) {
    if (scenarioName === 'notFound') {
      path = path.replace('{id}', 'non-existent-id')
    } else {
      path = path.replace('{id}', '550e8400-e29b-41d4-a716-446655440000')
    }
  }

  const headers: Record<string, string> = {}
  if (method === 'POST' || method === 'PUT') {
    headers['content-type'] = 'application/json'
  }

  return {
    method,
    path,
    headers,
    query: {},
    body,
  }
}

// Helper function to infer operation type from OpenAPI operation name and HTTP method
const inferOpenAPIOperationType = (operationName: string, requestData?: unknown): 'create' | 'update' | 'delete' => {
  const lowerName = operationName.toLowerCase()

  // Check for update operations (both operation name and HTTP method)
  if (lowerName.startsWith('update') ||
      lowerName.startsWith('edit') ||
      lowerName.startsWith('modify') ||
      lowerName.startsWith('patch') ||
      lowerName.includes('update')) {
    return 'update'
  }

  // Check HTTP method from request data
  if (requestData && typeof requestData === 'object') {
    const request = requestData as any
    const method = request.method?.toUpperCase()

    if (method === 'PUT' || method === 'PATCH') {
      return 'update'
    }

    if (method === 'DELETE') {
      return 'delete'
    }
  }

  // Check for delete operations in operation name
  if (lowerName.startsWith('delete') ||
      lowerName.startsWith('remove') ||
      lowerName.startsWith('destroy') ||
      lowerName.includes('delete')) {
    return 'delete'
  }

  // Default to create for all other operations (including GET operations)
  return 'create'
}

export const extractOpenAPIEntitiesFromFixture = (
  fixture: Fixture
): {
  entities: EntityData[]
  relationships: EntityRelationship[]
} => {
  const entities: EntityData[] = []
  const relationships: EntityRelationship[] = []

  const entityType = inferOpenAPIEntityType(fixture.operation)
  if (!entityType) {
    return { entities, relationships }
  }

  // Determine operation type based on operation name and HTTP method
  const operationType = inferOpenAPIOperationType(fixture.operation, fixture.data.request)

  // Extract entity from request data (for create/update operations)
  if (fixture.data.request) {
    const requestEntity = extractEntityFromData(
      fixture.data.request,
      entityType,
      operationType,
      fixture.operation
    )
    if (requestEntity) {
      entities.push(requestEntity)
    }
  }

  // Extract entity from response data (for read operations or successful creates)
  if (fixture.data.response && typeof fixture.data.response === 'object') {
    const responseData = fixture.data.response as Record<string, unknown>

    // REST response handling - check if response has a body with entity data
    if (responseData.body) {
      const bodyData = responseData.body

      if (Array.isArray(bodyData)) {
        // List response - extract multiple entities
        for (const item of bodyData) {
          const entity = extractEntityFromData(item, entityType, 'create', fixture.operation)
          if (entity) {
            entities.push(entity)
          }
        }
      } else if (typeof bodyData === 'object' && bodyData !== null) {
        // Single entity response
        const entity = extractEntityFromData(bodyData, entityType, operationType, fixture.operation)
        if (entity) {
          entities.push(entity)
        }
      }
    }
  }

  return { entities, relationships }
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

  // Must have an ID field
  if (!record.id) {
    return null
  }

  return {
    id: String(record.id),
    type: entityType,
    data: record,
    operation,
    source,
  }
}

export const createOpenAPIHandler = (): SpecHandler => ({
  ...createSpecHandler({
    type: 'openapi',
    name: 'OpenAPI/Swagger',
    canHandle: canHandleOpenAPI,
    parseSpec: parseOpenAPISpec,
    extractOperations: extractOpenAPIOperations,
    matchOperation: matchOpenAPIOperation,
    generateResponse: generateOpenAPIResponseV2,
    validateResponse: validateOpenAPIResponse,
    generateMockData: generateOpenAPIMockData,
    getRequestSchema: getOpenAPIRequestSchema,
    getResponseSchema: getOpenAPIResponseSchema,
  }),
  convertMockDataToFixtures: convertOpenAPIMockDataToFixtures,
  extractEntitiesFromFixture: extractOpenAPIEntitiesFromFixture,
  inferEntityType: inferOpenAPIEntityType,
})
