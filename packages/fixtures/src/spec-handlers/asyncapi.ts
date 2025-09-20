import type {
  APIOperation,
  APISpec,
  AsyncAPISpec as AsyncAPISpecType,
  EntityData,
  EntityRelationship,
  Fixture,
  FixtureSelectionResult,
  LocalMockData,
  OperationMatchCandidate,
  OperationMatchContext,
  OperationMatchResult,
  SpecHandler,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
} from '@entente/types'
import * as yaml from 'js-yaml'
import {
  createSpecHandler,
  createValidationError,
  createValidationSuccess,
  generateOperationId,
  isEventRequest,
} from './types.js'

// Pure function to check if spec is AsyncAPI
export const canHandleAsyncAPI = (spec: any): boolean => {
  // Check if it's a parsed AsyncAPI object
  if (spec && typeof spec === 'object' && spec.asyncapi) {
    return true
  }

  // Check if it's a YAML string that might be AsyncAPI
  if (typeof spec === 'string') {
    try {
      const parsed = yaml.load(spec) as any
      return !!(parsed && typeof parsed === 'object' && parsed.asyncapi)
    } catch {
      return false
    }
  }

  return false
}

// Pure function to parse AsyncAPI spec
export const parseAsyncAPISpec = (spec: any): APISpec => {
  let asyncApiSpec: AsyncAPISpecType

  if (typeof spec === 'string') {
    // Parse YAML string
    const parsed = yaml.load(spec) as any
    if (!parsed || !parsed.asyncapi) {
      throw new Error('Invalid AsyncAPI YAML format')
    }
    asyncApiSpec = parsed as AsyncAPISpecType
  } else if (spec && typeof spec === 'object' && spec.asyncapi) {
    // Already parsed object
    asyncApiSpec = spec as AsyncAPISpecType
  } else {
    throw new Error('Invalid AsyncAPI spec format')
  }

  return {
    type: 'asyncapi',
    version: asyncApiSpec.asyncapi,
    spec: asyncApiSpec,
  }
}

// Pure function to extract operations from AsyncAPI spec
export const extractAsyncAPIOperations = (spec: APISpec): APIOperation[] => {
  const asyncSpec = spec.spec as AsyncAPISpecType
  const operations: APIOperation[] = []

  if (!asyncSpec.channels) {
    return operations
  }

  for (const [channel, channelDef] of Object.entries(asyncSpec.channels)) {
    if (!channelDef || typeof channelDef !== 'object') continue

    // Extract publish operations (server publishes, client subscribes)
    if (channelDef.publish) {
      const publishOp = extractAsyncAPIOperation(
        channel,
        channelDef.publish,
        'publish',
        channelDef.parameters
      )
      if (publishOp) operations.push(publishOp)
    }

    // Extract subscribe operations (server subscribes, client publishes)
    if (channelDef.subscribe) {
      const subscribeOp = extractAsyncAPIOperation(
        channel,
        channelDef.subscribe,
        'subscribe',
        channelDef.parameters
      )
      if (subscribeOp) operations.push(subscribeOp)
    }
  }

  return operations
}


// Pure function to validate AsyncAPI response
export const validateAsyncAPIResponse = (
  operation: APIOperation,
  expected: any,
  actual: any
): ValidationResult => {
  if (!actual) {
    return createValidationError('response', 'Response is null or undefined', expected, actual)
  }

  // AsyncAPI responses should have proper event structure
  if (operation.type === 'event') {
    const requiredFields = ['eventId', 'timestamp']

    for (const field of requiredFields) {
      if (!(field in actual)) {
        return createValidationError(
          `response.${field}`,
          `AsyncAPI event response must have ${field} field`,
          expected,
          actual
        )
      }
    }
  }

  return createValidationSuccess()
}

