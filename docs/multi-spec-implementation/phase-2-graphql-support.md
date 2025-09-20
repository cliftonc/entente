---
title: "Phase 2: GraphQL Support"
description: "Implement GraphQL specification support with auto-detection and playground"
---

# Phase 2: GraphQL Support

**Duration**: 1 Week
**Prerequisites**: Phase 1 completed, understanding of GraphQL schemas and operations
**Goal**: Add comprehensive GraphQL support with auto-detection, operation mapping, and interactive playground

## Overview

Phase 2 builds on the functional spec abstraction from Phase 1 to add full GraphQL support. We'll implement GraphQL schema parsing, operation extraction, auto-detection for GraphQL requests, and create an interactive GraphQL playground for testing.

## Task Breakdown

### Task 1: Create GraphQL Schema Test File (1 hour)

#### 1.1 Create `packages/fixtures/test/specs/castles.graphql`

```graphql
# GraphQL Schema equivalent to the castles OpenAPI spec
schema {
  query: Query
  mutation: Mutation
}

type Query {
  # List all castles (equivalent to GET /castles)
  listCastles: [Castle!]!

  # Get a castle by ID (equivalent to GET /castles/{id})
  getCastle(id: ID!): Castle
}

type Mutation {
  # Create a new castle (equivalent to POST /castles)
  createCastle(input: CreateCastleInput!): CreateCastlePayload!

  # Delete a castle (equivalent to DELETE /castles/{id})
  deleteCastle(id: ID!): DeleteCastlePayload!
}

type Castle {
  id: ID!
  name: String!
  region: String!
  yearBuilt: Int!
  description: String
}

input CreateCastleInput {
  name: String!
  region: String!
  yearBuilt: Int!
  description: String
}

type CreateCastlePayload {
  castle: Castle
  errors: [Error!]
}

type DeleteCastlePayload {
  success: Boolean!
  errors: [Error!]
}

type Error {
  error: String!
  message: String!
}
```

### Task 2: Implement GraphQL Handler Functions (4 hours)

#### 2.1 Install GraphQL Dependencies

Add to `packages/fixtures/package.json`:

```json
{
  "dependencies": {
    "graphql": "^16.8.1"
  },
  "devDependencies": {
    "@types/graphql": "^14.5.0"
  }
}
```

#### 2.2 Create `packages/fixtures/src/spec-handlers/graphql.ts`

