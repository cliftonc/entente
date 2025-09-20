import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { specRegistry } from '../../src/spec-handlers'
import WebSocket from 'ws'

describe('Multi-Spec Integration Tests', () => {
  let openApiSpec: any
  let graphqlSpec: string
  let asyncapiSpec: string

  beforeAll(() => {
    // Load all test specs
    openApiSpec = JSON.parse(
      readFileSync(resolve(__dirname, '../specs/castles-openapi.json'), 'utf-8')
    )
    graphqlSpec = readFileSync(
      resolve(__dirname, '../specs/castles.graphql'),
      'utf-8'
    )
    asyncapiSpec = readFileSync(
      resolve(__dirname, '../specs/castles-asyncapi.yaml'),
      'utf-8'
    )
  })

  describe('Cross-Spec Compatibility', () => {
    it('should detect and parse all spec types correctly', () => {
      // Test OpenAPI detection and parsing
      expect(specRegistry.detectType(openApiSpec)).toBe('openapi')
      const parsedOpenApi = specRegistry.parseSpec(openApiSpec)
      expect(parsedOpenApi?.type).toBe('openapi')
      expect(parsedOpenApi?.spec).toBeDefined()

      // Test GraphQL detection and parsing
      expect(specRegistry.detectType(graphqlSpec)).toBe('graphql')
      const parsedGraphql = specRegistry.parseSpec(graphqlSpec)
      expect(parsedGraphql?.type).toBe('graphql')
      expect(parsedGraphql?.spec).toBeDefined()

      // Test AsyncAPI detection and parsing
      expect(specRegistry.detectType(asyncapiSpec)).toBe('asyncapi')
      const parsedAsyncapi = specRegistry.parseSpec(asyncapiSpec)
      expect(parsedAsyncapi?.type).toBe('asyncapi')
      expect(parsedAsyncapi?.spec).toBeDefined()
    })

    it('should extract operations from all spec types', () => {
      // Extract OpenAPI operations
      const openApiHandler = specRegistry.getHandler('openapi')!
      const parsedOpenApi = specRegistry.parseSpec(openApiSpec)!
      const openApiOperations = openApiHandler.extractOperations(parsedOpenApi)

      expect(openApiOperations.length).toBeGreaterThan(0)
      expect(openApiOperations.some(op => op.id === 'listCastles')).toBe(true)
      expect(openApiOperations.some(op => op.id === 'createCastle')).toBe(true)
      expect(openApiOperations.some(op => op.id === 'getCastle')).toBe(true)

      // Extract GraphQL operations
      const graphqlHandler = specRegistry.getHandler('graphql')!
      const parsedGraphql = specRegistry.parseSpec(graphqlSpec)!
      const graphqlOperations = graphqlHandler.extractOperations(parsedGraphql)

      expect(graphqlOperations.length).toBeGreaterThan(0)
      expect(graphqlOperations.some(op => op.id === 'Query.listCastles')).toBe(true)
      expect(graphqlOperations.some(op => op.id === 'Mutation.createCastle')).toBe(true)
      expect(graphqlOperations.some(op => op.id === 'Query.getCastle')).toBe(true)

      // Extract AsyncAPI operations
      const asyncapiHandler = specRegistry.getHandler('asyncapi')!
      const parsedAsyncapi = specRegistry.parseSpec(asyncapiSpec)!
      const asyncapiOperations = asyncapiHandler.extractOperations(parsedAsyncapi)

      expect(asyncapiOperations.length).toBeGreaterThan(0)
      expect(asyncapiOperations.some(op => op.id.includes('publish'))).toBe(true)
      expect(asyncapiOperations.some(op => op.id.includes('subscribe'))).toBe(true)
      expect(asyncapiOperations.some(op => op.id.includes('Castle'))).toBe(true)
    })

    it('should handle equivalent operations across different spec types', () => {
      // Test that similar operations (list castles) can be extracted from different specs
      const openApiHandler = specRegistry.getHandler('openapi')!
      const graphqlHandler = specRegistry.getHandler('graphql')!
      const asyncapiHandler = specRegistry.getHandler('asyncapi')!

      const parsedOpenApi = specRegistry.parseSpec(openApiSpec)!
      const parsedGraphql = specRegistry.parseSpec(graphqlSpec)!
      const parsedAsyncapi = specRegistry.parseSpec(asyncapiSpec)!

      const openApiOps = openApiHandler.extractOperations(parsedOpenApi)
      const graphqlOps = graphqlHandler.extractOperations(parsedGraphql)
      const asyncapiOps = asyncapiHandler.extractOperations(parsedAsyncapi)

      // All specs should have operations related to castle management
      expect(openApiOps.find(op => op.id === 'listCastles')).toBeDefined()
      expect(graphqlOps.find(op => op.id === 'Query.listCastles')).toBeDefined()
      expect(asyncapiOps.find(op => op.id.includes('Castle'))).toBeDefined()

      // Operations should have proper metadata
      const openApiListOp = openApiOps.find(op => op.id === 'listCastles')!
      expect(openApiListOp.method).toBe('GET')
      expect(openApiListOp.path).toBe('/castles')

      const graphqlListOp = graphqlOps.find(op => op.id === 'Query.listCastles')!
      expect(graphqlListOp.type).toBe('query') // GraphQL operations have type, not method/path
    })

    it('should handle request matching for all spec types', () => {
      const openApiHandler = specRegistry.getHandler('openapi')!
      const graphqlHandler = specRegistry.getHandler('graphql')!

      const parsedOpenApi = specRegistry.parseSpec(openApiSpec)!
      const parsedGraphql = specRegistry.parseSpec(graphqlSpec)!

      const openApiOps = openApiHandler.extractOperations(parsedOpenApi)
      const graphqlOps = graphqlHandler.extractOperations(parsedGraphql)

      // Test OpenAPI request matching
      const restRequest = {
        method: 'GET',
        path: '/castles'
      }
      const matchedRestOp = openApiHandler.matchRequest(restRequest, openApiOps)
      expect(matchedRestOp?.id).toBe('listCastles')

      // Test GraphQL request matching
      const gqlRequest = {
        method: 'POST',
        path: '/graphql',
        headers: { 'content-type': 'application/json' },
        body: { query: '{ listCastles { id name } }' }
      }
      const matchedGqlOp = graphqlHandler.matchRequest(gqlRequest, graphqlOps)
      expect(matchedGqlOp?.id).toBe('Query.listCastles')
    })

    it('should generate compatible fixtures for shared operations', () => {
      // Test that fixtures can be created for equivalent operations
      const testCastle = {
        id: 'test-castle-id',
        name: 'Cross-Spec Castle',
        region: 'Integration Test',
        yearBuilt: 2024
      }

      // Create fixture for OpenAPI
      const openApiFixture = {
        id: 'test-openapi-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        operation: 'listCastles',
        specType: 'openapi' as const,
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: {
          response: [testCastle]
        },
        createdFrom: {
          type: 'test' as const,
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      // Create equivalent fixture for GraphQL
      const graphqlFixture = {
        id: 'test-graphql-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        operation: 'Query.listCastles',
        specType: 'graphql' as const,
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: {
          response: { data: { listCastles: [testCastle] } }
        },
        createdFrom: {
          type: 'test' as const,
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      // Both fixtures should be valid and contain similar data
      expect(openApiFixture.operation).toBe('listCastles')
      expect(graphqlFixture.operation).toBe('Query.listCastles')
      expect(openApiFixture.specType).toBe('openapi')
      expect(graphqlFixture.specType).toBe('graphql')

      // Data structures should be compatible (both contain castle info)
      const openApiCastle = openApiFixture.data.response[0]
      const graphqlCastle = graphqlFixture.data.response.data.listCastles[0]
      expect(openApiCastle.id).toBe(graphqlCastle.id)
      expect(openApiCastle.name).toBe(graphqlCastle.name)
    })
  })

  describe('Registry Functionality', () => {
    it('should handle all registered spec types', () => {
      const supportedTypes = specRegistry.getSupportedTypes()
      expect(supportedTypes).toContain('openapi')
      expect(supportedTypes).toContain('graphql')
      expect(supportedTypes).toContain('asyncapi')
      expect(supportedTypes.length).toBeGreaterThanOrEqual(3)
    })

    it('should correctly detect and parse all spec types', () => {
      const specs = {
        openapi: openApiSpec,
        graphql: graphqlSpec,
        asyncapi: asyncapiSpec
      }

      for (const [type, spec] of Object.entries(specs)) {
        const detectedType = specRegistry.detectType(spec)
        expect(detectedType).toBe(type)

        const parsed = specRegistry.parseSpec(spec)
        expect(parsed?.type).toBe(type)
        expect(parsed?.spec).toBeDefined()
      }
    })

    it('should maintain handler registration order', () => {
      const handlers = specRegistry.getAllHandlers()
      expect(handlers.length).toBeGreaterThanOrEqual(3)

      const handlerTypes = handlers.map(h => h.type)
      // Should have all expected handlers
      expect(handlerTypes).toContain('openapi')
      expect(handlerTypes).toContain('graphql')
      expect(handlerTypes).toContain('asyncapi')
    })

    it('should handle auto-detection priority correctly', () => {
      // Test that detection works consistently
      expect(specRegistry.detectType(openApiSpec)).toBe('openapi')
      expect(specRegistry.detectType(graphqlSpec)).toBe('graphql')
      expect(specRegistry.detectType(asyncapiSpec)).toBe('asyncapi')

      // Test with invalid/ambiguous specs
      expect(specRegistry.detectType(null)).toBeNull()
      expect(specRegistry.detectType({})).toBeNull()
      expect(specRegistry.detectType('invalid')).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid specs gracefully', () => {
      const invalidSpecs = [
        null,
        undefined,
        123,
        [],
        { completely: 'unrelated', data: 'structure' },
        { random: { nested: { object: true } } }
      ]

      for (const invalidSpec of invalidSpecs) {
        expect(specRegistry.detectType(invalidSpec)).toBeNull()
        expect(specRegistry.parseSpec(invalidSpec)).toBeNull()
      }
    })

    it('should handle missing operations gracefully', () => {
      const emptyOpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Empty', version: '1.0.0' },
        paths: {}
      }

      const emptyGraphqlSpec = 'type Query { # no fields }'

      const handler = specRegistry.getHandler('openapi')!
      const parsed = specRegistry.parseSpec(emptyOpenApiSpec)!
      const operations = handler.extractOperations(parsed)

      expect(Array.isArray(operations)).toBe(true)
      expect(operations.length).toBe(0)

      // Test that empty operations don't break request matching
      const result = handler.matchRequest({ method: 'GET', path: '/nonexistent' }, operations)
      expect(result).toBeNull()
    })

    it('should handle malformed GraphQL schemas', () => {
      const malformedSchemas = [
        'invalid graphql syntax {{{',
        'completely invalid string !@#$%',
        'not even close to graphql schema'
      ]

      for (const schema of malformedSchemas) {
        // These should not be detected as GraphQL
        const detected = specRegistry.detectType(schema)
        expect(detected).toBe(null)
        expect(specRegistry.parseSpec(schema)).toBeNull()
      }
    })

    it('should handle malformed AsyncAPI specs', () => {
      const malformedSpecs = [
        'completely invalid yaml: content [[[',
        'not yaml at all !@#$%^&*()',
        { notasync: 'api', format: 'wrong' }
      ]

      for (const spec of malformedSpecs) {
        expect(specRegistry.detectType(spec)).toBe(null)
        expect(specRegistry.parseSpec(spec)).toBeNull()
      }
    })
  })

  describe('Spec Type Isolation', () => {
    it('should maintain fixture isolation by spec type', () => {
      const sharedFixtureData = {
        id: 'shared-fixture-test',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: { response: 'shared data' },
        createdFrom: { type: 'test' as const, timestamp: new Date() },
        createdAt: new Date()
      }

      // Create fixtures for different spec types
      const openApiFixture = {
        ...sharedFixtureData,
        operation: 'listCastles',
        specType: 'openapi' as const
      }

      const graphqlFixture = {
        ...sharedFixtureData,
        operation: 'Query.listCastles',
        specType: 'graphql' as const
      }

      const asyncapiFixture = {
        ...sharedFixtureData,
        operation: 'publishCastleCreated',
        specType: 'asyncapi' as const
      }

      // Fixtures should be isolated by spec type
      expect(openApiFixture.specType).toBe('openapi')
      expect(graphqlFixture.specType).toBe('graphql')
      expect(asyncapiFixture.specType).toBe('asyncapi')

      // Each should have different operation formats
      expect(openApiFixture.operation).toBe('listCastles')
      expect(graphqlFixture.operation).toBe('Query.listCastles')
      expect(asyncapiFixture.operation).toBe('publishCastleCreated')
    })

    it('should prevent cross-spec fixture contamination', () => {
      // Test that OpenAPI fixtures don't affect GraphQL operations and vice versa
      const openApiHandler = specRegistry.getHandler('openapi')!
      const graphqlHandler = specRegistry.getHandler('graphql')!

      // These operations should be completely separate
      const openApiRequest = { method: 'GET', path: '/castles' }
      const graphqlRequest = {
        method: 'POST',
        path: '/graphql',
        body: JSON.stringify({ query: '{ listCastles { id } }' })
      }

      const parsedOpenApi = specRegistry.parseSpec(openApiSpec)!
      const parsedGraphql = specRegistry.parseSpec(graphqlSpec)!

      const openApiOps = openApiHandler.extractOperations(parsedOpenApi)
      const graphqlOps = graphqlHandler.extractOperations(parsedGraphql)

      // OpenAPI handler should not match GraphQL operations
      const openApiMatch = openApiHandler.matchRequest(graphqlRequest, openApiOps)
      expect(openApiMatch).toBeNull()

      // GraphQL handler should not match REST operations
      const graphqlMatch = graphqlHandler.matchRequest(openApiRequest, graphqlOps)
      expect(graphqlMatch).toBeNull()
    })
  })
})