// Pure function to generate mock data for AsyncAPI operation
export const generateAsyncAPIMockData = (operation: APIOperation): any => {
  const channel = operation.channel || 'unknown'
  const operationType = operation.type

  if (operationType === 'event') {
    // Generate mock event data based on channel
    if (channel.includes('created')) {
      return {
        eventId: generateEventId(),
        eventType: 'created',
        timestamp: new Date().toISOString(),
        castle: {
          id: generateId(),
          name: 'Mock Castle',
          region: 'Mock Region',
          yearBuilt: 2024,
          status: 'active',
        },
      }
    } else if (channel.includes('deleted')) {
      return {
        eventId: generateEventId(),
        eventType: 'deleted',
        timestamp: new Date().toISOString(),
        castleId: generateId(),
        castleName: 'Mock Castle',
      }
    } else if (channel.includes('status')) {
      return {
        eventId: generateEventId(),
        castleId: generateId(),
        status: 'maintenance',
        previousStatus: 'active',
        timestamp: new Date().toISOString(),
        reason: 'Scheduled maintenance',
      }
    }
  }

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    data: null,
  }
}

// Pure function to get request schema (AsyncAPI events don't have traditional request schemas)
export const getAsyncAPIRequestSchema = (operation: APIOperation): any => {
  return operation.request?.schema || null
}

// Pure function to get response schema
export const getAsyncAPIResponseSchema = (operation: APIOperation): any => {
  return operation.response?.schema || null
}

// Helper functions (pure)
const extractAsyncAPIOperation = (
  channel: string,
  operationDef: any,
  direction: 'publish' | 'subscribe',
  parameters?: any
): APIOperation | null => {
  if (!operationDef || typeof operationDef !== 'object') {
    return null
  }

  const operationId =
    operationDef.operationId ||
    generateOperationId(direction, channel.replace(/[^a-zA-Z0-9]/g, '_'))

  return {
    id: operationId,
    type: 'event',
    channel,
    description: operationDef.summary || operationDef.description,
    request: extractAsyncAPIMessageSchema(operationDef.message, 'request'),
    response: extractAsyncAPIMessageSchema(operationDef.message, 'response'),
  }
}

const extractAsyncAPIMessageSchema = (message: any, type: 'request' | 'response'): any => {
  if (!message) return null

  // Handle $ref references
  if (message.$ref) {
    return { $ref: message.$ref }
  }

  // Extract payload schema
  if (message.payload) {
    return {
      type: 'object',
      schema: message.payload,
      contentType: message.contentType || 'application/json',
    }
  }

  return null
}

const findBestAsyncAPIFixture = (operation: APIOperation, fixtures: Fixture[]): Fixture | null => {
  // Try to find exact match first
  const exactMatch = fixtures.find(f => f.operation === operation.id)
  if (exactMatch) {
    return exactMatch
  }

  // Try to find by channel
  const channelMatch = fixtures.find(f =>
    f.operation.includes(operation.channel?.replace(/[^a-zA-Z0-9]/g, '_') || '')
  )
  if (channelMatch) {
    return channelMatch
  }

  return null
}


const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// V2 Methods: Rich operation matching with confidence scoring for AsyncAPI
export const matchAsyncAPIOperation = (ctx: OperationMatchContext): OperationMatchResult => {
  const { request, operations } = ctx
  const candidates: OperationMatchCandidate[] = []

  // AsyncAPI requests should have channel and eventType OR be WebSocket/SSE style requests
  if (!isEventRequest(request) && !isAsyncAPIStyleRequest(request)) {
    return { candidates: [], selected: null }
  }

  // For event-style requests
  if (isEventRequest(request)) {
    const { channel, eventType } = request

    for (const operation of operations) {
      if (operation.type === 'event' && operation.channel) {
        const candidate = evaluateAsyncAPIEventMatch(operation, channel!, eventType)
        if (candidate.confidence > 0) {
          candidates.push(candidate)
        }
      }
    }
  }

  // For WebSocket/SSE requests (HTTP-style but with async patterns)
  if (isAsyncAPIStyleRequest(request)) {
    for (const operation of operations) {
      const candidate = evaluateAsyncAPIHttpMatch(operation, request)
      if (candidate.confidence > 0) {
        candidates.push(candidate)
      }
    }
  }

  // Sort by confidence (highest first)
  candidates.sort((a, b) => b.confidence - a.confidence)

  return {
    candidates,
    selected: candidates.length > 0 ? candidates[0] : null
  }
}