```typescript
import type {
  APISpec,
  APIOperation,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
  Fixture,
  GraphQLSchema as GraphQLSchemaType,
  SpecHandler
} from '@entente/types'
import {
  createSpecHandler,
  generateOperationId,
  createValidationError,
  createValidationSuccess,
  isGraphQLRequest
} from './types'
import {
  parse,
  buildSchema,
  introspectionFromSchema,
  buildClientSchema,
  printSchema,
  GraphQLSchema,
  GraphQLObjectType,
  isObjectType,
  isListType,
  isNonNullType,
  GraphQLField,
  DocumentNode,
  OperationDefinitionNode,
  SelectionNode,
  FieldNode
} from 'graphql'

// Pure function to check if spec is GraphQL
export const canHandleGraphQL = (spec: any): boolean => {
  // Check if it's GraphQL SDL (Schema Definition Language)
  if (typeof spec === 'string') {
    try {
      parse(spec)
      return true
    } catch {
      return false
    }
  }

  // Check if it's GraphQL introspection result
  if (spec && typeof spec === 'object' && spec.__schema) {
    return true
  }

  // Check if it's our GraphQLSchema type
  if (spec && typeof spec === 'object' && spec.schema && typeof spec.schema === 'string') {
    return true
  }

  return false
}

// Pure function to parse GraphQL spec
export const parseGraphQLSpec = (spec: any): APISpec => {
  let schema: string
  let introspection: any

  if (typeof spec === 'string') {
    // SDL string
    schema = spec
    const gqlSchema = buildSchema(spec)
    introspection = introspectionFromSchema(gqlSchema)
  } else if (spec.__schema) {
    // Introspection result
    introspection = spec
    const gqlSchema = buildClientSchema(spec)
    schema = printSchema(gqlSchema)
  } else if (spec.schema) {
    // Our GraphQLSchema type
    schema = spec.schema
    introspection = spec.introspection || introspectionFromSchema(buildSchema(spec.schema))
  } else {
    throw new Error('Invalid GraphQL spec format')
  }

  return {
    type: 'graphql',
    version: '1.0', // GraphQL doesn't have versions like OpenAPI
    spec: { schema, introspection } as GraphQLSchemaType
  }
}

// Pure function to extract operations from GraphQL schema
export const extractGraphQLOperations = (spec: APISpec): APIOperation[] => {
  const graphqlSpec = spec.spec as GraphQLSchemaType
  const operations: APIOperation[] = []

  try {
    const schema = buildSchema(graphqlSpec.schema)

    // Extract queries
    const queryType = schema.getQueryType()
    if (queryType) {
      const queryOperations = extractOperationsFromType(queryType, 'query')
      operations.push(...queryOperations)
    }

    // Extract mutations
    const mutationType = schema.getMutationType()
    if (mutationType) {
      const mutationOperations = extractOperationsFromType(mutationType, 'mutation')
      operations.push(...mutationOperations)
    }

    // Extract subscriptions
    const subscriptionType = schema.getSubscriptionType()
    if (subscriptionType) {
      const subscriptionOperations = extractOperationsFromType(subscriptionType, 'subscription')
      operations.push(...subscriptionOperations)
    }

  } catch (error) {
    console.error('Error extracting GraphQL operations:', error)
  }

  return operations
}

// Pure function to match GraphQL request to operation
export const matchGraphQLRequest = (
  request: UnifiedRequest,
  operations: APIOperation[]
): APIOperation | null => {
  // GraphQL requests should go to /graphql endpoint or have GraphQL body
  if (!isGraphQLRequestPath(request) && !isGraphQLRequest(request)) {
    return null
  }

  const body = request.body as any
  if (!body || !body.query) {
    return null
  }

  try {
    // Parse the GraphQL query to find operation
    const document = parse(body.query)
    const operation = document.definitions.find(
      (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
    )

    if (!operation) {
      return null
    }

    // Handle introspection queries
    if (isIntrospectionQuery(operation)) {
      return createIntrospectionOperation()
    }

    const operationType = operation.operation // 'query', 'mutation', or 'subscription'
    const selections = operation.selectionSet.selections

    // Find the main field being queried/mutated
    for (const selection of selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value
        const operationId = generateOperationId(
          operationType === 'query' ? 'Query' :
          operationType === 'mutation' ? 'Mutation' : 'Subscription',
          fieldName
        )

        return operations.find(op => op.id === operationId) || null
      }
    }

  } catch (error) {
    console.error('Error parsing GraphQL query:', error)
  }

  return null
}

// Pure function to generate GraphQL response
export const generateGraphQLResponse = (
  operation: APIOperation,
  fixtures: Fixture[]
): UnifiedResponse => {
  // Handle introspection queries
  if (operation.id === '__introspection') {
    return generateIntrospectionResponse(operation)
  }

  // Find matching fixture for GraphQL operation
  const fixture = findBestGraphQLFixture(operation, fixtures)

  if (fixture) {
    const responseData = fixture.data.response as any
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        data: responseData.body || responseData
      },
      success: true
    }
  }

  // Generate mock response based on operation type
  return generateMockGraphQLResponse(operation)
}

// Pure function to validate GraphQL response
export const validateGraphQLResponse = (
  operation: APIOperation,
  expected: any,
  actual: any
): ValidationResult => {
  if (!actual) {
    return createValidationError(
      'response',
      'Response is null or undefined',
      expected,
      actual
    )
  }

  // GraphQL responses should have a data field
  if (!('data' in actual)) {
    return createValidationError(
      'response.data',
      'GraphQL response must have a data field',
      { data: expected },
      actual
    )
  }

  // If there are errors, they should be in the errors array
  if (actual.errors && !Array.isArray(actual.errors)) {
    return createValidationError(
      'response.errors',
      'GraphQL errors must be an array',
      [],
      actual.errors
    )
  }

  return createValidationSuccess()
}

// Pure function to generate mock data for GraphQL operation
export const generateGraphQLMockData = (operation: APIOperation): any => {
  const operationType = operation.type
  const fieldName = operation.id.split('.')[1]

  // Generate mock data based on operation
  if (operationType === 'query') {
    if (fieldName.startsWith('list')) {
      return [{ id: 'mock-id', name: 'Mock Item' }]
    } else if (fieldName.startsWith('get')) {
      return { id: 'mock-id', name: 'Mock Item' }
    }
  } else if (operationType === 'mutation') {
    if (fieldName.startsWith('create')) {
      return {
        [fieldName.replace('create', '').toLowerCase()]: { id: 'mock-id', name: 'Created Item' },
        errors: []
      }
    } else if (fieldName.startsWith('delete')) {
      return {
        success: true,
        errors: []
      }
    }
  }

  return null
}

// Pure function to get request schema (GraphQL doesn't have explicit request schemas)
export const getGraphQLRequestSchema = (operation: APIOperation): any => {
  return operation.request?.schema || null
}

// Pure function to get response schema
export const getGraphQLResponseSchema = (operation: APIOperation): any => {
  return operation.response?.schema || null
}

// Helper functions (pure)
const extractOperationsFromType = (
  type: GraphQLObjectType,
  operationType: 'query' | 'mutation' | 'subscription'
): APIOperation[] => {
  const operations: APIOperation[] = []
  const fields = type.getFields()

  for (const [fieldName, field] of Object.entries(fields)) {
    const operation: APIOperation = {
      id: generateOperationId(
        operationType === 'query' ? 'Query' :
        operationType === 'mutation' ? 'Mutation' : 'Subscription',
        fieldName
      ),
      type: operationType,
      description: field.description || undefined,
      request: extractGraphQLFieldRequestSchema(field),
      response: extractGraphQLFieldResponseSchema(field)
    }

    operations.push(operation)
  }

  return operations
}

const extractGraphQLFieldRequestSchema = (field: GraphQLField<any, any>): any => {
  if (field.args.length === 0) {
    return null
  }

  const requestSchema: any = {
    type: 'object',
    properties: {}
  }

  for (const arg of field.args) {
    requestSchema.properties[arg.name] = {
      type: getGraphQLTypeString(arg.type),
      description: arg.description
    }
  }

  return requestSchema
}

const extractGraphQLFieldResponseSchema = (field: GraphQLField<any, any>): any => {
  return {
    type: getGraphQLTypeString(field.type),
    description: field.description
  }
}

const getGraphQLTypeString = (type: any): string => {
  if (isNonNullType(type)) {
    return getGraphQLTypeString(type.ofType)
  }
  if (isListType(type)) {
    return 'array'
  }
  if (isObjectType(type)) {
    return 'object'
  }

  // Handle scalar types
  const typeName = type.name
  switch (typeName) {
    case 'String': return 'string'
    case 'Int': return 'integer'
    case 'Float': return 'number'
    case 'Boolean': return 'boolean'
    case 'ID': return 'string'
    default: return 'object'
  }
}

const isGraphQLRequestPath = (request: UnifiedRequest): boolean => {
  return request.path === '/graphql' ||
         (request.path?.endsWith('/graphql') ?? false)
}

const isIntrospectionQuery = (operation: OperationDefinitionNode): boolean => {
  const selections = operation.selectionSet.selections

  for (const selection of selections) {
    if (selection.kind === 'Field' && selection.name.value === '__schema') {
      return true
    }
  }

  return false
}

const createIntrospectionOperation = (): APIOperation => ({
  id: '__introspection',
  type: 'query',
  description: 'GraphQL introspection query'
})

const generateIntrospectionResponse = (operation: APIOperation): UnifiedResponse => {
  // This would return the full schema introspection
  // For now, return a basic response
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      data: {
        __schema: {
          types: [],
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          subscriptionType: null
        }
      }
    },
    success: true
  }
}

const findBestGraphQLFixture = (operation: APIOperation, fixtures: Fixture[]): Fixture | null => {
  // Find fixtures that match both operation and specType for isolation
  const matchingFixtures = fixtures.filter(f =>
    f.operation === operation.id &&
    f.specType === 'graphql'
  )

  if (matchingFixtures.length === 0) {
    return null
  }

  // Return highest priority fixture
  return matchingFixtures.sort((a, b) => {
    // Provider fixtures have higher priority than consumer fixtures
    if (a.source !== b.source) {
      const sourceOrder = { provider: 3, manual: 2, consumer: 1 }
      return sourceOrder[b.source] - sourceOrder[a.source]
    }

    return b.priority - a.priority
  })[0]
}

const generateMockGraphQLResponse = (operation: APIOperation): UnifiedResponse => {
  const mockData = generateGraphQLMockData(operation)

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      data: mockData
    },
    success: true
  }
}

// Create the GraphQL handler using the pure functions
export const createGraphQLHandler = (): SpecHandler => createSpecHandler({
  type: 'graphql',
  name: 'GraphQL',
  canHandle: canHandleGraphQL,
  parseSpec: parseGraphQLSpec,
  extractOperations: extractGraphQLOperations,
  matchRequest: matchGraphQLRequest,
  generateResponse: generateGraphQLResponse,
  validateResponse: validateGraphQLResponse,
  generateMockData: generateGraphQLMockData,
  getRequestSchema: getGraphQLRequestSchema,
  getResponseSchema: getGraphQLResponseSchema
})
```

