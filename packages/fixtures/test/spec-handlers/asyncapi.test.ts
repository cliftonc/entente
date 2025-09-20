import { describe, it, expect } from 'vitest'
import {
  canHandleAsyncAPI,
  parseAsyncAPISpec,
  extractAsyncAPIOperations,
  matchAsyncAPIRequest,
  generateAsyncAPIResponse,
  validateAsyncAPIResponse,
  createAsyncAPIHandler
} from '../../src/spec-handlers/asyncapi'
import type { Fixture } from '@entente/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AsyncAPI Functional Spec Handler', () => {
  // Load the test AsyncAPI schema
  const sampleAsyncAPISpec = readFileSync(
    resolve(__dirname, '../specs/castles-asyncapi.yaml'),
    'utf-8'
  )

  describe('canHandleAsyncAPI', () => {
    it('should return true for AsyncAPI YAML strings', () => {
      expect(canHandleAsyncAPI(sampleAsyncAPISpec)).toBe(true)
    })

    it('should return true for AsyncAPI objects', () => {
      const asyncApiObject = {
        asyncapi: '2.6.0',
        info: { title: 'Test', version: '1.0.0' },
        channels: {}
      }
      expect(canHandleAsyncAPI(asyncApiObject)).toBe(true)
    })

    it('should return false for non-AsyncAPI specs', () => {
      expect(canHandleAsyncAPI({})).toBe(false)
      expect(canHandleAsyncAPI(null)).toBe(false)
      expect(canHandleAsyncAPI('invalid yaml')).toBe(false)
      expect(canHandleAsyncAPI({ openapi: '3.0.0' })).toBe(false)
    })
  })

  describe('parseAsyncAPISpec', () => {
    it('should parse AsyncAPI YAML strings correctly', () => {
      const result = parseAsyncAPISpec(sampleAsyncAPISpec)

      expect(result.type).toBe('asyncapi')
      expect(result.version).toBe('2.6.0')
      expect(result.spec.asyncapi).toBe('2.6.0')
      expect(result.spec.channels).toBeDefined()
    })

    it('should parse AsyncAPI objects correctly', () => {
      const asyncApiObject = {
        asyncapi: '2.6.0',
        info: { title: 'Test', version: '1.0.0' },
        channels: {
          'test/channel': {
            publish: {
              operationId: 'testPublish',
              message: { payload: { type: 'object' } }
            }
          }
        }
      }

      const result = parseAsyncAPISpec(asyncApiObject)

      expect(result.type).toBe('asyncapi')
      expect(result.spec.channels).toEqual(asyncApiObject.channels)
    })
  })

  describe('extractAsyncAPIOperations', () => {
    it('should extract all operations from AsyncAPI spec', () => {
      const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
      const operations = extractAsyncAPIOperations(apiSpec)

      expect(operations.length).toBeGreaterThan(0)

      // Check for publish operations
      const publishOps = operations.filter(op => op.id.includes('publish'))
      expect(publishOps.length).toBeGreaterThan(0)

      // Check for subscribe operations
      const subscribeOps = operations.filter(op => op.id.includes('subscribe'))
      expect(subscribeOps.length).toBeGreaterThan(0)

      // Check that operations have proper channel references
      const channelOps = operations.filter(op => op.channel)
      expect(channelOps.length).toBe(operations.length)
    })

    it('should handle operations with parameters', () => {
      const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
      const operations = extractAsyncAPIOperations(apiSpec)

      const statusOp = operations.find(op => op.channel === 'castle/status')
      expect(statusOp).toBeDefined()
      expect(statusOp?.id).toBe('subscribeCastleStatus')
    })
  })

  describe('matchAsyncAPIRequest', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)

    it('should match event requests by channel', () => {
      const request = {
        channel: 'castle/created',
        eventType: 'created',
        body: {
          eventId: 'test-event',
          eventType: 'created',
          castle: { id: '123', name: 'Test Castle' }
        }
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeDefined()
      expect(matched?.channel).toBe('castle/created')
    })

    it('should match by channel when exact eventType match not found', () => {
      const request = {
        channel: 'castle/deleted',
        eventType: 'removed', // Different from spec, but channel matches
        body: {
          eventId: 'test-event',
          castleId: '123'
        }
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeDefined()
      expect(matched?.channel).toBe('castle/deleted')
    })

    it('should return null for non-event requests', () => {
      const request = {
        method: 'GET',
        path: '/api/test'
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeNull()
    })
  })

  describe('generateAsyncAPIResponse', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)
    const createdOp = operations.find(op => op.channel === 'castle/created')!

    it('should use fixture data when available', () => {
      const fixture: Fixture = {
        id: 'test-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        serviceVersions: ['1.0.0'],
        specType: 'asyncapi',
        operation: 'publishCastleCreated',
        status: 'approved',
        source: 'manual',
        priority: 1,
        data: {
          response: {
            eventId: 'fixture-event',
            eventType: 'created',
            castle: { id: '1', name: 'Fixture Castle', region: 'Fixture', yearBuilt: 2000 }
          }
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const response = generateAsyncAPIResponse(createdOp, [fixture])

      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
      expect(response.timestamp).toBeDefined()
      expect(response.body.eventType).toBe('created')
    })

    it('should generate mock data when no fixtures available', () => {
      const response = generateAsyncAPIResponse(createdOp, [])

      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
      expect(response.timestamp).toBeDefined()
      expect(response.body).toBeDefined()
    })
  })

  describe('validateAsyncAPIResponse', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)
    const eventOp = operations.find(op => op.type === 'event')!

    it('should validate successful AsyncAPI event responses', () => {
      const expected = { eventId: 'test', timestamp: '2024-01-01T00:00:00Z' }
      const actual = {
        eventId: 'actual-event',
        timestamp: '2024-01-01T00:00:00Z',
        eventType: 'created',
        data: { test: 'value' }
      }

      const result = validateAsyncAPIResponse(eventOp, expected, actual)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required event fields', () => {
      const expected = { eventId: 'test', timestamp: '2024-01-01T00:00:00Z' }
      const actual = { eventType: 'created' } // missing eventId and timestamp

      const result = validateAsyncAPIResponse(eventOp, expected, actual)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('response.eventId')
    })
  })

  describe('createAsyncAPIHandler (functional handler creation)', () => {
    it('should create a working AsyncAPI handler', () => {
      const handler = createAsyncAPIHandler()

      expect(handler.type).toBe('asyncapi')
      expect(handler.name).toBe('AsyncAPI')
      expect(typeof handler.canHandle).toBe('function')
      expect(typeof handler.parseSpec).toBe('function')
      expect(typeof handler.extractOperations).toBe('function')
    })

    it('should work end-to-end with the handler', () => {
      const handler = createAsyncAPIHandler()

      // Test the full flow
      expect(handler.canHandle(sampleAsyncAPISpec)).toBe(true)

      const parsedSpec = handler.parseSpec(sampleAsyncAPISpec)
      expect(parsedSpec.type).toBe('asyncapi')

      const operations = handler.extractOperations(parsedSpec)
      expect(operations.length).toBeGreaterThan(0)

      const request = {
        channel: 'castle/created',
        eventType: 'created',
        body: { eventType: 'created' }
      }
      const matchedOp = handler.matchRequest(request, operations)
      expect(matchedOp?.channel).toBe('castle/created')

      const response = handler.generateResponse(matchedOp!, [])
      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
    })
  })
})