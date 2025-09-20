---
title: "Phase 1: Core Infrastructure"
description: "Implement the foundational functional spec abstraction layer and refactor existing OpenAPI code"
---

# Phase 1: Core Infrastructure

**Duration**: 1 Week
**Prerequisites**: Understanding of TypeScript, OpenAPI, functional programming, and Drizzle ORM
**Goal**: Create a unified specification abstraction layer using functional patterns that can support multiple API spec types

## Overview

Phase 1 establishes the foundational architecture for multi-spec support using functional programming patterns. We'll create pure functions for spec handling, implement the OpenAPI handler, and update the database schema to support multiple specification types.

## Task Breakdown

### Task 1: Create Unified Type Definitions (2 hours)

#### 1.1 Create `packages/types/src/specs.ts`

```typescript
// Base types for any API specification
export type SpecType = 'openapi' | 'graphql' | 'asyncapi' | 'grpc' | 'soap'

export interface APISpec {
  type: SpecType
  version: string
  spec: OpenAPISpec | GraphQLSchema | AsyncAPISpec | GRPCProto | SOAPWsdl
  metadata?: SpecMetadata
}

export interface GraphQLSchema {
  schema: string // SDL (Schema Definition Language) string
  introspection?: any // GraphQL introspection result
}

export interface AsyncAPISpec {
  asyncapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  channels: Record<string, any>
  components?: {
    schemas?: Record<string, any>
    messages?: Record<string, any>
  }
}

export interface GRPCProto {
  proto: string // Proto file content
  services: string[] // Service names defined in proto
  package?: string // Package name
}

export interface SOAPWsdl {
  wsdl: string // WSDL XML content
  services: string[] // Service names
  targetNamespace?: string
}

// Operation abstraction across all spec types
export interface APIOperation {
  id: string // Unique operation identifier
  type: 'query' | 'mutation' | 'subscription' | 'rest' | 'event' | 'rpc'
  method?: string // HTTP method for REST APIs
  path?: string // URL path for REST APIs
  channel?: string // Channel name for event-based APIs
  service?: string // Service name for RPC APIs
  request?: OperationSchema
  response?: OperationSchema
  errors?: OperationSchema[]
  deprecated?: boolean
  description?: string
}

export interface OperationSchema {
  type: string
  schema?: any // JSON Schema, GraphQL type, or other schema representation
  example?: any
  required?: boolean
}

// Request/Response types that work across all spec types
export interface UnifiedRequest {
  // HTTP-specific fields
  method?: string
  path?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown

  // GraphQL-specific fields
  operationName?: string
  variables?: Record<string, unknown>

  // Event-specific fields
  channel?: string
  eventType?: string

  // RPC-specific fields
  service?: string
  procedure?: string
}

export interface UnifiedResponse {
  // HTTP-specific fields
  status?: number
  headers?: Record<string, string>
  body?: unknown

  // GraphQL-specific fields
  data?: unknown
  errors?: Array<{
    message: string
    path?: (string | number)[]
    extensions?: Record<string, unknown>
  }>

  // Event-specific fields
  eventId?: string
  timestamp?: Date

  // Common fields
  duration?: number
  success?: boolean
}

// Validation result type
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  path: string
  message: string
  expected?: any
  actual?: any
  code?: string
}

// Functional spec handler interface (replaces class-based approach)
export interface SpecHandler {
  readonly type: SpecType
  readonly name: string
  canHandle: (spec: any) => boolean
  parseSpec: (spec: any) => APISpec
  extractOperations: (spec: APISpec) => APIOperation[]
  matchRequest: (request: UnifiedRequest, operations: APIOperation[]) => APIOperation | null
  generateResponse: (operation: APIOperation, fixtures: Fixture[]) => UnifiedResponse
  validateResponse: (operation: APIOperation, expected: any, actual: any) => ValidationResult
  generateMockData: (operation: APIOperation) => any
  getRequestSchema: (operation: APIOperation) => any
  getResponseSchema: (operation: APIOperation) => any
}

// Registry functions interface
export interface SpecRegistry {
  register: (handler: SpecHandler) => void
  getHandler: (type: SpecType) => SpecHandler | null
  detectType: (spec: any) => SpecType | null
  getAllHandlers: () => SpecHandler[]
  getSupportedTypes: () => SpecType[]
  parseSpec: (spec: any) => APISpec | null
}
```