#### 2.3 Update `packages/fixtures/src/spec-handlers/index.ts`

```typescript
export * from './types'
export * from './registry'
export * from './openapi'
export * from './graphql'  // Add this line

// Auto-register both handlers
import { createOpenAPIHandler } from './openapi'
import { createGraphQLHandler } from './graphql'  // Add this line
import { specRegistry } from './registry'

specRegistry.register(createOpenAPIHandler())
specRegistry.register(createGraphQLHandler())  // Add this line

// Export the singleton registry for convenience
export { specRegistry }
```

### Task 3: Implement GraphQL Auto-Detection (2 hours)

#### 3.1 Create `packages/consumer/src/mock-detector.ts`

```typescript
import type { UnifiedRequest, SpecType } from '@entente/types'
import { isGraphQLRequest, isHTTPRequest } from '@entente/fixtures'

// Pure function to detect request type from request properties
export const detectRequestType = (request: UnifiedRequest): SpecType | null => {
  // GraphQL detection
  if (isGraphQLRequestDetected(request)) {
    return 'graphql'
  }

  // WebSocket upgrade for AsyncAPI (future)
  if (isWebSocketUpgrade(request)) {
    return 'asyncapi'
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

  return path === '/graphql' ||
         path.endsWith('/graphql') ||
         path.includes('graphql')
}

// Pure function to check GraphQL content type
const isGraphQLContentType = (headers?: Record<string, string>): boolean => {
  if (!headers) return false

  const contentType = headers['content-type'] || headers['Content-Type'] || ''
  return contentType.includes('application/graphql')
}

// Pure function to detect WebSocket upgrade
const isWebSocketUpgrade = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const upgrade = request.headers['upgrade'] || request.headers['Upgrade']
  return upgrade === 'websocket'
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

    if (customRules?.grpcContentTypes?.some(ct =>
      request.headers?.['content-type']?.includes(ct)
    )) {
      return 'grpc'
    }

    // Fall back to default detection
    return detectRequestType(request)
  }
}

// Utility function to create enhanced unified request with detected type
export const createEnhancedRequest = (request: UnifiedRequest): UnifiedRequest & { detectedType?: SpecType } => {
  const detectedType = detectRequestType(request)
  return { ...request, detectedType }
}
```

#### 3.2 Update `packages/fixtures/src/spec-handlers/types.ts`

Add the enhanced GraphQL detection function:

```typescript
// Add this to the existing file
export const isGraphQLRequest = (request: UnifiedRequest): boolean => {
  const body = request.body as any

  // Check if body contains GraphQL query fields
  if (body && typeof body === 'object' && ('query' in body || 'mutation' in body)) {
    return true
  }

  // Check if body is a GraphQL query string
  if (typeof body === 'string' && (body.trim().startsWith('query') || body.trim().startsWith('mutation') || body.trim().startsWith('subscription'))) {
    return true
  }

  return false
}
```

### Task 4: Update Consumer Package for GraphQL (2 hours)

#### 4.1 Update `packages/consumer/src/index.ts`

Add GraphQL auto-detection to the mock server. Find the `createUnifiedMockServer` function and update it:

```typescript
// Add this import at the top
import { detectRequestType } from './mock-detector'

// Update the createUnifiedMockServer function to include auto-detection
const createUnifiedMockServer = async (
  spec: APISpec,
  mockHandlers: any[],
  port: number
): Promise<MockServer> => {
  const { createServer } = await import('node:http')
  const actualPort = port || 3000 + Math.floor(Math.random() * 1000)

  // Get spec handler for operation extraction
  const handler = specRegistry.getHandler(spec.type)
  if (!handler) {
    throw new Error(`No handler found for spec type: ${spec.type}`)
  }

  const operations = handler.extractOperations(spec)

  let httpServer: Server | null = null
  const requestHandlers: Array<(req: MockRequest, res: MockResponse) => Promise<void>> = []

  const startServer = async () => {
    httpServer = createServer(async (req, res) => {
      const startTime = Date.now()

      try {
        // Parse request
        const url = new URL(req.url || '/', `http://localhost:${actualPort}`)
        const method = req.method || 'GET'

        // Get headers
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') {
            headers[key.toLowerCase()] = value
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value.join(', ')
          }
        }

        // Get query parameters
        const query: Record<string, unknown> = {}
        for (const [key, value] of url.searchParams.entries()) {
          query[key] = value
        }

        // Get request body if present
        let body: unknown = undefined
        if (method !== 'GET' && method !== 'HEAD') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            const bodyText = Buffer.concat(chunks).toString()

            if (bodyText) {
              const contentType = headers['content-type'] || ''
              if (contentType.includes('application/json')) {
                body = JSON.parse(bodyText)
              } else if (contentType.includes('application/graphql')) {
                // Handle GraphQL queries sent as plain text
                body = { query: bodyText }
              } else {
                body = bodyText
              }
            }
          } catch {
            // Ignore body parsing errors
          }
        }

        // Convert to unified request format
        const unifiedRequest = convertHTTPToUnified(method, url.pathname, headers, query, body)

        // Auto-detect request type and override spec type if different
        const detectedType = detectRequestType(unifiedRequest)
        let activeHandler = handler
        let activeOperations = operations

        // If detected type differs from spec type, try to get the appropriate handler
        if (detectedType && detectedType !== spec.type) {
          const detectedHandler = specRegistry.getHandler(detectedType)
          if (detectedHandler) {
            console.log(`🔄 Auto-detected ${detectedType} request, switching from ${spec.type} handler`)
            activeHandler = detectedHandler

            // Use spec-specific operations for the detected type
            const detectedSpec = { ...spec, type: detectedType }
            try {
              activeOperations = detectedHandler.extractOperations(detectedSpec)
            } catch {
              // If extraction fails, fall back to original operations
              activeOperations = operations
            }
          }
        }

        // Handle request with appropriate handler
        const unifiedResponse = handleUnifiedMockRequest(unifiedRequest, mockHandlers)
        const httpResponse = convertUnifiedToHTTP(unifiedResponse)

        // Add headers for debugging
        res.setHeader('x-spec-type', spec.type)
        res.setHeader('x-detected-type', detectedType || 'unknown')

        // Set response headers
        res.statusCode = httpResponse.status
        for (const [key, value] of Object.entries(httpResponse.headers)) {
          res.setHeader(key, value)
        }

        // Send response
        const responseBody = typeof httpResponse.body === 'string'
          ? httpResponse.body
          : JSON.stringify(httpResponse.body)
        res.end(responseBody)

        const duration = Date.now() - startTime

        // Create mock objects for backward compatibility
        const mockReq: MockRequest = {
          method,
          path: url.pathname,
          headers,
          query,
          body
        }

        const mockRes: MockResponse = {
          status: httpResponse.status,
          headers: httpResponse.headers,
          body: httpResponse.body,
          duration
        }

        // Invoke all registered handlers
        for (const requestHandler of requestHandlers) {
          try {
            await requestHandler(mockReq, mockRes)
          } catch (handlerError) {
            console.error('Handler error:', handlerError)
          }
        }

      } catch (error) {
        console.error('Mock server error:', error)
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })

    await new Promise<void>((resolve, reject) => {
      httpServer!.listen(actualPort, (err?: Error) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  await startServer()

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    close: async () => {
      if (httpServer) {
        await new Promise<void>(resolve => {
          httpServer!.close(() => resolve())
        })
        httpServer = null
      }
    },
    onRequest: handler => {
      requestHandlers.push(handler)
    },
    getOperations: () => operations.map(op => ({
      method: op.method || '',
      path: op.path || '',
      operationId: op.id
    }))
  }
}
```

### Task 5: Update Server API for GraphQL Specs (1 hour)

#### 5.1 Update `apps/server/src/api/routes/specs.ts`

Add GraphQL support to the spec upload endpoint:

```typescript
// Add this import at the top
import { specRegistry } from '@entente/fixtures'

// Update the spec upload endpoint (around line 12)
specsRouter.post('/:service', async c => {
  const service = c.req.param('service')
  const body = await c.req.json()

  const { spec, metadata }: { spec: any; metadata: SpecMetadata } = body

  if (!spec || !metadata) {
    return c.json({ error: 'Missing spec or metadata' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')

  // Auto-detect spec type
  const detectedType = specRegistry.detectType(spec)
  if (!detectedType) {
    return c.json({ error: 'Unsupported specification format' }, 400)
  }

  console.log(`📋 Detected spec type: ${detectedType} for ${service}`)

  // Find the provider service for this service
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, metadata.service),
      eq(services.type, 'provider')
    ),
  })

  if (!provider) {
    return c.json(
      {
        error: `Provider service '${metadata.service}' not found. Please register the provider first using 'entente register-service -t provider'.`,
      },
      404
    )
  }

  // Ensure service version exists and get its ID
  const serviceVersionId = await ensureServiceVersion(
    db,
    tenantId,
    metadata.service,
    metadata.version,
    {
      spec: spec,
      gitSha: undefined,
      packageJson: undefined,
      createdBy: user?.name || 'spec-upload',
    }
  )

  // Check if spec already exists for this provider+version+environment+branch+specType
  const existingSpec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.providerId, provider.id),
      eq(specs.version, metadata.version),
      eq(specs.environment, metadata.environment),
      eq(specs.branch, metadata.branch),
      eq(specs.specType, detectedType)  // Add spec type to the query
    ),
  })

  let resultSpec: DbSpec
  let isNew = false

  if (existingSpec) {
    // Update existing spec
    const [updated] = await db
      .update(specs)
      .set({
        spec,
        specType: detectedType,  // Update spec type
        uploadedBy: metadata.uploadedBy,
        uploadedAt: new Date(),
      })
      .where(eq(specs.id, existingSpec.id))
      .returning()

    resultSpec = updated
    console.log(`📋 Updated ${detectedType} spec for ${service}@${metadata.version} (${metadata.environment})`)
  } else {
    // Create new spec
    const [created] = await db
      .insert(specs)
      .values({
        tenantId,
        providerId: provider.id,
        service: metadata.service,
        version: metadata.version,
        branch: metadata.branch,
        environment: metadata.environment,
        specType: detectedType,  // Set spec type
        spec,
        uploadedBy: metadata.uploadedBy,
      })
      .returning()

    resultSpec = created
    isNew = true
    console.log(`📋 Created new ${detectedType} spec for ${service}@${metadata.version} (${metadata.environment})`)
  }

  return c.json({
    id: resultSpec.id,
    service: resultSpec.service,
    version: resultSpec.version,
    specType: resultSpec.specType,  // Include spec type in response
    environment: resultSpec.environment,
    branch: resultSpec.branch,
    uploadedAt: resultSpec.uploadedAt,
    isNew
  })
})
```

### Task 6: Create GraphQL Playground Component (2 hours)

#### 6.1 Install GraphQL Dependencies for Server

Add to `apps/server/package.json`:

```json
{
  "dependencies": {
    "graphiql": "^3.0.6",
    "graphql": "^16.8.1"
  }
}
```

#### 6.2 Create `apps/server/src/ui/pages/GraphQLPlayground.tsx`

```tsx
import React, { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GraphiQL } from 'graphiql'
import { buildClientSchema, getIntrospectionQuery } from 'graphql'
import 'graphiql/graphiql.css'
import { createClient } from '@entente/consumer'