// Check if request looks like AsyncAPI-style HTTP (WebSocket upgrade, SSE, etc.)
const isAsyncAPIStyleRequest = (request: UnifiedRequest): boolean => {
  // Check for WebSocket upgrade requests
  if (request.headers) {
    const connection = request.headers['connection']?.toLowerCase()
    const upgrade = request.headers['upgrade']?.toLowerCase()
    if (connection?.includes('upgrade') && upgrade === 'websocket') {
      return true
    }

    // Check for SSE requests
    const accept = request.headers['accept']?.toLowerCase()
    if (accept?.includes('text/event-stream')) {
      return true
    }
  }

  // Check for AsyncAPI-style paths
  if (request.path) {
    const asyncPaths = ['/ws', '/websocket', '/events', '/stream', '/sse']
    return asyncPaths.some(path => request.path!.includes(path))
  }

  return false
}

// Evaluate how well an AsyncAPI operation matches an event request
const evaluateAsyncAPIEventMatch = (
  operation: APIOperation,
  channel: string,
  eventType?: string
): OperationMatchCandidate => {
  const reasons: string[] = []
  const metrics: Record<string, number> = {}
  let confidence = 0
  const parameters: Record<string, unknown> = {}

  // Channel matching
  if (operation.channel === channel) {
    confidence += 0.7
    reasons.push('Exact channel match')
    metrics.channelScore = 1.0
  } else if (operation.channel && channelMatches(operation.channel, channel)) {
    confidence += 0.5
    reasons.push('Channel pattern match')
    metrics.channelScore = 0.7

    // Extract channel parameters
    const channelParams = extractChannelParameters(operation.channel, channel)
    Object.assign(parameters, channelParams)
  }

  // Event type matching
  if (eventType && operation.id.toLowerCase().includes(eventType.toLowerCase())) {
    confidence += 0.2
    reasons.push(`Event type matches: ${eventType}`)
    metrics.eventTypeScore = 1.0
  }

  // Operation type bonus
  if (operation.type === 'event') {
    confidence += 0.1
    reasons.push('Event operation type')
    metrics.operationTypeScore = 1.0
  }

  return {
    operation,
    confidence: Math.min(confidence, 1), // Cap at 1.0
    reasons,
    metrics,
    parameters: {
      channel,
      eventType,
      ...parameters
    }
  }
}

// Evaluate how well an AsyncAPI operation matches an HTTP-style async request
const evaluateAsyncAPIHttpMatch = (
  operation: APIOperation,
  request: UnifiedRequest
): OperationMatchCandidate => {
  const reasons: string[] = []
  const metrics: Record<string, number> = {}
  let confidence = 0
  const parameters: Record<string, unknown> = {}

  // Path-based matching for WebSocket/SSE endpoints
  if (request.path && operation.channel) {
    if (request.path.includes(operation.channel)) {
      confidence += 0.6
      reasons.push('Path contains channel')
      metrics.pathScore = 1.0
    }
  }

  // Protocol-specific matching
  if (request.headers) {
    const upgrade = request.headers['upgrade']?.toLowerCase()
    const accept = request.headers['accept']?.toLowerCase()

    if (upgrade === 'websocket' && operation.id.toLowerCase().includes('websocket')) {
      confidence += 0.3
      reasons.push('WebSocket protocol match')
      metrics.protocolScore = 1.0
    }

    if (accept?.includes('text/event-stream') && operation.id.toLowerCase().includes('sse')) {
      confidence += 0.3
      reasons.push('SSE protocol match')
      metrics.protocolScore = 1.0
    }
  }

  return {
    operation,
    confidence: Math.min(confidence, 1), // Cap at 1.0
    reasons,
    metrics,
    parameters: {
      path: request.path,
      protocol: request.headers?.['upgrade'] || 'http',
      ...parameters
    }
  }
}