#### 1.2 Update `packages/types/src/index.ts`

Add the new exports to the existing file:

```typescript
// Add these exports at the end of the file
export type {
  SpecType,
  APISpec,
  GraphQLSchema,
  AsyncAPISpec,
  GRPCProto,
  SOAPWsdl,
  APIOperation,
  OperationSchema,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
  ValidationError,
  SpecHandler,
  SpecRegistry,
} from './specs'
```

### Task 2: Create Functional Spec Handler System (4 hours)

#### 2.1 Create `packages/fixtures/src/spec-handlers/types.ts`

```typescript
import type {
  APISpec,
  APIOperation,
  SpecType,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
  ValidationError,
  Fixture
} from '@entente/types'

// Helper functions available to all handlers
export const generateOperationId = (prefix: string, name: string): string => {
  return `${prefix}.${name}`
}

export const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value
  }
  return normalized
}

export const parseContentType = (contentType: string): { type: string; charset?: string } => {
  const [type, ...params] = contentType.split(';').map(s => s.trim())
  const charset = params
    .find(p => p.startsWith('charset='))
    ?.split('=')[1]

  return { type: type.toLowerCase(), charset }
}

export const createValidationError = (
  path: string,
  message: string,
  expected?: any,
  actual?: any,
  code?: string
): ValidationResult => {
  return {
    valid: false,
    errors: [{
      path,
      message,
      expected,
      actual,
      code
    }]
  }
}

export const createValidationSuccess = (): ValidationResult => {
  return {
    valid: true,
    errors: []
  }
}

export const combineValidationResults = (results: ValidationResult[]): ValidationResult => {
  const allErrors = results.flatMap(r => r.errors)
  return {
    valid: allErrors.length === 0,
    errors: allErrors
  }
}

// Higher-order function to create a spec handler
export const createSpecHandler = (config: {
  type: SpecType
  name: string
  canHandle: (spec: any) => boolean
  parseSpec: (spec: any) => APISpec
  extractOperations: (spec: APISpec) => APIOperation[]
  matchRequest: (request: UnifiedRequest, operations: APIOperation[]) => APIOperation | null
  generateResponse: (operation: APIOperation, fixtures: Fixture[]) => UnifiedResponse
  validateResponse: (operation: APIOperation, expected: any, actual: any) => ValidationResult
  generateMockData: (operation: APIOperation) => any
  getRequestSchema: (operation: APIOperation) => any
  getResponseSchema: (operation: APIOperation) => any
}) => config

// Type guard functions
export const isHTTPRequest = (request: UnifiedRequest): boolean => {
  return !!(request.method && request.path)
}

export const isGraphQLRequest = (request: UnifiedRequest): boolean => {
  return !!(request.body &&
           typeof request.body === 'object' &&
           ('query' in request.body || 'mutation' in request.body))
}

export const isEventRequest = (request: UnifiedRequest): boolean => {
  return !!(request.channel && request.eventType)
}

export const isRPCRequest = (request: UnifiedRequest): boolean => {
  return !!(request.service && request.procedure)
}
```

#### 2.2 Create `packages/fixtures/src/spec-handlers/registry.ts`

```typescript
import type { SpecType, SpecHandler, SpecRegistry, APISpec } from '@entente/types'

// Pure function to find spec type from available handlers
export const findSpecType = (spec: any, handlers: SpecHandler[]): SpecType | null => {
  for (const handler of handlers) {
    if (handler.canHandle(spec)) {
      return handler.type
    }
  }
  return null
}

// Factory function to create a spec registry
export const createSpecRegistry = (): SpecRegistry => {
  const handlers = new Map<SpecType, SpecHandler>()

  return {
    register: (handler: SpecHandler): void => {
      if (handlers.has(handler.type)) {
        throw new Error(`Handler for ${handler.type} already registered`)
      }
      handlers.set(handler.type, handler)
    },

    getHandler: (type: SpecType): SpecHandler | null => {
      return handlers.get(type) || null
    },

    detectType: (spec: any): SpecType | null => {
      return findSpecType(spec, Array.from(handlers.values()))
    },

    getAllHandlers: (): SpecHandler[] => {
      return Array.from(handlers.values())
    },

    getSupportedTypes: (): SpecType[] => {
      return Array.from(handlers.keys())
    },

    parseSpec: (spec: any): APISpec | null => {
      const type = findSpecType(spec, Array.from(handlers.values()))
      if (!type) return null

      const handler = handlers.get(type)
      if (!handler) return null

      return handler.parseSpec(spec)
    }
  }
}

// Singleton registry instance
export const specRegistry = createSpecRegistry()
```