interface GraphQLPlaygroundProps {
  service?: string
  version?: string
}

export function GraphQLPlayground({ service, version }: GraphQLPlaygroundProps) {
  const params = useParams()
  const serviceName = service || params.service
  const serviceVersion = version || params.version

  const graphiqlRef = useRef<HTMLDivElement>(null)

  // Fetch the GraphQL spec
  const { data: spec, isLoading, error } = useQuery({
    queryKey: ['spec', serviceName, serviceVersion, 'graphql'],
    queryFn: async () => {
      const response = await fetch(`/api/specs/${serviceName}/by-provider-version?providerVersion=${serviceVersion}&environment=development`)
      if (!response.ok) {
        throw new Error('Failed to fetch GraphQL spec')
      }
      const data = await response.json()
      return data
    },
    enabled: !!(serviceName && serviceVersion)
  })

  // Create GraphQL fetcher for GraphiQL
  const createFetcher = async () => {
    if (!spec || spec.specType !== 'graphql') {
      throw new Error('Not a GraphQL service')
    }

    // Create a mock server for this GraphQL service
    const client = createClient({
      serviceUrl: window.location.origin,
      apiKey: 'playground-key',
      consumer: 'graphql-playground',
      consumerVersion: '1.0.0',
      environment: 'playground'
    })

    const mock = await client.createMock(serviceName!, serviceVersion!)

    return async (graphQLParams: any) => {
      try {
        const response = await fetch(`${mock.url}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(graphQLParams),
        })

        const result = await response.json()
        return result
      } catch (error) {
        return {
          errors: [{
            message: `Network error: ${error.message}`
          }]
        }
      }
    }
  }

  useEffect(() => {
    if (!spec || !graphiqlRef.current) return

    const setupGraphiQL = async () => {
      try {
        const fetcher = await createFetcher()

        // Get schema for GraphiQL
        let schema
        if (spec.spec.introspection) {
          schema = buildClientSchema(spec.spec.introspection)
        } else {
          // Fetch introspection
          const introspectionResult = await fetcher({
            query: getIntrospectionQuery()
          })
          if (introspectionResult.data) {
            schema = buildClientSchema(introspectionResult.data)
          }
        }

        // Render GraphiQL
        const graphiQLElement = React.createElement(GraphiQL, {
          fetcher,
          schema,
          defaultQuery: generateDefaultQuery(serviceName!),
          headerEditorEnabled: true,
          shouldPersistHeaders: true,
        })

        // This would typically be done with React DOM render, but since we're in a React component,
        // we'll use a different approach
      } catch (error) {
        console.error('Error setting up GraphiQL:', error)
      }
    }

    setupGraphiQL()
  }, [spec, serviceName, serviceVersion])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Loading GraphQL playground...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error loading GraphQL spec: {error.message}</span>
      </div>
    )
  }

  if (!spec || spec.specType !== 'graphql') {
    return (
      <div className="alert alert-warning">
        <span>This service does not have a GraphQL specification</span>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-base-200 p-4 border-b">
        <h1 className="text-2xl font-bold">GraphQL Playground</h1>
        <p className="text-base-content/70">
          {serviceName}@{serviceVersion} - Interactive GraphQL Explorer
        </p>
      </div>

      <div ref={graphiqlRef} className="flex-1">
        <GraphQLPlaygroundComponent
          spec={spec}
          serviceName={serviceName!}
          serviceVersion={serviceVersion!}
        />
      </div>
    </div>
  )
}

// Separate component for GraphiQL to handle the complex setup
function GraphQLPlaygroundComponent({
  spec,
  serviceName,
  serviceVersion
}: {
  spec: any
  serviceName: string
  serviceVersion: string
}) {
  const createFetcher = async () => {
    const client = createClient({
      serviceUrl: window.location.origin,
      apiKey: 'playground-key',
      consumer: 'graphql-playground',
      consumerVersion: '1.0.0',
      environment: 'playground'
    })

    const mock = await client.createMock(serviceName, serviceVersion)

    return async (graphQLParams: any) => {
      const response = await fetch(`${mock.url}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphQLParams),
      })

      return response.json()
    }
  }

  const [fetcher, setFetcher] = React.useState<any>(null)

  React.useEffect(() => {
    createFetcher().then(setFetcher)
  }, [serviceName, serviceVersion])

  if (!fetcher) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    )
  }

  return (
    <GraphiQL
      fetcher={fetcher}
      defaultQuery={generateDefaultQuery(serviceName)}
      headerEditorEnabled={true}
      shouldPersistHeaders={true}
    />
  )
}