// Check if channel patterns match (support for parameters like /users/{userId}/events)
const channelMatches = (operationChannel: string, requestChannel: string): boolean => {
  const opSegments = operationChannel.split('/').filter(s => s.length > 0)
  const reqSegments = requestChannel.split('/').filter(s => s.length > 0)

  if (opSegments.length !== reqSegments.length) {
    return false
  }

  for (let i = 0; i < opSegments.length; i++) {
    const opSegment = opSegments[i]
    const reqSegment = reqSegments[i]

    // Parameter segments (e.g., {userId}) match any value
    if (opSegment.startsWith('{') && opSegment.endsWith('}')) {
      continue
    }

    // Static segments must match exactly
    if (opSegment !== reqSegment) {
      return false
    }
  }

  return true
}

// Extract parameters from channel matching
const extractChannelParameters = (
  operationChannel: string,
  requestChannel: string
): Record<string, unknown> => {
  const parameters: Record<string, unknown> = {}
  const opSegments = operationChannel.split('/').filter(s => s.length > 0)
  const reqSegments = requestChannel.split('/').filter(s => s.length > 0)

  for (let i = 0; i < opSegments.length && i < reqSegments.length; i++) {
    const opSegment = opSegments[i]
    const reqSegment = reqSegments[i]

    if (opSegment.startsWith('{') && opSegment.endsWith('}')) {
      const paramName = opSegment.slice(1, -1)
      parameters[paramName] = reqSegment
    }
  }

  return parameters
}

// V2 Methods: Response generation with fixture selection context for AsyncAPI
export const generateAsyncAPIResponseV2 = (params: {
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
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: responseData.body || responseData,
        eventId: responseData.eventId || generateEventId(),
        timestamp: new Date(),
        success: true,
      }
    }
  }

  // Fall back to finding matching fixture using legacy logic
  const fixture = findBestAsyncAPIFixture(operation, fixtures)
  if (fixture) {
    const responseData = fixture.data.response as any
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: responseData.body || responseData,
      eventId: responseData.eventId || generateEventId(),
      timestamp: new Date(),
      success: true,
    }
  }

  // Generate mock response using extracted parameters
  return generateMockAsyncAPIResponseV2(operation, match.parameters || {})
}

// Enhanced AsyncAPI mock response generation with parameter context
const generateMockAsyncAPIResponseV2 = (
  operation: APIOperation,
  parameters: Record<string, unknown>
): UnifiedResponse => {
  const channel = parameters.channel as string || operation.channel || 'unknown'
  const eventType = parameters.eventType as string || 'event'
  const eventId = generateEventId()

  let mockData: any = {
    eventId,
    timestamp: new Date().toISOString(),
    channel,
    eventType,
  }

  // Generate context-aware mock data based on operation and parameters
  if (channel.includes('created') || eventType.includes('created')) {
    mockData = {
      ...mockData,
      eventType: 'created',
      data: {
        id: generateId(),
        name: 'Mock Created Item',
        status: 'active',
        ...parameters
      }
    }
  } else if (channel.includes('deleted') || eventType.includes('deleted')) {
    mockData = {
      ...mockData,
      eventType: 'deleted',
      data: {
        id: Object.values(parameters)[0] || generateId(),
        name: 'Mock Deleted Item'
      }
    }
  } else if (channel.includes('status') || eventType.includes('status')) {
    mockData = {
      ...mockData,
      eventType: 'status_changed',
      data: {
        id: Object.values(parameters)[0] || generateId(),
        status: 'updated',
        previousStatus: 'active',
        reason: 'Mock status change',
        ...parameters
      }
    }
  } else {
    // Generic event
    mockData.data = {
      id: generateId(),
      message: 'Mock event data',
      ...parameters
    }
  }

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: mockData,
    eventId,
    timestamp: new Date(),
    success: true,
  }
}