#### 2.3 Create `packages/fixtures/src/spec-handlers/openapi.ts`

```typescript
import type {
  APISpec,
  APIOperation,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
  Fixture,
  OpenAPISpec,
  SpecHandler
} from '@entente/types'
import {
  createSpecHandler,
  generateOperationId,
  normalizeHeaders,
  createValidationError,
  createValidationSuccess
} from './types'

// Pure function to check if spec is OpenAPI
export const canHandleOpenAPI = (spec: any): boolean => {
  return spec &&
         typeof spec === 'object' &&
         ('openapi' in spec || 'swagger' in spec)
}

// Pure function to parse OpenAPI spec
export const parseOpenAPISpec = (spec: any): APISpec => {
  const openApiSpec = spec as OpenAPISpec
  return {
    type: 'openapi',
    version: openApiSpec.openapi || openApiSpec.swagger || '3.0.0',
    spec: openApiSpec
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
      if (!operation || typeof operation !== 'object' || !operation.operationId) {
        continue
      }

      const apiOperation: APIOperation = {
        id: operation.operationId,
        type: 'rest',
        method: method.toUpperCase(),
        path,
        description: operation.summary || operation.description,
        deprecated: operation.deprecated || false,
        request: extractRequestSchema(operation),
        response: extractResponseSchema(operation),
        errors: extractErrorSchemas(operation)
      }

      operations.push(apiOperation)
    }
  }

  return operations
}

// Pure function to match HTTP request to OpenAPI operation
export const matchOpenAPIRequest = (
  request: UnifiedRequest,
  operations: APIOperation[]
): APIOperation | null => {
  if (!request.method || !request.path) {
    return null
  }

  // First try exact path match
  let matchedOp = operations.find(op =>
    op.method === request.method && op.path === request.path
  )

  // If no exact match, try pattern matching for path parameters
  if (!matchedOp) {
    matchedOp = operations.find(op =>
      op.method === request.method && pathMatches(op.path!, request.path!)
    )
  }

  return matchedOp || null
}

// Pure function to generate response from operation and fixtures
export const generateOpenAPIResponse = (
  operation: APIOperation,
  fixtures: Fixture[]
): UnifiedResponse => {
  // Find the most appropriate fixture for this operation
  const fixture = findBestFixture(operation, fixtures)

  if (fixture && fixture.data.response) {
    const responseData = fixture.data.response as any
    return {
      status: responseData.status || 200,
      headers: responseData.headers || { 'content-type': 'application/json' },
      body: responseData.body,
      success: (responseData.status || 200) < 400
    }
  }

  // Generate mock response from OpenAPI schema
  return generateMockOpenAPIResponse(operation)
}

// Pure function to validate OpenAPI response
export const validateOpenAPIResponse = (
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
    data: null
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

  const response = operation.responses['200'] ||
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
    const statusCode = parseInt(status, 10)
    if (statusCode >= 400 && response && typeof response === 'object') {
      errorSchemas.push({
        status: statusCode,
        schema: response
      })
    }
  }

  return errorSchemas
}

const pathMatches = (specPath: string, requestPath: string): boolean => {
  const specSegments = specPath.split('/')
  const requestSegments = requestPath.split('/')

  if (specSegments.length !== requestSegments.length) {
    return false
  }

  for (let i = 0; i < specSegments.length; i++) {
    const specSegment = specSegments[i]
    const requestSegment = requestSegments[i]

    if (specSegment.startsWith('{') && specSegment.endsWith('}')) {
      continue
    }

    if (specSegment !== requestSegment) {
      return false
    }
  }

  return true
}

const findBestFixture = (operation: APIOperation, fixtures: Fixture[]): Fixture | null => {
  // Filter fixtures by both operation and specType for isolation
  const matchingFixtures = fixtures.filter(f =>
    f.operation === operation.id &&
    f.specType === 'openapi'
  )

  if (matchingFixtures.length === 0) {
    return null
  }

  return matchingFixtures.sort((a, b) => {
    // Provider fixtures have higher priority than consumer fixtures
    if (a.source !== b.source) {
      const sourceOrder = { provider: 3, manual: 2, consumer: 1 }
      return sourceOrder[b.source] - sourceOrder[a.source]
    }

    return b.priority - a.priority
  })[0]
}

const generateMockOpenAPIResponse = (operation: APIOperation): UnifiedResponse => {
  let body: any = null
  let status = 200

  if (operation.method === 'POST') {
    status = 201
    body = { id: 'mock-id', message: 'Created successfully' }
  } else if (operation.method === 'DELETE') {
    status = 204
    body = null
  } else if (operation.method === 'GET') {
    if (operation.path?.includes('{')) {
      body = { id: 'mock-id', name: 'Mock Resource' }
    } else {
      body = [{ id: 'mock-id', name: 'Mock Resource' }]
    }
  }

  return {
    status,
    headers: { 'content-type': 'application/json' },
    body,
    success: status < 400
  }
}

// Create the OpenAPI handler using the pure functions
export const createOpenAPIHandler = (): SpecHandler => createSpecHandler({
  type: 'openapi',
  name: 'OpenAPI/Swagger',
  canHandle: canHandleOpenAPI,
  parseSpec: parseOpenAPISpec,
  extractOperations: extractOpenAPIOperations,
  matchRequest: matchOpenAPIRequest,
  generateResponse: generateOpenAPIResponse,
  validateResponse: validateOpenAPIResponse,
  generateMockData: generateOpenAPIMockData,
  getRequestSchema: getOpenAPIRequestSchema,
  getResponseSchema: getOpenAPIResponseSchema
})
```