// Helper function to generate default query based on service name
function generateDefaultQuery(serviceName: string): string {
  if (serviceName.includes('castle')) {
    return `# Welcome to GraphQL Playground for ${serviceName}
# Try running this query:

query GetCastles {
  listCastles {
    id
    name
    region
    yearBuilt
    description
  }
}

# Or try a single castle:
# query GetCastle {
#   getCastle(id: "123") {
#     id
#     name
#     region
#     yearBuilt
#   }
# }

# Create a new castle:
# mutation CreateCastle {
#   createCastle(input: {
#     name: "New Castle"
#     region: "Test Region"
#     yearBuilt: 2024
#   }) {
#     castle {
#       id
#       name
#     }
#     errors {
#       message
#     }
#   }
# }`
  }

  return `# Welcome to GraphQL Playground for ${serviceName}
# Enter your GraphQL queries here

query {
  # Add your queries here
}`
}
```

#### 6.3 Add GraphQL Playground Route

Update `apps/server/src/ui/App.tsx` to include the GraphQL playground route:

```tsx
// Add this import
import { GraphQLPlayground } from './pages/GraphQLPlayground'

// Add this route in the Routes section
<Route
  path="/services/:service/graphql-playground"
  element={
    <ProtectedRoute>
      <AdminLayout>
        <GraphQLPlayground />
      </AdminLayout>
    </ProtectedRoute>
  }