// Convert LocalMockData to fixtures for AsyncAPI specs
export const convertAsyncAPIMockDataToFixtures = (
  mockData: LocalMockData,
  service: string,
  version: string
): Fixture[] => {
  const fixtures: Fixture[] = []
  let fixtureId = 1

  for (const [operationId, scenarios] of Object.entries(mockData)) {
    for (const [scenarioName, mockResponse] of Object.entries(scenarios)) {
      const requestData = generateAsyncAPIRequestData(operationId, scenarioName, mockResponse)

      const fixture: Fixture = {
        id: `local_${fixtureId++}`,
        service,
        serviceVersion: version,
        serviceVersions: [version],
        specType: 'asyncapi',
        operation: operationId,
        status: 'approved',
        source: 'manual',
        priority: scenarioName === 'success' || scenarioName === 'default' ? 1 : 2,
        data: {
          request: requestData,
          response: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: mockResponse.body || mockResponse,
          },
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'local-mock-data',
        },
        createdAt: new Date(),
        notes: `AsyncAPI mock data for ${operationId} - ${scenarioName}`,
      }
      fixtures.push(fixture)
    }
  }

  return fixtures
}

// Generate AsyncAPI request data from operation and scenario
const generateAsyncAPIRequestData = (
  operationId: string,
  scenarioName: string,
  mockResponse: any
): any => {
  // Infer channel from operation ID
  let channel = `/${operationId.toLowerCase()}`
  let eventType = 'event'

  // Try to extract meaningful channel from operation ID
  if (operationId.includes('created')) {
    channel = `/events/created`
    eventType = 'created'
  } else if (operationId.includes('deleted')) {
    channel = `/events/deleted`
    eventType = 'deleted'
  } else if (operationId.includes('status')) {
    channel = `/events/status`
    eventType = 'status_changed'
  }

  return {
    channel,
    eventType,
    body: mockResponse.body || mockResponse,
    headers: { 'content-type': 'application/json' },
    timestamp: new Date().toISOString(),
  }
}

// AsyncAPI-specific entity extraction functions (placeholder implementation)
export const inferAsyncAPIEntityType = (operation: string): string | null => {
  // AsyncAPI typically uses event-based operations, entity extraction may be different
  // For now, return null as entity extraction might not be applicable for events
  return null
}

export const extractAsyncAPIEntitiesFromFixture = (
  fixture: Fixture
): {
  entities: EntityData[]
  relationships: EntityRelationship[]
} => {
  // AsyncAPI entity extraction placeholder - events might not have entities in the same way
  return { entities: [], relationships: [] }
}

export const createAsyncAPIHandler = (): SpecHandler => ({
  ...createSpecHandler({
    type: 'asyncapi',
    name: 'AsyncAPI',
    canHandle: canHandleAsyncAPI,
    parseSpec: parseAsyncAPISpec,
    extractOperations: extractAsyncAPIOperations,
    matchOperation: matchAsyncAPIOperation,
    generateResponse: generateAsyncAPIResponseV2,
    validateResponse: validateAsyncAPIResponse,
    generateMockData: generateAsyncAPIMockData,
    getRequestSchema: getAsyncAPIRequestSchema,
    getResponseSchema: getAsyncAPIResponseSchema,
  }),
  convertMockDataToFixtures: convertAsyncAPIMockDataToFixtures,
  extractEntitiesFromFixture: extractAsyncAPIEntitiesFromFixture,
  inferEntityType: inferAsyncAPIEntityType,
})