#### 2.4 Create `packages/fixtures/src/spec-handlers/index.ts`

```typescript
export * from './types'
export * from './registry'
export * from './openapi'

// Auto-register the OpenAPI handler
import { createOpenAPIHandler } from './openapi'
import { specRegistry } from './registry'

specRegistry.register(createOpenAPIHandler())

// Export the singleton registry for convenience
export { specRegistry }
```

### Task 3: Update Database Schema (1 hour)

#### 3.1 Update `apps/server/src/db/schema/specs.ts`

```typescript
import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { services } from './services'
import { tenants } from './tenants'

export const specs = pgTable('specs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  providerId: uuid('provider_id')
    .references(() => services.id)
    .notNull(),
  service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
  version: varchar('version', { length: 100 }).notNull(),
  branch: varchar('branch', { length: 255 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),

  // NEW: Support for different specification types
  specType: varchar('spec_type', { length: 20 })
    .notNull()
    .default('openapi'), // 'openapi', 'graphql', 'asyncapi', 'grpc', 'soap'

  spec: jsonb('spec').notNull(), // Can store any spec type as JSON
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
})
```

#### 3.2 Create Migration File

Create `apps/server/src/db/migrations/add-spec-type.sql`:

```sql
-- Add specType column to specs table
ALTER TABLE specs
ADD COLUMN spec_type VARCHAR(20) NOT NULL DEFAULT 'openapi';

-- Add check constraint to ensure valid spec types
ALTER TABLE specs
ADD CONSTRAINT specs_spec_type_check
CHECK (spec_type IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));

-- Add index for better query performance
CREATE INDEX idx_specs_spec_type ON specs (spec_type);
CREATE INDEX idx_specs_service_type ON specs (service, spec_type);
```

#### 3.3 Update Database Types

Update `apps/server/src/db/types.ts`:

```typescript
import type { SpecType } from '@entente/types'

export interface DbSpec {
  id: string
  tenantId: string
  providerId: string
  service: string
  version: string
  branch: string
  environment: string
  specType: SpecType  // NEW: Add this field
  spec: any
  uploadedBy: string
  uploadedAt: Date
}

// Add to existing exports...
```

### Task 4: Update Fixtures Package (2 hours)

#### 4.1 Update `packages/fixtures/src/index.ts`

Add the new exports:

```typescript
// Add these exports to the existing file
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
  isRPCRequest
} from './spec-handlers/types'

export {
  createSpecRegistry,
  findSpecType,
  specRegistry
} from './spec-handlers/registry'

export {
  canHandleOpenAPI,
  parseOpenAPISpec,
  extractOpenAPIOperations,
  matchOpenAPIRequest,
  generateOpenAPIResponse,
  validateOpenAPIResponse,
  generateOpenAPIMockData,
  getOpenAPIRequestSchema,
  getOpenAPIResponseSchema,
  createOpenAPIHandler
} from './spec-handlers/openapi'

// Update existing mock handler exports to use new system
export { createUnifiedMockHandler, handleUnifiedMockRequest } from './mock-handlers'
```