/>
```

### Task 7: Write Comprehensive GraphQL Tests (2 hours)

#### 7.1 Create `packages/fixtures/test/spec-handlers/graphql.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  canHandleGraphQL,
  parseGraphQLSpec,
  extractGraphQLOperations,
  matchGraphQLRequest,
  generateGraphQLResponse,
  validateGraphQLResponse,
  createGraphQLHandler
} from '../../src/spec-handlers/graphql'
import type { Fixture } from '@entente/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('GraphQL Functional Spec Handler', () => {
  // Load the test GraphQL schema
  const sampleGraphQLSchema = readFileSync(
    resolve(__dirname, '../specs/castles.graphql'),
    'utf-8'
  )

  describe('canHandleGraphQL', () => {
    it('should return true for GraphQL SDL strings', () => {
      expect(canHandleGraphQL(sampleGraphQLSchema)).toBe(true)
    })

    it('should return true for GraphQL introspection results', () => {
      const introspectionResult = {
        __schema: {
          types: [],
          queryType: { name: 'Query' }
        }
      }
      expect(canHandleGraphQL(introspectionResult)).toBe(true)
    })

    it('should return true for GraphQL schema objects', () => {
      const schemaObject = {
        schema: sampleGraphQLSchema,
        introspection: {}
      }
      expect(canHandleGraphQL(schemaObject)).toBe(true)
    })

    it('should return false for non-GraphQL specs', () => {
      expect(canHandleGraphQL({})).toBe(false)
      expect(canHandleGraphQL(null)).toBe(false)
      expect(canHandleGraphQL('invalid graphql')).toBe(false)
      expect(canHandleGraphQL({ openapi: '3.0.0' })).toBe(false)
    })
  })

  describe('parseGraphQLSpec', () => {
    it('should parse GraphQL SDL strings correctly', () => {
      const result = parseGraphQLSpec(sampleGraphQLSchema)

      expect(result.type).toBe('graphql')
      expect(result.version).toBe('1.0')
      expect(result.spec.schema).toBe(sampleGraphQLSchema)
      expect(result.spec.introspection).toBeDefined()
    })

    it('should parse GraphQL schema objects correctly', () => {
      const schemaObject = {
        schema: sampleGraphQLSchema,
        introspection: { test: 'data' }
      }

      const result = parseGraphQLSpec(schemaObject)

      expect(result.type).toBe('graphql')
      expect(result.spec.schema).toBe(sampleGraphQLSchema)
      expect(result.spec.introspection).toEqual({ test: 'data' })
    })
  })

  describe('extractGraphQLOperations', () => {
    it('should extract all operations from GraphQL schema', () => {
      const apiSpec = parseGraphQLSpec(sampleGraphQLSchema)
      const operations = extractGraphQLOperations(apiSpec)

      expect(operations.length).toBeGreaterThan(0)

      // Check for query operations
      const listCastlesOp = operations.find(op => op.id === 'Query.listCastles')
      expect(listCastlesOp).toBeDefined()
      expect(listCastlesOp?.type).toBe('query')

      const getCastleOp = operations.find(op => op.id === 'Query.getCastle')
      expect(getCastleOp).toBeDefined()
      expect(getCastleOp?.type).toBe('query')

      // Check for mutation operations
      const createCastleOp = operations.find(op => op.id === 'Mutation.createCastle')
      expect(createCastleOp).toBeDefined()
      expect(createCastleOp?.type).toBe('mutation')

      const deleteCastleOp = operations.find(op => op.id === 'Mutation.deleteCastle')
      expect(deleteCastleOp).toBeDefined()
      expect(deleteCastleOp?.type).toBe('mutation')
    })
  })

  describe('matchGraphQLRequest', () => {
    const apiSpec = parseGraphQLSpec(sampleGraphQLSchema)
    const operations = extractGraphQLOperations(apiSpec)

    it('should match GraphQL query requests', () => {
      const request = {
        method: 'POST',
        path: '/graphql',
        headers: { 'content-type': 'application/json' },
        body: {
          query: `
            query {
              listCastles {
                id
                name
                region
              }
            }
          `
        }
      }

      const matched = matchGraphQLRequest(request, operations)
      expect(matched?.id).toBe('Query.listCastles')
    })

    it('should match GraphQL mutation requests', () => {
      const request = {
        method: 'POST',
        path: '/graphql',
        headers: { 'content-type': 'application/json' },
        body: {
          query: `
            mutation CreateCastle($input: CreateCastleInput!) {
              createCastle(input: $input) {
                castle {
                  id
                  name
                }
              }
            }
          `,
          variables: {
            input: {
              name: 'Test Castle',
              region: 'Test',
              yearBuilt: 2024
            }
          }
        }
      }

      const matched = matchGraphQLRequest(request, operations)
      expect(matched?.id).toBe('Mutation.createCastle')
    })

    it('should handle introspection queries', () => {
      const request = {
        method: 'POST',
        path: '/graphql',
        headers: { 'content-type': 'application/json' },
        body: {
          query: `
            query IntrospectionQuery {
              __schema {
                types {
                  name
                }
              }
            }
          `
        }
      }

      const matched = matchGraphQLRequest(request, operations)
      expect(matched?.id).toBe('__introspection')
    })

    it('should return null for non-GraphQL requests', () => {
      const request = {
        method: 'GET',
        path: '/api/users',
        headers: {}
      }

      const matched = matchGraphQLRequest(request, operations)
      expect(matched).toBeNull()
    })
  })

  describe('generateGraphQLResponse', () => {
    const apiSpec = parseGraphQLSpec(sampleGraphQLSchema)
    const operations = extractGraphQLOperations(apiSpec)
    const listCastlesOp = operations.find(op => op.id === 'Query.listCastles')!

    it('should use fixture data when available', () => {
      const fixture: Fixture = {
        id: 'test-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        serviceVersions: ['1.0.0'],
        operation: 'Query.listCastles',
        status: 'approved',
        source: 'manual',
        priority: 1,
        data: {
          response: [
            { id: '1', name: 'Test Castle', region: 'Test', yearBuilt: 2000 }
          ]
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const response = generateGraphQLResponse(listCastlesOp, [fixture])

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toEqual([
        { id: '1', name: 'Test Castle', region: 'Test', yearBuilt: 2000 }
      ])
    })

    it('should use legacy OpenAPI fixtures for compatibility', () => {
      const legacyFixture: Fixture = {
        id: 'legacy-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        serviceVersions: ['1.0.0'],
        operation: 'listCastles', // OpenAPI operation ID
        status: 'approved',
        source: 'manual',
        priority: 1,
        data: {
          response: [
            { id: '1', name: 'Legacy Castle', region: 'Legacy', yearBuilt: 1900 }
          ]
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const response = generateGraphQLResponse(listCastlesOp, [legacyFixture])

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toEqual([
        { id: '1', name: 'Legacy Castle', region: 'Legacy', yearBuilt: 1900 }
      ])
    })

    it('should generate mock data when no fixtures available', () => {
      const response = generateGraphQLResponse(listCastlesOp, [])

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toBeDefined()
    })

    it('should handle introspection queries', () => {
      const introspectionOp = {
        id: '__introspection',
        type: 'query' as const,
        description: 'GraphQL introspection query'
      }

      const response = generateGraphQLResponse(introspectionOp, [])

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('__schema')
    })
  })

  describe('validateGraphQLResponse', () => {
    const apiSpec = parseGraphQLSpec(sampleGraphQLSchema)
    const operations = extractGraphQLOperations(apiSpec)
    const listCastlesOp = operations.find(op => op.id === 'Query.listCastles')!

    it('should validate successful GraphQL responses', () => {
      const expected = { data: [{ name: 'Test Castle' }] }
      const actual = { data: [{ name: 'Test Castle', id: '123' }] }

      const result = validateGraphQLResponse(listCastlesOp, expected, actual)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing data field', () => {
      const expected = { data: { test: 'value' } }
      const actual = { errors: ['Some error'] }

      const result = validateGraphQLResponse(listCastlesOp, expected, actual)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('response.data')
    })

    it('should validate error format', () => {
      const expected = { data: null, errors: [] }
      const actual = { data: null, errors: 'invalid format' }

      const result = validateGraphQLResponse(listCastlesOp, expected, actual)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('response.errors')
    })
  })

  describe('createGraphQLHandler (functional handler creation)', () => {
    it('should create a working GraphQL handler', () => {
      const handler = createGraphQLHandler()

      expect(handler.type).toBe('graphql')
      expect(handler.name).toBe('GraphQL')
      expect(typeof handler.canHandle).toBe('function')
      expect(typeof handler.parseSpec).toBe('function')
      expect(typeof handler.extractOperations).toBe('function')
    })

    it('should work end-to-end with the handler', () => {
      const handler = createGraphQLHandler()

      // Test the full flow
      expect(handler.canHandle(sampleGraphQLSchema)).toBe(true)

      const parsedSpec = handler.parseSpec(sampleGraphQLSchema)
      expect(parsedSpec.type).toBe('graphql')

      const operations = handler.extractOperations(parsedSpec)
      expect(operations.length).toBeGreaterThan(0)

      const request = {
        method: 'POST',
        path: '/graphql',
        body: {
          query: 'query { listCastles { id name } }'
        }
      }
      const matchedOp = handler.matchRequest(request, operations)
      expect(matchedOp?.id).toBe('Query.listCastles')

      const response = handler.generateResponse(matchedOp!, [])
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
    })
  })
})
```

#### 7.2 Create `packages/consumer/test/graphql-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '../src'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('GraphQL Integration Tests', () => {
  let client: any

  beforeAll(() => {
    client = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      consumer: 'test-consumer',
      consumerVersion: '1.0.0',
      environment: 'test'
    })
  })

  describe('GraphQL Mock Server', () => {
    let mock: any

    beforeAll(async () => {
      const schema = readFileSync(
        resolve(__dirname, '../test/specs/castles.graphql'),
        'utf-8'
      )

      // Upload GraphQL schema
      await client.uploadSpec('castle-service-graphql', '1.0.0', schema, {
        environment: 'test',
        branch: 'main'
      })

      mock = await client.createMock('castle-service-graphql', '1.0.0')
    })

    afterAll(async () => {
      await mock.close()
    })

    it('should handle GraphQL queries', async () => {
      const response = await fetch(`${mock.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              listCastles {
                id
                name
                region
                yearBuilt
              }
            }
          `
        })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-detected-type')).toBe('graphql')

      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('listCastles')
      expect(Array.isArray(data.data.listCastles)).toBe(true)
    })

    it('should handle GraphQL mutations', async () => {
      const response = await fetch(`${mock.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateCastle($input: CreateCastleInput!) {
              createCastle(input: $input) {
                castle {
                  id
                  name
                  region
                  yearBuilt
                }
                errors {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              name: 'Test Castle',
              region: 'Test Region',
              yearBuilt: 2024
            }
          }
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('createCastle')
    })

    it('should handle introspection queries', async () => {
      const response = await fetch(`${mock.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            {
              __schema {
                types {
                  name
                }
                queryType {
                  name
                }
                mutationType {
                  name
                }
              }
            }
          `
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveProperty('__schema')
      expect(data.data.__schema).toHaveProperty('types')
    })

    it('should auto-detect GraphQL requests to non-standard endpoints', async () => {
      const response = await fetch(`${mock.url}/api/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: '{ listCastles { id name } }'
        })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-detected-type')).toBe('graphql')
    })
  })

  describe('Cross-spec fixture compatibility', () => {
    it('should use OpenAPI fixtures for GraphQL operations', async () => {
      // This test would verify that a fixture created for 'listCastles' (OpenAPI)
      // can be used by 'Query.listCastles' (GraphQL)

      const openApiFixture = {
        id: 'test-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        operation: 'listCastles', // OpenAPI operation
        data: {
          response: [
            { id: '1', name: 'Fixture Castle', region: 'Fixture', yearBuilt: 1999 }
          ]
        }
      }

      const schema = readFileSync(
        resolve(__dirname, '../test/specs/castles.graphql'),
        'utf-8'
      )

      const mock = await client.createMock('castle-service-graphql', '1.0.0', {
        localFixtures: [openApiFixture]
      })

      const response = await fetch(`${mock.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: '{ listCastles { id name region yearBuilt } }'
        })
      })

      const data = await response.json()
      expect(data.data.listCastles).toEqual([
        { id: '1', name: 'Fixture Castle', region: 'Fixture', yearBuilt: 1999 }
      ])

      await mock.close()
    })
  })
})
```

## Testing Phase 2

### Run the Tests

```bash
# Install GraphQL dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run all tests to ensure no regressions
pnpm test

# Run the new GraphQL tests specifically
pnpm --filter @entente/fixtures test spec-handlers/graphql
pnpm --filter @entente/consumer test graphql-integration

# Test the GraphQL playground
pnpm --filter @entente/server dev
# Navigate to http://localhost:3000/services/castle-service/graphql-playground
```

### Manual Testing

1. **Test GraphQL Schema Upload**:
   ```bash
   # Upload the GraphQL schema using the CLI
   entente upload-spec \
     --service castle-service-graphql \
     --version 1.0.0 \
     --environment development \
     --spec packages/fixtures/test/specs/castles.graphql
   ```

2. **Test GraphQL Auto-Detection**:
   ```typescript
   import { detectRequestType } from '@entente/consumer/src/mock-detector'

   const graphqlRequest = {
     method: 'POST',
     path: '/graphql',
     body: { query: '{ listCastles { id } }' }
   }
   console.log(detectRequestType(graphqlRequest)) // Should log 'graphql'
   ```

3. **Test Cross-Spec Compatibility**:
   ```typescript
   // Create a mock with OpenAPI spec but send GraphQL request
   const mock = await client.createMock('castle-service', '1.0.0')

   const response = await fetch(`${mock.url}/custom-endpoint`, {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ query: '{ test }' })
   })

   console.log(response.headers.get('x-detected-type')) // Should be 'graphql'
   ```

## Acceptance Criteria

- [ ] GraphQL handler functions pass all tests
- [ ] GraphQL schemas can be uploaded and stored with correct spec type
- [ ] Auto-detection correctly identifies GraphQL requests
- [ ] GraphQL playground is functional and can execute queries
- [ ] GraphQL fixture isolation works (only GraphQL fixtures used by GraphQL)
- [ ] All existing OpenAPI tests continue to pass
- [ ] GraphQL responses follow proper format with data/errors fields
- [ ] Introspection queries are handled correctly
- [ ] Mock server can serve both OpenAPI and GraphQL from same instance

## Common Issues and Solutions

### Issue: GraphQL parsing errors
**Solution**: Ensure the GraphQL schema is valid SDL. Use online validators or GraphQL tools to verify syntax.

### Issue: Auto-detection not working
**Solution**: Verify the detection logic in `mock-detector.ts` and ensure it checks for all GraphQL indicators (path, body, headers).

### Issue: Playground not loading
**Solution**: Check that GraphiQL dependencies are installed and that the fetcher is properly configured to use the mock server.

### Issue: Fixtures not working across specs
**Solution**: Verify the operation mapping logic that converts GraphQL operations (e.g., `Query.listCastles`) to OpenAPI operations (e.g., `listCastles`).

---

**Next Phase**: [Phase 3: AsyncAPI Support](./phase-3-asyncapi-support.md)