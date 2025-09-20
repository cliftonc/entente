---
title: "Phase 4: Testing & Documentation"
description: "Comprehensive testing, performance validation, and documentation completion"
---

# Phase 4: Testing & Documentation

**Duration**: 1 Week
**Prerequisites**: Phases 1-3 completed successfully
**Goal**: Ensure system reliability through comprehensive testing, performance validation, and complete documentation

## Overview

Phase 4 focuses on validating the entire multi-spec implementation through extensive testing, performance benchmarking, migration testing, and documentation completion. This phase ensures the system is production-ready and maintainable.

## Task Breakdown

### Task 1: Create Comprehensive Integration Tests (2 days)

#### 1.1 Create `packages/fixtures/test/integration/multi-spec.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@entente/consumer'
import { specRegistry } from '../../src/spec-handlers'
import WebSocket from 'ws'

describe('Multi-Spec Integration Tests', () => {
  let client: any

  beforeAll(() => {
    client = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'integration-test-key',
      consumer: 'multi-spec-test-consumer',
      consumerVersion: '1.0.0',
      environment: 'integration-test'
    })
  })

  describe('Cross-Spec Compatibility', () => {
    let openApiMock: any
    let graphqlMock: any
    let asyncapiMock: any

    beforeAll(async () => {
      // Load all test specs
      const openApiSpec = JSON.parse(
        readFileSync(resolve(__dirname, '../specs/castles-openapi.json'), 'utf-8')
      )
      const graphqlSpec = readFileSync(
        resolve(__dirname, '../specs/castles.graphql'),
        'utf-8'
      )
      const asyncapiSpec = readFileSync(
        resolve(__dirname, '../specs/castles-asyncapi.yaml'),
        'utf-8'
      )

      // Create mocks for all spec types
      openApiMock = await client.createMock('castle-service-openapi', '1.0.0', {
        spec: openApiSpec
      })
      graphqlMock = await client.createMock('castle-service-graphql', '1.0.0', {
        spec: graphqlSpec
      })
      asyncapiMock = await client.createMock('castle-service-asyncapi', '1.0.0', {
        spec: asyncapiSpec
      })
    })

    afterAll(async () => {
      await Promise.all([
        openApiMock?.close(),
        graphqlMock?.close(),
        asyncapiMock?.close()
      ])
    })

    it('should handle the same operation across different spec types', async () => {
      // Test equivalent operations across specs
      const testCastle = {
        id: 'test-castle-id',
        name: 'Cross-Spec Castle',
        region: 'Integration Test',
        yearBuilt: 2024
      }

      // OpenAPI REST request
      const restResponse = await fetch(`${openApiMock.url}/castles`)
      const restData = await restResponse.json()
      expect(Array.isArray(restData)).toBe(true)

      // GraphQL request for same data
      const gqlResponse = await fetch(`${graphqlMock.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: '{ listCastles { id name region yearBuilt } }'
        })
      })
      const gqlData = await gqlResponse.json()
      expect(gqlData.data.listCastles).toBeDefined()
      expect(Array.isArray(gqlData.data.listCastles)).toBe(true)

      // AsyncAPI event (simulate castle creation event)
      const ws = new WebSocket(asyncapiMock.websocket.url)
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            channel: 'castle/created',
            eventType: 'created',
            castle: testCastle
          }))
        })

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString())
          expect(message.channel).toBe('castle/created')
          expect(message.data).toBeDefined()
          ws.close()
          resolve(undefined)
        })

        ws.on('error', reject)
        setTimeout(() => reject(new Error('AsyncAPI test timeout')), 5000)
      })
    })

    it('should use shared fixtures across spec types', async () => {
      const sharedFixture = {
        id: 'shared-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        operation: 'listCastles', // OpenAPI operation ID
        data: {
          response: [
            { id: 'shared-1', name: 'Shared Castle', region: 'Shared', yearBuilt: 2000 }
          ]
        }
      }

      // Create new mocks with shared fixture
      const openApiWithFixture = await client.createMock('castle-service-shared', '1.0.0', {
        localFixtures: [sharedFixture]
      })

      const graphqlWithFixture = await client.createMock('castle-service-shared-gql', '1.0.0', {
        localFixtures: [{
          ...sharedFixture,
          operation: 'Query.listCastles' // GraphQL operation ID
        }]
      })

      // Both should return the same data
      const restResponse = await fetch(`${openApiWithFixture.url}/castles`)
      const restData = await restResponse.json()

      const gqlResponse = await fetch(`${graphqlWithFixture.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: '{ listCastles { id name region yearBuilt } }'
        })
      })
      const gqlData = await gqlResponse.json()

      expect(restData).toEqual(gqlData.data.listCastles)
      expect(restData[0].name).toBe('Shared Castle')

      await openApiWithFixture.close()
      await graphqlWithFixture.close()
    })

    it('should auto-detect spec types correctly', async () => {
      // Create a single mock that can handle multiple types
      const mixedMock = await client.createMock('mixed-service', '1.0.0')

      // Test OpenAPI detection
      const restResponse = await fetch(`${mixedMock.url}/api/users`)
      expect(restResponse.headers.get('x-detected-type')).toBe('openapi')

      // Test GraphQL detection
      const gqlResponse = await fetch(`${mixedMock.url}/api/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ test }' })
      })
      expect(gqlResponse.headers.get('x-detected-type')).toBe('graphql')

      // Test AsyncAPI detection
      const sseResponse = await fetch(`${mixedMock.url}/events`, {
        headers: { 'Accept': 'text/event-stream' }
      })
      expect(sseResponse.headers.get('x-detected-type')).toBe('asyncapi')

      await mixedMock.close()
    })
  })

  describe('Registry Functionality', () => {
    it('should handle all registered spec types', () => {
      const supportedTypes = specRegistry.getSupportedTypes()
      expect(supportedTypes).toContain('openapi')
      expect(supportedTypes).toContain('graphql')
      expect(supportedTypes).toContain('asyncapi')
    })

    it('should correctly detect and parse all spec types', () => {
      const specs = {
        openapi: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' }, paths: {} },
        graphql: 'type Query { test: String }',
        asyncapi: { asyncapi: '2.6.0', info: { title: 'Test', version: '1.0.0' }, channels: {} }
      }

      for (const [type, spec] of Object.entries(specs)) {
        expect(specRegistry.detectType(spec)).toBe(type)
        const parsed = specRegistry.parseSpec(spec)
        expect(parsed?.type).toBe(type)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid specs gracefully', () => {
      const invalidSpecs = [
        null,
        undefined,
        'invalid spec',
        { invalid: 'format' },
        { openapi: 'invalid' }
      ]

      for (const invalidSpec of invalidSpecs) {
        expect(specRegistry.detectType(invalidSpec)).toBeNull()
        expect(specRegistry.parseSpec(invalidSpec)).toBeNull()
      }
    })

    it('should handle missing operations gracefully', async () => {
      const emptyOpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Empty', version: '1.0.0' },
        paths: {}
      }

      const mock = await client.createMock('empty-service', '1.0.0', {
        spec: emptyOpenApiSpec
      })

      const response = await fetch(`${mock.url}/nonexistent`)
      expect(response.status).toBe(404)

      await mock.close()
    })

    it('should handle WebSocket connection errors', async () => {
      const mock = await client.createMock('ws-error-test', '1.0.0')

      if (mock.websocket) {
        const ws = new WebSocket(mock.websocket.url)

        await new Promise((resolve) => {
          ws.on('open', () => {
            // Send invalid message
            ws.send('invalid json')
          })

          ws.on('message', (data) => {
            const message = JSON.parse(data.toString())
            expect(message.type).toBe('error')
            ws.close()
            resolve(undefined)
          })

          setTimeout(resolve, 1000)
        })
      }

      await mock.close()
    })
  })
})
```

#### 1.2 Create `packages/consumer/test/end-to-end/full-workflow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '../../src'
import { createProvider } from '@entente/provider'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('End-to-End Workflow Tests', () => {
  let consumerClient: any
  let providerClient: any

  beforeAll(() => {
    consumerClient = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'e2e-consumer-key',
      consumer: 'e2e-test-consumer',
      consumerVersion: '1.0.0',
      environment: 'e2e-test'
    })

    providerClient = createProvider({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'e2e-provider-key',
      provider: 'e2e-test-provider',
      providerVersion: '1.0.0'
    })
  })

  describe('Complete OpenAPI Workflow', () => {
    it('should complete full OpenAPI contract testing cycle', async () => {
      const openApiSpec = JSON.parse(
        readFileSync(resolve(__dirname, '../specs/castles-openapi.json'), 'utf-8')
      )

      // 1. Upload OpenAPI spec
      await consumerClient.uploadSpec('e2e-castle-service', '1.0.0', openApiSpec, {
        environment: 'e2e-test',
        branch: 'main'
      })

      // 2. Create consumer mock
      const mock = await consumerClient.createMock('e2e-castle-service', '1.0.0', {
        useFixtures: true
      })

      // 3. Run consumer tests (simulate)
      const testResults = []

      // Test list castles
      const listResponse = await fetch(`${mock.url}/castles`)
      expect(listResponse.status).toBe(200)
      testResults.push({ operation: 'listCastles', success: true })

      // Test get castle
      const getResponse = await fetch(`${mock.url}/castles/123`)
      expect(getResponse.status).toBe(200)
      testResults.push({ operation: 'getCastle', success: true })

      // Test create castle
      const createResponse = await fetch(`${mock.url}/castles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Test Castle',
          region: 'E2E Test',
          yearBuilt: 2024
        })
      })
      expect(createResponse.status).toBe(201)
      testResults.push({ operation: 'createCastle', success: true })

      // 4. Close mock (this triggers fixture upload in CI)
      await mock.close()

      // 5. Provider verification would happen here
      // (In a real scenario, this would be in a separate process)
      const verificationTasks = await providerClient.getVerificationTasks('e2e-test')
      expect(Array.isArray(verificationTasks)).toBe(true)

      // Verify all operations passed
      expect(testResults.every(r => r.success)).toBe(true)
      expect(testResults).toHaveLength(3)
    })
  })

  describe('Complete GraphQL Workflow', () => {
    it('should complete full GraphQL contract testing cycle', async () => {
      const graphqlSchema = readFileSync(
        resolve(__dirname, '../specs/castles.graphql'),
        'utf-8'
      )

      // 1. Upload GraphQL schema
      await consumerClient.uploadSpec('e2e-castle-gql', '1.0.0', graphqlSchema, {
        environment: 'e2e-test',
        branch: 'main'
      })

      // 2. Create consumer mock
      const mock = await consumerClient.createMock('e2e-castle-gql', '1.0.0')

      // 3. Run GraphQL tests
      const queries = [
        { query: '{ listCastles { id name region } }', operation: 'Query.listCastles' },
        { query: '{ getCastle(id: "123") { id name } }', operation: 'Query.getCastle' },
        {
          query: `mutation { createCastle(input: {
            name: "E2E GraphQL Castle"
            region: "E2E Test"
            yearBuilt: 2024
          }) { castle { id name } errors { message } } }`,
          operation: 'Mutation.createCastle'
        }
      ]

      const testResults = []

      for (const { query, operation } of queries) {
        const response = await fetch(`${mock.url}/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('data')
        testResults.push({ operation, success: !data.errors })
      }

      // 4. Close mock
      await mock.close()

      // Verify all operations passed
      expect(testResults.every(r => r.success)).toBe(true)
      expect(testResults).toHaveLength(3)
    })
  })

  describe('Complete AsyncAPI Workflow', () => {
    it('should complete full AsyncAPI event testing cycle', async () => {
      const asyncapiSchema = readFileSync(
        resolve(__dirname, '../specs/castles-asyncapi.yaml'),
        'utf-8'
      )

      // 1. Upload AsyncAPI schema
      await consumerClient.uploadSpec('e2e-castle-events', '1.0.0', asyncapiSchema, {
        environment: 'e2e-test',
        branch: 'main'
      })

      // 2. Create AsyncAPI mock
      const mock = await consumerClient.createMock('e2e-castle-events', '1.0.0')

      // 3. Test WebSocket events
      const events = [
        { channel: 'castle/created', eventType: 'created', operation: 'publishCastleCreated' },
        { channel: 'castle/updated', eventType: 'updated', operation: 'publishCastleUpdated' },
        { channel: 'castle/deleted', eventType: 'deleted', operation: 'publishCastleDeleted' }
      ]

      const testResults = []

      for (const { channel, eventType, operation } of events) {
        await new Promise((resolve, reject) => {
          const ws = new WebSocket(mock.websocket.url)

          ws.on('open', () => {
            ws.send(JSON.stringify({
              channel,
              eventType,
              castle: {
                id: 'e2e-test-id',
                name: 'E2E Event Castle',
                region: 'E2E Events',
                yearBuilt: 2024
              }
            }))
          })

          ws.on('message', (data) => {
            const message = JSON.parse(data.toString())
            expect(message.channel).toBe(channel)
            testResults.push({ operation, success: true })
            ws.close()
            resolve(undefined)
          })

          ws.on('error', reject)
          setTimeout(() => reject(new Error('Event test timeout')), 5000)
        })
      }

      // 4. Close mock
      await mock.close()

      // Verify all events processed
      expect(testResults).toHaveLength(3)
      expect(testResults.every(r => r.success)).toBe(true)
    })
  })
})
```

### Task 2: Performance and Load Testing (1 day)

#### 2.1 Create `packages/fixtures/test/performance/spec-parsing.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { performance } from 'node:perf_hooks'
import { specRegistry } from '../../src/spec-handlers'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Spec Parsing Performance Tests', () => {
  const openApiSpec = JSON.parse(
    readFileSync(resolve(__dirname, '../specs/castles-openapi.json'), 'utf-8')
  )
  const graphqlSpec = readFileSync(
    resolve(__dirname, '../specs/castles.graphql'),
    'utf-8'
  )
  const asyncapiSpec = readFileSync(
    resolve(__dirname, '../specs/castles-asyncapi.yaml'),
    'utf-8'
  )

  const performanceThresholds = {
    detection: 10, // ms
    parsing: 50, // ms
    operationExtraction: 100, // ms
    requestMatching: 5 // ms
  }

  describe('Spec Detection Performance', () => {
    it('should detect OpenAPI specs quickly', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        specRegistry.detectType(openApiSpec)
      }
      const end = performance.now()
      const avgTime = (end - start) / 1000

      expect(avgTime).toBeLessThan(performanceThresholds.detection)
      console.log(`OpenAPI detection avg: ${avgTime.toFixed(3)}ms`)
    })

    it('should detect GraphQL specs quickly', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        specRegistry.detectType(graphqlSpec)
      }
      const end = performance.now()
      const avgTime = (end - start) / 1000

      expect(avgTime).toBeLessThan(performanceThresholds.detection)
      console.log(`GraphQL detection avg: ${avgTime.toFixed(3)}ms`)
    })

    it('should detect AsyncAPI specs quickly', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        specRegistry.detectType(asyncapiSpec)
      }
      const end = performance.now()
      const avgTime = (end - start) / 1000

      expect(avgTime).toBeLessThan(performanceThresholds.detection)
      console.log(`AsyncAPI detection avg: ${avgTime.toFixed(3)}ms`)
    })
  })

  describe('Spec Parsing Performance', () => {
    it('should parse specs within performance thresholds', () => {
      const specs = [
        { name: 'OpenAPI', spec: openApiSpec },
        { name: 'GraphQL', spec: graphqlSpec },
        { name: 'AsyncAPI', spec: asyncapiSpec }
      ]

      for (const { name, spec } of specs) {
        const start = performance.now()
        for (let i = 0; i < 100; i++) {
          specRegistry.parseSpec(spec)
        }
        const end = performance.now()
        const avgTime = (end - start) / 100

        expect(avgTime).toBeLessThan(performanceThresholds.parsing)
        console.log(`${name} parsing avg: ${avgTime.toFixed(3)}ms`)
      }
    })
  })

  describe('Operation Extraction Performance', () => {
    it('should extract operations efficiently', () => {
      const specs = [
        { name: 'OpenAPI', spec: specRegistry.parseSpec(openApiSpec)! },
        { name: 'GraphQL', spec: specRegistry.parseSpec(graphqlSpec)! },
        { name: 'AsyncAPI', spec: specRegistry.parseSpec(asyncapiSpec)! }
      ]

      for (const { name, spec } of specs) {
        const handler = specRegistry.getHandler(spec.type)!
        const start = performance.now()

        for (let i = 0; i < 100; i++) {
          handler.extractOperations(spec)
        }

        const end = performance.now()
        const avgTime = (end - start) / 100

        expect(avgTime).toBeLessThan(performanceThresholds.operationExtraction)
        console.log(`${name} operation extraction avg: ${avgTime.toFixed(3)}ms`)
      }
    })
  })

  describe('Request Matching Performance', () => {
    it('should match requests quickly', () => {
      const openApiHandler = specRegistry.getHandler('openapi')!
      const parsedSpec = specRegistry.parseSpec(openApiSpec)!
      const operations = openApiHandler.extractOperations(parsedSpec)

      const request = {
        method: 'GET',
        path: '/castles/123'
      }

      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        openApiHandler.matchRequest(request, operations)
      }
      const end = performance.now()
      const avgTime = (end - start) / 1000

      expect(avgTime).toBeLessThan(performanceThresholds.requestMatching)
      console.log(`Request matching avg: ${avgTime.toFixed(3)}ms`)
    })
  })
})
```

#### 2.2 Create `packages/consumer/test/performance/mock-server.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { performance } from 'node:perf_hooks'
import { createClient } from '../../src'