#### 4.2 Create `packages/fixtures/src/mock-handlers.ts`

```typescript
import type {
  UnifiedRequest,
  UnifiedResponse,
  Fixture,
  APISpec,
  APIOperation,
  SpecHandler
} from '@entente/types'
import { specRegistry } from './spec-handlers'

export interface MockHandler {
  match: (request: UnifiedRequest) => boolean
  respond: (request: UnifiedRequest) => UnifiedResponse
}

// Pure function to create mock handlers from spec and fixtures
export const createUnifiedMockHandler = (
  spec: APISpec,
  fixtures: Fixture[]
): MockHandler[] => {
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
      const matchedOp = handler.matchRequest(request, [operation])
      return matchedOp?.id === operation.id
    },
    respond: (request: UnifiedRequest) => {
      return handler.generateResponse(operation, fixtures)
    }
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
    message: 'No matching operation found for request'
  },
  success: false
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
  body
})

export const convertUnifiedToHTTP = (response: UnifiedResponse): {
  status: number
  headers: Record<string, string>
  body: unknown
} => ({
  status: response.status || 200,
  headers: response.headers || {},
  body: response.body
})
```

### Task 5: Create Test Specification Files (1 hour)

#### 5.1 Create `packages/fixtures/test/specs/castles-openapi.json`

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Castle Service API",
    "version": "1.0.0",
    "description": "A simple API for managing French castles"
  },
  "servers": [
    {
      "url": "http://localhost:4001",
      "description": "Development server"
    }
  ],
  "paths": {
    "/castles": {
      "get": {
        "operationId": "listCastles",
        "summary": "List all castles",
        "responses": {
          "200": {
            "description": "List of castles",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Castle"
                  }
                },
                "example": [
                  {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Château de Versailles",
                    "region": "Île-de-France",
                    "yearBuilt": 1623
                  }
                ]
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createCastle",
        "summary": "Create a new castle",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateCastleRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Castle created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Castle"
                }
              }
            }
          },
          "400": {
            "description": "Invalid input",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/castles/{id}": {
      "get": {
        "operationId": "getCastle",
        "summary": "Get a castle by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Castle details",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Castle"
                }
              }
            }
          },
          "404": {
            "description": "Castle not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "delete": {
        "operationId": "deleteCastle",
        "summary": "Delete a castle",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Castle deleted successfully"
          },
          "404": {
            "description": "Castle not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Castle": {
        "type": "object",
        "required": ["id", "name", "region", "yearBuilt"],
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for the castle"
          },
          "name": {
            "type": "string",
            "description": "Name of the castle"
          },
          "region": {
            "type": "string",
            "description": "French region where the castle is located"
          },
          "yearBuilt": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 2100,
            "description": "Year the castle was built"
          },
          "description": {
            "type": "string",
            "description": "Optional description of the castle"
          }
        }
      },
      "CreateCastleRequest": {
        "type": "object",
        "required": ["name", "region", "yearBuilt"],
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "Name of the castle"
          },
          "region": {
            "type": "string",
            "minLength": 1,
            "description": "French region where the castle is located"
          },
          "yearBuilt": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 2100,
            "description": "Year the castle was built"
          },
          "description": {
            "type": "string",
            "description": "Optional description of the castle"
          }
        }
      },
      "Error": {
        "type": "object",
        "required": ["error", "message"],
        "properties": {
          "error": {
            "type": "string",
            "description": "Error code"
          },
          "message": {
            "type": "string",
            "description": "Human-readable error message"
          }
        }
      }
    }
  }
}
```

### Task 6: Write Comprehensive Tests (3 hours)

#### 6.1 Create `packages/fixtures/test/spec-handlers/openapi.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  canHandleOpenAPI,
  parseOpenAPISpec,
  extractOpenAPIOperations,
  matchOpenAPIRequest,
  generateOpenAPIResponse,
  validateOpenAPIResponse,
  createOpenAPIHandler
} from '../../src/spec-handlers/openapi'
import type { OpenAPISpec, Fixture } from '@entente/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('OpenAPI Functional Spec Handler', () => {
  // Load the test spec
  const sampleOpenAPISpec: OpenAPISpec = JSON.parse(
    readFileSync(resolve(__dirname, '../specs/castles-openapi.json'), 'utf-8')
  )

  describe('canHandleOpenAPI', () => {
    it('should return true for OpenAPI 3.x specs', () => {
      expect(canHandleOpenAPI(sampleOpenAPISpec)).toBe(true)
    })

    it('should return true for Swagger 2.x specs', () => {
      const swaggerSpec = { swagger: '2.0', info: { title: 'Test', version: '1.0.0' } }
      expect(canHandleOpenAPI(swaggerSpec)).toBe(true)
    })

    it('should return false for non-OpenAPI specs', () => {
      expect(canHandleOpenAPI({})).toBe(false)
      expect(canHandleOpenAPI(null)).toBe(false)
      expect(canHandleOpenAPI('not an object')).toBe(false)
    })
  })

  describe('parseOpenAPISpec', () => {
    it('should parse OpenAPI spec correctly', () => {
      const result = parseOpenAPISpec(sampleOpenAPISpec)

      expect(result.type).toBe('openapi')
      expect(result.version).toBe('3.0.3')
      expect(result.spec).toBe(sampleOpenAPISpec)
    })
  })

  describe('extractOpenAPIOperations', () => {
    it('should extract all operations from spec', () => {
      const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
      const operations = extractOpenAPIOperations(apiSpec)

      expect(operations).toHaveLength(4) // listCastles, createCastle, getCastle, deleteCastle

      const listOp = operations.find(op => op.id === 'listCastles')
      expect(listOp).toBeDefined()
      expect(listOp?.method).toBe('GET')
      expect(listOp?.path).toBe('/castles')
      expect(listOp?.type).toBe('rest')

      const createOp = operations.find(op => op.id === 'createCastle')
      expect(createOp).toBeDefined()
      expect(createOp?.method).toBe('POST')
      expect(createOp?.path).toBe('/castles')

      const getOp = operations.find(op => op.id === 'getCastle')
      expect(getOp).toBeDefined()
      expect(getOp?.method).toBe('GET')
      expect(getOp?.path).toBe('/castles/{id}')

      const deleteOp = operations.find(op => op.id === 'deleteCastle')
      expect(deleteOp).toBeDefined()
      expect(deleteOp?.method).toBe('DELETE')
      expect(deleteOp?.path).toBe('/castles/{id}')
    })
  })

  describe('matchOpenAPIRequest', () => {
    const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
    const operations = extractOpenAPIOperations(apiSpec)

    it('should match exact paths', () => {
      const request = {
        method: 'GET',
        path: '/castles'
      }

      const matched = matchOpenAPIRequest(request, operations)
      expect(matched?.id).toBe('listCastles')
    })

    it('should match path parameters', () => {
      const request = {
        method: 'GET',
        path: '/castles/123'
      }

      const matched = matchOpenAPIRequest(request, operations)
      expect(matched?.id).toBe('getCastle')
    })

    it('should return null for non-matching requests', () => {
      const request = {
        method: 'GET',
        path: '/unknown'
      }

      const matched = matchOpenAPIRequest(request, operations)
      expect(matched).toBeNull()
    })
  })

  describe('generateOpenAPIResponse', () => {
    const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
    const operations = extractOpenAPIOperations(apiSpec)
    const listOp = operations.find(op => op.id === 'listCastles')!

    it('should use fixture data when available', () => {
      const fixture: Fixture = {
        id: 'test-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        serviceVersions: ['1.0.0'],
        specType: 'openapi',
        operation: 'listCastles',
        status: 'approved',
        source: 'manual',
        priority: 1,
        data: {
          response: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: [{ id: '1', name: 'Test Castle', region: 'Test', yearBuilt: 2000 }]
          }
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const response = generateOpenAPIResponse(listOp, [fixture])

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        { id: '1', name: 'Test Castle', region: 'Test', yearBuilt: 2000 }
      ])
    })

    it('should generate mock data when no fixtures available', () => {
      const response = generateOpenAPIResponse(listOp, [])

      expect(response.status).toBe(200)
      expect(response.headers?.['content-type']).toBe('application/json')
      expect(response.body).toBeDefined()
    })
  })

  describe('validateOpenAPIResponse', () => {
    const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
    const operations = extractOpenAPIOperations(apiSpec)
    const listOp = operations.find(op => op.id === 'listCastles')!

    it('should validate successful responses', () => {
      const expected = { name: 'Test Castle' }
      const actual = { name: 'Test Castle', id: '123' }

      const result = validateOpenAPIResponse(listOp, expected, actual)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const expected = { name: 'Test Castle', region: 'Test' }
      const actual = { name: 'Test Castle' } // missing region

      const result = validateOpenAPIResponse(listOp, expected, actual)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('response.region')
    })
  })

  describe('createOpenAPIHandler (functional handler creation)', () => {
    it('should create a working OpenAPI handler', () => {
      const handler = createOpenAPIHandler()

      expect(handler.type).toBe('openapi')
      expect(handler.name).toBe('OpenAPI/Swagger')
      expect(typeof handler.canHandle).toBe('function')
      expect(typeof handler.parseSpec).toBe('function')
      expect(typeof handler.extractOperations).toBe('function')
    })

    it('should work end-to-end with the handler', () => {
      const handler = createOpenAPIHandler()

      // Test the full flow
      expect(handler.canHandle(sampleOpenAPISpec)).toBe(true)

      const parsedSpec = handler.parseSpec(sampleOpenAPISpec)
      expect(parsedSpec.type).toBe('openapi')

      const operations = handler.extractOperations(parsedSpec)
      expect(operations.length).toBeGreaterThan(0)

      const request = { method: 'GET', path: '/castles' }
      const matchedOp = handler.matchRequest(request, operations)
      expect(matchedOp?.id).toBe('listCastles')

      const response = handler.generateResponse(matchedOp!, [])
      expect(response.status).toBe(200)
    })
  })
})
```

#### 6.2 Create `packages/fixtures/test/spec-handlers/registry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createSpecRegistry, findSpecType } from '../../src/spec-handlers/registry'
import { createOpenAPIHandler } from '../../src/spec-handlers/openapi'
import type { SpecRegistry } from '@entente/types'

