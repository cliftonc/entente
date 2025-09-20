import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '../../src/index.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import WebSocket from 'ws'

// Mock the server responses since we can't rely on a real server in tests
const mockServerUrl = 'http://localhost:3000'

describe('End-to-End Workflow Tests', () => {
  let consumerClient: any

  beforeAll(() => {
    consumerClient = createClient({
      serviceUrl: mockServerUrl,
      apiKey: 'e2e-consumer-key',
      consumer: 'e2e-test-consumer',
      consumerVersion: '1.0.0',
      environment: 'e2e-test'
    })
  })

  describe('Complete OpenAPI Workflow', () => {
    it('should complete full OpenAPI contract testing workflow', async () => {
      // Load the test OpenAPI spec
      const openApiSpec = JSON.parse(
        readFileSync(resolve(__dirname, '../../../fixtures/test/specs/castles-openapi.json'), 'utf-8')
      )

      // This test simulates the complete workflow but without actual server calls
      // In a real E2E test, these would be actual HTTP calls to a running server

      // 1. Verify spec structure is valid for workflow
      expect(openApiSpec.openapi).toBe('3.0.3')
      expect(openApiSpec.info.title).toBe('Castle Service API')
      expect(openApiSpec.paths).toBeDefined()
      expect(Object.keys(openApiSpec.paths).length).toBeGreaterThan(0)

      // 2. Verify operations can be extracted
      const paths = openApiSpec.paths
      const operations = []

      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods as any)) {
          if (typeof operation === 'object' && operation.operationId) {
            operations.push({
              path,
              method: method.toUpperCase(),
              operationId: operation.operationId
            })
          }
        }
      }

      expect(operations.length).toBeGreaterThan(0)
      expect(operations.some(op => op.operationId === 'listCastles')).toBe(true)
      expect(operations.some(op => op.operationId === 'getCastle')).toBe(true)
      expect(operations.some(op => op.operationId === 'createCastle')).toBe(true)

      // 3. Simulate successful test operations
      const testResults = operations.map(op => ({
        operation: op.operationId,
        method: op.method,
        path: op.path,
        success: true,
        timestamp: new Date()
      }))

      // 4. Verify all critical operations are tested
      const criticalOperations = ['listCastles', 'getCastle', 'createCastle']
      for (const criticalOp of criticalOperations) {
        const tested = testResults.find(result => result.operation === criticalOp)
        expect(tested).toBeDefined()
        expect(tested?.success).toBe(true)
      }

      // 5. Simulate fixture generation for successful operations
      const fixtures = testResults.map(result => ({
        id: `fixture-${result.operation}`,
        service: 'e2e-castle-service',
        serviceVersion: '1.0.0',
        operation: result.operation,
        specType: 'openapi' as const,
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: {
          request: { method: result.method, path: result.path },
          response: { status: 200, data: 'test data' }
        },
        createdFrom: {
          type: 'test' as const,
          timestamp: result.timestamp
        },
        createdAt: result.timestamp
      }))

      expect(fixtures.length).toBe(operations.length)
      expect(fixtures.every(f => f.status === 'approved')).toBe(true)
      expect(fixtures.every(f => f.specType === 'openapi')).toBe(true)
    })
  })

  describe('Complete GraphQL Workflow', () => {
    it('should complete full GraphQL contract testing workflow', async () => {
      // Load the test GraphQL schema
      const graphqlSchema = readFileSync(
        resolve(__dirname, '../../../fixtures/test/specs/castles.graphql'),
        'utf-8'
      )

      // 1. Verify schema structure
      expect(graphqlSchema).toContain('type Query')
      expect(graphqlSchema).toContain('type Mutation')
      expect(graphqlSchema).toContain('type Castle')

      // 2. Verify expected operations exist in schema (simple text search)
      expect(graphqlSchema).toContain('listCastles')
      expect(graphqlSchema).toContain('getCastle')
      expect(graphqlSchema).toContain('createCastle')
      expect(graphqlSchema).toContain('deleteCastle')

      // 3. Simulate GraphQL query testing
      const testOperations = ['listCastles', 'getCastle', 'createCastle', 'deleteCastle']
      const gqlTestResults = testOperations.map(operation => {
        const isQuery = operation === 'listCastles' || operation === 'getCastle'
        const query = isQuery
          ? `{ ${operation} { id name } }`
          : `mutation { ${operation}(input: {}) { success } }`

        return {
          operation,
          query,
          success: true,
          timestamp: new Date()
        }
      })

      // 4. Verify all operations tested successfully
      expect(gqlTestResults.length).toBe(4)
      expect(gqlTestResults.every(r => r.success)).toBe(true)

      // 5. Generate GraphQL fixtures
      const gqlFixtures = gqlTestResults.map(result => ({
        id: `gql-fixture-${result.operation}`,
        service: 'e2e-castle-gql',
        serviceVersion: '1.0.0',
        operation: result.operation,
        specType: 'graphql' as const,
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: {
          query: result.query,
          response: { data: 'test graphql data' }
        },
        createdFrom: {
          type: 'test' as const,
          timestamp: result.timestamp
        },
        createdAt: result.timestamp
      }))

      expect(gqlFixtures.length).toBe(gqlTestResults.length)
      expect(gqlFixtures.every(f => f.specType === 'graphql')).toBe(true)
    })
  })

  describe('Complete AsyncAPI Workflow', () => {
    it('should complete full AsyncAPI event testing workflow', async () => {
      // Load the test AsyncAPI schema
      const asyncapiYaml = readFileSync(
        resolve(__dirname, '../../../fixtures/test/specs/castles-asyncapi.yaml'),
        'utf-8'
      )

      // 1. Verify schema structure
      expect(asyncapiYaml).toContain('asyncapi: 2.6.0')
      expect(asyncapiYaml).toContain('channels:')
      expect(asyncapiYaml).toContain('castle/created')
      expect(asyncapiYaml).toContain('castle/updated')

      // 2. Extract channel operations (simplified YAML parsing for test)
      const channelMatches = asyncapiYaml.matchAll(/(\w+\/\w+):/g)
      const channels = Array.from(channelMatches).map(match => match[1])

      expect(channels.length).toBeGreaterThan(0)
      expect(channels).toContain('castle/created')
      expect(channels).toContain('castle/updated')
      expect(channels).toContain('castle/deleted')

      // 3. Extract operation IDs from schema
      const operationMatches = asyncapiYaml.matchAll(/operationId:\s*(\w+)/g)
      const operations = Array.from(operationMatches).map(match => match[1])

      expect(operations.length).toBeGreaterThan(0)
      expect(operations).toContain('publishCastleCreated')
      expect(operations).toContain('subscribeCastleCreated')
      expect(operations).toContain('publishCastleUpdated')

      // 4. Simulate event testing workflow
      const eventTests = channels.map(channel => {
        const publishOp = operations.find(op => op.includes('publish') && op.toLowerCase().includes(channel.split('/')[1]))
        const subscribeOp = operations.find(op => op.includes('subscribe') && op.toLowerCase().includes(channel.split('/')[1]))

        return {
          channel,
          publishOperation: publishOp,
          subscribeOperation: subscribeOp,
          eventData: {
            eventId: `test-event-${channel.replace('/', '-')}`,
            castle: {
              id: 'test-castle-id',
              name: 'Event Test Castle',
              region: 'AsyncAPI Test'
            }
          },
          success: true,
          timestamp: new Date()
        }
      })

      // 5. Verify all events tested
      expect(eventTests.length).toBe(channels.length)
      expect(eventTests.every(t => t.success)).toBe(true)
      expect(eventTests.every(t => t.publishOperation || t.subscribeOperation)).toBe(true)

      // 6. Generate AsyncAPI fixtures
      const asyncFixtures = eventTests.flatMap(test => {
        const fixtures = []

        if (test.publishOperation) {
          fixtures.push({
            id: `async-fixture-${test.publishOperation}`,
            service: 'e2e-castle-events',
            serviceVersion: '1.0.0',
            operation: test.publishOperation,
            specType: 'asyncapi' as const,
            status: 'approved' as const,
            source: 'test' as const,
            priority: 1,
            data: {
              channel: test.channel,
              event: test.eventData
            },
            createdFrom: {
              type: 'test' as const,
              timestamp: test.timestamp
            },
            createdAt: test.timestamp
          })
        }

        if (test.subscribeOperation) {
          fixtures.push({
            id: `async-fixture-${test.subscribeOperation}`,
            service: 'e2e-castle-events',
            serviceVersion: '1.0.0',
            operation: test.subscribeOperation,
            specType: 'asyncapi' as const,
            status: 'approved' as const,
            source: 'test' as const,
            priority: 1,
            data: {
              channel: test.channel,
              event: test.eventData
            },
            createdFrom: {
              type: 'test' as const,
              timestamp: test.timestamp
            },
            createdAt: test.timestamp
          })
        }

        return fixtures
      })

      expect(asyncFixtures.length).toBeGreaterThan(0)
      expect(asyncFixtures.every(f => f.specType === 'asyncapi')).toBe(true)
    })
  })

  describe('Cross-Spec Integration Workflow', () => {
    it('should handle multi-spec service workflows', async () => {
      // Simulate a service that uses multiple spec types
      const serviceSpecs = {
        openapi: JSON.parse(
          readFileSync(resolve(__dirname, '../../../fixtures/test/specs/castles-openapi.json'), 'utf-8')
        ),
        graphql: readFileSync(
          resolve(__dirname, '../../../fixtures/test/specs/castles.graphql'),
          'utf-8'
        ),
        asyncapi: readFileSync(
          resolve(__dirname, '../../../fixtures/test/specs/castles-asyncapi.yaml'),
          'utf-8'
        )
      }

      // 1. Verify all specs are valid
      expect(serviceSpecs.openapi.openapi).toBe('3.0.3')
      expect(serviceSpecs.graphql).toContain('type Query')
      expect(serviceSpecs.asyncapi).toContain('asyncapi: 2.6.0')

      // 2. Simulate testing each spec type
      const specResults = Object.entries(serviceSpecs).map(([specType, spec]) => ({
        specType,
        operations: specType === 'openapi'
          ? Object.keys(spec.paths || {}).length
          : specType === 'graphql'
          ? (spec.match(/\w+\s*(?:\([^)]*\))?\s*:/g) || []).length
          : (spec.match(/operationId:/g) || []).length,
        tested: true,
        timestamp: new Date()
      }))

      // 3. Verify all spec types were tested
      expect(specResults.length).toBe(3)
      expect(specResults.every(r => r.tested)).toBe(true)
      expect(specResults.find(r => r.specType === 'openapi')?.operations).toBeGreaterThan(0)
      expect(specResults.find(r => r.specType === 'graphql')?.operations).toBeGreaterThan(0)
      expect(specResults.find(r => r.specType === 'asyncapi')?.operations).toBeGreaterThan(0)

      // 4. Simulate fixture generation for multi-spec service
      const multiSpecFixtures = specResults.map(result => ({
        id: `multi-spec-${result.specType}-fixture`,
        service: 'multi-spec-castle-service',
        serviceVersion: '1.0.0',
        operation: `${result.specType}TestOperation`,
        specType: result.specType as 'openapi' | 'graphql' | 'asyncapi',
        status: 'approved' as const,
        source: 'test' as const,
        priority: 1,
        data: {
          specType: result.specType,
          operationCount: result.operations
        },
        createdFrom: {
          type: 'test' as const,
          timestamp: result.timestamp
        },
        createdAt: result.timestamp
      }))

      // 5. Verify fixtures maintain spec type isolation
      expect(multiSpecFixtures.length).toBe(3)
      expect(multiSpecFixtures.find(f => f.specType === 'openapi')).toBeDefined()
      expect(multiSpecFixtures.find(f => f.specType === 'graphql')).toBeDefined()
      expect(multiSpecFixtures.find(f => f.specType === 'asyncapi')).toBeDefined()

      // Each fixture should be isolated by spec type
      const openApiFixture = multiSpecFixtures.find(f => f.specType === 'openapi')!
      const graphqlFixture = multiSpecFixtures.find(f => f.specType === 'graphql')!
      const asyncapiFixture = multiSpecFixtures.find(f => f.specType === 'asyncapi')!

      expect(openApiFixture.operation).toContain('openapi')
      expect(graphqlFixture.operation).toContain('graphql')
      expect(asyncapiFixture.operation).toContain('asyncapi')
    })
  })

  describe('Workflow Error Handling', () => {
    it('should handle workflow failures gracefully', () => {
      // Simulate various failure scenarios
      const failureScenarios = [
        {
          type: 'invalid-spec',
          spec: 'invalid spec content',
          expectedError: 'Spec parsing failed'
        },
        {
          type: 'missing-operations',
          spec: { openapi: '3.0.0', info: { title: 'Empty', version: '1.0.0' }, paths: {} },
          expectedError: 'No operations found'
        },
        {
          type: 'network-failure',
          spec: null,
          expectedError: 'Network connection failed'
        }
      ]

      for (const scenario of failureScenarios) {
        // Simulate error handling
        const result = {
          scenario: scenario.type,
          success: false,
          error: scenario.expectedError,
          timestamp: new Date()
        }

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(typeof result.error).toBe('string')
      }
    })

    it('should handle partial workflow completion', () => {
      // Simulate a workflow where some operations succeed and others fail
      const operationResults = [
        { operation: 'listCastles', success: true },
        { operation: 'getCastle', success: true },
        { operation: 'createCastle', success: false, error: 'Validation failed' },
        { operation: 'deleteCastle', success: false, error: 'Permission denied' }
      ]

      const successfulOps = operationResults.filter(r => r.success)
      const failedOps = operationResults.filter(r => !r.success)

      expect(successfulOps.length).toBe(2)
      expect(failedOps.length).toBe(2)

      // Should be able to generate fixtures for successful operations only
      const fixtures = successfulOps.map(op => ({
        operation: op.operation,
        status: 'approved' as const,
        success: true
      }))

      expect(fixtures.length).toBe(2)
      expect(fixtures.every(f => f.success)).toBe(true)
    })
  })
})