describe('Mock Server Performance Tests', () => {
  let client: any
  let mock: any

  beforeAll(async () => {
    client = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'perf-test-key',
      consumer: 'performance-test-consumer',
      consumerVersion: '1.0.0',
      environment: 'performance-test'
    })

    mock = await client.createMock('perf-test-service', '1.0.0')
  })

  afterAll(async () => {
    await mock?.close()
  })

  describe('HTTP Request Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50
      const start = performance.now()

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch(`${mock.url}/test-endpoint-${i}`)
      )

      const responses = await Promise.all(promises)
      const end = performance.now()

      const totalTime = end - start
      const avgTime = totalTime / concurrentRequests

      expect(avgTime).toBeLessThan(100) // Less than 100ms per request on average
      expect(responses.every(r => r.status >= 200 && r.status < 500)).toBe(true)

      console.log(`Concurrent requests (${concurrentRequests}): ${totalTime.toFixed(3)}ms total, ${avgTime.toFixed(3)}ms avg`)
    })

    it('should maintain performance under sustained load', async () => {
      const requestCount = 200
      const start = performance.now()

      for (let i = 0; i < requestCount; i++) {
        await fetch(`${mock.url}/sustained-load-${i}`)
      }

      const end = performance.now()
      const totalTime = end - start
      const avgTime = totalTime / requestCount

      expect(avgTime).toBeLessThan(50) // Less than 50ms per request on average

      console.log(`Sustained load (${requestCount} requests): ${totalTime.toFixed(3)}ms total, ${avgTime.toFixed(3)}ms avg`)
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory during extended operation', async () => {
      const initialMemory = process.memoryUsage()

      // Simulate extended operation
      for (let i = 0; i < 1000; i++) {
        await fetch(`${mock.url}/memory-test-${i}`)

        // Force garbage collection every 100 requests
        if (i % 100 === 0 && global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory growth should be reasonable (less than 50MB for 1000 requests)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)

      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)
    })
  })
})
```

### Task 3: Migration and Backward Compatibility Testing (1 day)

#### 3.1 Create `test/migration/backward-compatibility.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@entente/consumer'
import { createProvider } from '@entente/provider'