describe('Functional Spec Registry', () => {
  let registry: SpecRegistry

  beforeEach(() => {
    registry = createSpecRegistry()
  })

  describe('registration', () => {
    it('should register handlers successfully', () => {
      const handler = createOpenAPIHandler()
      registry.register(handler)

      expect(registry.getHandler('openapi')).toBe(handler)
      expect(registry.getSupportedTypes()).toContain('openapi')
    })

    it('should throw error when registering duplicate handlers', () => {
      const handler1 = createOpenAPIHandler()
      const handler2 = createOpenAPIHandler()

      registry.register(handler1)

      expect(() => registry.register(handler2)).toThrow(
        'Handler for openapi already registered'
      )
    })
  })

  describe('detection', () => {
    beforeEach(() => {
      registry.register(createOpenAPIHandler())
    })

    it('should detect OpenAPI specs', () => {
      const openApiSpec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {}
      }

      expect(registry.detectType(openApiSpec)).toBe('openapi')
    })

    it('should return null for unknown specs', () => {
      const unknownSpec = { unknown: 'spec' }

      expect(registry.detectType(unknownSpec)).toBeNull()
    })
  })

  describe('findSpecType (pure function)', () => {
    it('should find spec type from handlers array', () => {
      const handlers = [createOpenAPIHandler()]
      const openApiSpec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {}
      }

      expect(findSpecType(openApiSpec, handlers)).toBe('openapi')
    })

    it('should return null when no handler matches', () => {
      const handlers = [createOpenAPIHandler()]
      const unknownSpec = { unknown: 'spec' }

      expect(findSpecType(unknownSpec, handlers)).toBeNull()
    })
  })

  describe('parseSpec', () => {
    beforeEach(() => {
      registry.register(createOpenAPIHandler())
    })

    it('should parse known spec types', () => {
      const openApiSpec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {}
      }

      const parsed = registry.parseSpec(openApiSpec)

      expect(parsed).toBeDefined()
      expect(parsed?.type).toBe('openapi')
    })

    it('should return null for unknown spec types', () => {
      const unknownSpec = { unknown: 'spec' }

      const parsed = registry.parseSpec(unknownSpec)

      expect(parsed).toBeNull()
    })
  })
})
```

### Task 7: Update Consumer Package (2 hours)

#### 7.1 Update `packages/consumer/src/index.ts`

Find the `createMockServer` function (around line 532) and replace it with:

```typescript
// Import new dependencies at the top
import {
  specRegistry,
  createUnifiedMockHandler,
  handleUnifiedMockRequest,
  convertHTTPToUnified,
  convertUnifiedToHTTP
} from '@entente/fixtures'
import type { APISpec } from '@entente/types'

// Update the createMockServer function
const createMockServer = async (config: {
  spec: OpenAPISpec | any  // Now accepts any spec type
  fixtures: Fixture[]
  port: number
  validateRequest: boolean
  validateResponse: boolean
}): Promise<MockServer> => {
  // Auto-detect spec type and parse
  const parsedSpec = specRegistry.parseSpec(config.spec)
  if (!parsedSpec) {
    throw new Error('Unsupported specification format')
  }

  console.log(`🔍 Detected spec type: ${parsedSpec.type}`)

  // Create unified mock handlers
  const mockHandlers = createUnifiedMockHandler(parsedSpec, config.fixtures)

  // Create unified mock server
  const server = await createUnifiedMockServer(parsedSpec, mockHandlers, config.port)
  return server
}

// Replace createBasicMockServer with createUnifiedMockServer
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
        // Parse request (same as before)
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

        // Handle request with unified handlers
        const unifiedResponse = handleUnifiedMockRequest(unifiedRequest, mockHandlers)
        const httpResponse = convertUnifiedToHTTP(unifiedResponse)

        // Add spec type header for debugging
        res.setHeader('x-spec-type', spec.type)

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

// Remove the old createFixtureBasedMockServer and createSchemaMockServer functions
// Keep all other existing functions unchanged
```

## Testing Phase 1

### Run the Tests

```bash
# Install any new dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run existing tests to ensure no regressions
pnpm test