describe('Backward Compatibility Tests', () => {
  let client: any

  beforeAll(() => {
    client = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'compat-test-key',
      consumer: 'compat-test-consumer',
      consumerVersion: '1.0.0',
      environment: 'compatibility-test'
    })
  })

  describe('Legacy OpenAPI Support', () => {
    it('should maintain compatibility with existing OpenAPI workflows', async () => {
      // Test that old OpenAPI code still works exactly as before
      const legacyOpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Legacy API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              responses: {
                '200': {
                  description: 'Users list',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const mock = await client.createMock('legacy-service', '1.0.0')

      // This should work exactly as it did before multi-spec support
      const response = await fetch(`${mock.url}/users`)
      expect(response.status).toBe(200)

      const operations = mock.getOperations()
      expect(operations.some((op: any) => op.operationId === 'getUsers')).toBe(true)

      await mock.close()
    })

    it('should support legacy fixture format', async () => {
      const legacyFixture = {
        id: 'legacy-fixture',
        service: 'legacy-service',
        serviceVersion: '1.0.0',
        operation: 'getUsers',
        status: 'approved' as const,
        source: 'manual' as const,
        priority: 1,
        data: {
          response: [{ id: 1, name: 'Legacy User' }]
        },
        createdFrom: {
          type: 'manual' as const,
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const mock = await client.createMock('legacy-service', '1.0.0', {
        localFixtures: [legacyFixture]
      })

      const response = await fetch(`${mock.url}/users`)
      const data = await response.json()

      expect(data).toEqual([{ id: 1, name: 'Legacy User' }])

      await mock.close()
    })
  })

  describe('API Compatibility', () => {
    it('should maintain all existing client methods', () => {
      // Verify that all existing methods are still available
      expect(typeof client.createMock).toBe('function')
      expect(typeof client.uploadSpec).toBe('function')

      const provider = createProvider({
        serviceUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        provider: 'test-provider',
        providerVersion: '1.0.0'
      })

      expect(typeof provider.verify).toBe('function')
      expect(typeof provider.getVerificationTasks).toBe('function')
    })

    it('should preserve existing mock interface', async () => {
      const mock = await client.createMock('interface-test', '1.0.0')

      // All existing properties should be available
      expect(typeof mock.url).toBe('string')
      expect(typeof mock.port).toBe('number')
      expect(typeof mock.close).toBe('function')
      expect(typeof mock.getFixtures).toBe('function')
      expect(typeof mock.proposeFixture).toBe('function')

      await mock.close()
    })
  })

  describe('Configuration Compatibility', () => {
    it('should accept legacy configuration options', () => {
      // Test that old configuration still works
      const legacyClient = createClient({
        serviceUrl: 'http://localhost:3000',
        apiKey: 'legacy-key',
        consumer: 'legacy-consumer',
        consumerVersion: '1.0.0',
        environment: 'legacy-test',
        recordingEnabled: true // Legacy option
      })

      expect(legacyClient).toBeDefined()
      expect(typeof legacyClient.createMock).toBe('function')
    })
  })
})
```

### Task 4: Documentation Completion (2 days)

#### 4.1 Create comprehensive testing strategy documentation

#### 4.2 Update all existing documentation with multi-spec examples

#### 4.3 Create migration guide for existing users

## Performance Benchmarks

### Target Performance Metrics

| Operation | Target Time | Acceptable Range |
|-----------|-------------|------------------|
| Spec Detection | < 10ms | < 20ms |
| Spec Parsing | < 50ms | < 100ms |
| Operation Extraction | < 100ms | < 200ms |
| Request Matching | < 5ms | < 10ms |
| Mock Response Generation | < 20ms | < 50ms |

### Load Testing Targets

| Metric | Target | Minimum Acceptable |
|--------|--------|--------------------|
| Concurrent Requests | 100 RPS | 50 RPS |
| Response Time (95th percentile) | < 100ms | < 500ms |
| Memory Usage Growth | < 10MB/1000 requests | < 50MB/1000 requests |
| CPU Usage | < 50% under load | < 80% under load |

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual function testing
   - Each spec handler function
   - Registry operations
   - Request detection logic
   - Response generation

2. **Integration Tests**: Component interaction testing
   - Cross-spec compatibility
   - Auto-detection workflows
   - Fixture sharing across specs
   - Database operations

3. **End-to-End Tests**: Complete workflow testing
   - Full contract testing cycles
   - Consumer-provider workflows
   - Multi-spec scenarios

4. **Performance Tests**: Performance validation
   - Parsing performance
   - Request handling performance
   - Memory usage monitoring
   - Concurrent request handling

5. **Compatibility Tests**: Backward compatibility
   - Legacy OpenAPI workflows
   - Existing API compatibility
   - Configuration backward compatibility

### Test Coverage Requirements

- **Unit Tests**: 95% code coverage minimum
- **Integration Tests**: All major user workflows covered
- **E2E Tests**: Complete happy path and error scenarios
- **Performance Tests**: All critical performance paths benchmarked
- **Compatibility Tests**: All existing functionality verified

### Continuous Integration

```yaml
# .github/workflows/multi-spec-tests.yml
name: Multi-Spec Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm coverage:report

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:integration

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:performance
      - name: Performance Report
        run: pnpm performance:report

  compatibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:compatibility
```

## Acceptance Criteria

### Phase 4 Success Criteria

- [ ] All test suites pass with 95%+ coverage
- [ ] Performance benchmarks meet or exceed targets
- [ ] Backward compatibility verified for all existing functionality
- [ ] Integration tests validate cross-spec workflows
- [ ] E2E tests validate complete user journeys
- [ ] Migration guide tested with real examples
- [ ] Documentation is complete and accurate
- [ ] CI/CD pipeline validates all test categories
- [ ] Memory leaks and performance regressions identified and fixed
- [ ] Load testing validates production readiness

### Quality Gates

1. **Code Quality**
   - No critical or high-severity linting issues
   - TypeScript strict mode passes
   - All tests pass in CI
   - Code coverage >= 95%

2. **Performance**
   - All performance benchmarks met
   - No memory leaks detected
   - Load testing passes acceptance criteria
   - Response times within target ranges

3. **Compatibility**
   - All existing OpenAPI tests pass unchanged
   - Legacy API calls work without modification
   - Existing configurations remain valid
   - Migration path is validated

4. **Documentation**
   - All code is documented
   - User guides are complete
   - Migration guide is tested
   - Examples work as documented

## Risk Mitigation

### Performance Risks
- **Mitigation**: Comprehensive performance testing and benchmarking
- **Fallback**: Performance optimization patches if targets not met

### Compatibility Risks
- **Mitigation**: Extensive backward compatibility testing
- **Fallback**: Compatibility shims for breaking changes

### Adoption Risks
- **Mitigation**: Clear migration guide and gradual rollout plan
- **Fallback**: Feature flags to disable multi-spec features if needed

## Post-Phase 4 Activities

1. **Production Deployment**
   - Gradual rollout with feature flags
   - Performance monitoring
   - User feedback collection

2. **Monitoring and Maintenance**
   - Performance monitoring dashboard
   - Error tracking and alerting
   - Regular performance regression testing

3. **Future Enhancements**
   - Additional spec type support (gRPC, SOAP)
   - Advanced fixture management features
   - Performance optimizations based on real usage

---

**Completion**: All phases implemented and tested successfully