# Run the new spec handler tests
pnpm --filter @entente/fixtures test

# Run database migration (if using real database)
pnpm --filter @entente/server db:migrate
```

### Manual Testing

1. **Test OpenAPI Compatibility**:
   ```bash
   # Ensure existing OpenAPI mocks still work
   cd packages/consumer
   pnpm test
   ```

2. **Test Spec Detection**:
   ```typescript
   import { specRegistry } from '@entente/fixtures'

   const openApiSpec = { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} }
   console.log(specRegistry.detectType(openApiSpec)) // Should log 'openapi'
   ```

3. **Test Functional Handler Creation**:
   ```typescript
   import { createOpenAPIHandler } from '@entente/fixtures'

   const handler = createOpenAPIHandler()
   console.log(handler.type) // Should log 'openapi'
   console.log(typeof handler.canHandle) // Should log 'function'
   ```

4. **Test Database Schema**:
   ```sql
   -- Test the new spec_type column
   INSERT INTO specs (tenant_id, provider_id, service, version, branch, environment, spec_type, spec, uploaded_by)
   VALUES ('test-tenant', 'test-provider', 'test-service', '1.0.0', 'main', 'test', 'openapi', '{}', 'test-user');
   ```

## Acceptance Criteria

- [ ] All new type definitions compile without errors
- [ ] Functional spec handler abstraction is complete and tested
- [ ] OpenAPI handler functions pass all tests
- [ ] Database schema updated with spec_type column
- [ ] All existing OpenAPI tests pass
- [ ] Registry can detect and handle OpenAPI specs using pure functions
- [ ] Mock server works with unified spec handlers
- [ ] No breaking changes to existing consumer/provider APIs
- [ ] Code follows functional programming patterns consistent with the codebase

## Common Issues and Solutions

### Issue: TypeScript compilation errors
**Solution**: Ensure all new types are properly exported from @entente/types and that function signatures match the interface definitions.

### Issue: Database migration fails
**Solution**: Check that the migration SQL syntax is correct for your PostgreSQL version and that constraints are properly defined.

### Issue: Existing tests fail
**Solution**: The refactoring should be backward compatible. Check that old interfaces are still supported and that the functional handlers provide the same behavior as the previous implementation.

### Issue: Mock server doesn't start
**Solution**: Verify that the unified mock handlers are created correctly and that the spec is parsed properly. Check that all pure functions are working as expected.

### Issue: Functions not working as expected
**Solution**: Since we're using pure functions, test each function individually with known inputs. Check that the function composition in the handlers works correctly.

---

**Next Phase**: [Phase 2: GraphQL Support](./phase-2-graphql-support.md)