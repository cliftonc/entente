import { describe, it, expect } from 'vitest'
import {
  canHandleOpenAPI,
  parseOpenAPISpec,
  extractOpenAPIOperations,
  validateOpenAPIResponse,
  createOpenAPIHandler,
  convertOpenAPIMockDataToFixtures,
  matchOpenAPIOperation,
  generateOpenAPIResponseV2
} from '../../src/spec-handlers/openapi'
import type { OpenAPISpec, FixtureReference } from '@entente/types'
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

  describe('matchOpenAPIOperation', () => {
    const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
    const operations = extractOpenAPIOperations(apiSpec)

    it('should match exact paths', () => {
      const request = {
        method: 'GET',
        path: '/castles'
      }

      const result = matchOpenAPIOperation({
        request,
        operations,
        specType: 'openapi'
      })
      expect(result.selected?.operation.id).toBe('listCastles')
    })

    it('should match path parameters', () => {
      const request = {
        method: 'GET',
        path: '/castles/123'
      }

      const result = matchOpenAPIOperation({
        request,
        operations,
        specType: 'openapi'
      })
      expect(result.selected?.operation.id).toBe('getCastle')
    })

    it('should return null for non-matching requests', () => {
      const request = {
        method: 'PATCH', // Method that doesn't exist in the spec
        path: '/nonexistent'
      }

      const result = matchOpenAPIOperation({
        request,
        operations,
        specType: 'openapi'
      })
      expect(result.selected).toBeNull()
    })
  })

  describe('generateOpenAPIResponseV2', () => {
    const apiSpec = parseOpenAPISpec(sampleOpenAPISpec)
    const operations = extractOpenAPIOperations(apiSpec)
    const listOp = operations.find(op => op.id === 'listCastles')!

    it('should use fixture data when available', () => {
      const fixture: FixtureReference = {
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

      const request = {
        method: 'GET',
        path: '/castles',
        headers: {},
        query: {},
        body: null
      }

      const match = {
        operation: listOp,
        confidence: 1.0,
        reasons: ['Test match'],
        metrics: {},
        parameters: {}
      }

      const response = generateOpenAPIResponseV2({
        operation: listOp,
        fixtures: [fixture],
        request,
        match
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        { id: '1', name: 'Test Castle', region: 'Test', yearBuilt: 2000 }
      ])
    })

    it('should generate mock data when no fixtures available', () => {
      const request = {
        method: 'GET',
        path: '/castles',
        headers: {},
        query: {},
        body: null
      }

      const match = {
        operation: listOp,
        confidence: 1.0,
        reasons: ['Test match'],
        metrics: {},
        parameters: {}
      }

      const response = generateOpenAPIResponseV2({
        operation: listOp,
        fixtures: [],
        request,
        match
      })

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

      const request = { method: 'GET', path: '/castles', headers: {}, query: {}, body: null }
      const matchResult = handler.matchOperation({
        request,
        operations,
        specType: 'openapi'
      })
      expect(matchResult.selected?.operation.id).toBe('listCastles')

      const response = handler.generateResponse({
        operation: matchResult.selected!.operation,
        fixtures: [],
        request,
        match: matchResult.selected!
      })
      expect(response.status).toBe(200)
    })
  })

  describe('Edge Cases and Brittleness Fixes', () => {
    describe('Prism iid field support', () => {
      it('should extract operations with iid field instead of operationId', () => {
        const prismSpec = {
          openapi: '3.0.3',
          info: { title: 'Prism Test', version: '1.0.0' },
          paths: {
            '/posts': {
              get: {
                iid: 'listPosts', // Prism uses iid instead of operationId
                summary: 'List posts',
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(prismSpec)
        const operations = extractOpenAPIOperations(apiSpec)

        expect(operations).toHaveLength(1)
        expect(operations[0].id).toBe('listPosts')
        expect(operations[0].method).toBe('GET')
        expect(operations[0].path).toBe('/posts')
      })

      it('should prefer iid over operationId when both exist', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/posts': {
              get: {
                iid: 'listPostsFromPrism',
                operationId: 'listPosts',
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const operations = extractOpenAPIOperations(apiSpec)

        expect(operations[0].id).toBe('listPostsFromPrism')
      })
    })

    describe('Missing operationId handling', () => {
      it('should generate operationId when neither iid nor operationId exist', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/posts': {
              get: {
                summary: 'List posts',
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const operations = extractOpenAPIOperations(apiSpec)

        expect(operations).toHaveLength(1)
        expect(operations[0].id).toBe('GET./posts') // Generated ID
        expect(operations[0].method).toBe('GET')
        expect(operations[0].path).toBe('/posts')
      })
    })

    describe('Complex path pattern matching', () => {
      it('should match custom URL patterns like /blah/post/create', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/blah/post/create': {
              post: {
                operationId: 'createPost',
                responses: { '201': { description: 'Created' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const operations = extractOpenAPIOperations(apiSpec)
        const createOp = operations.find(op => op.id === 'createPost')!

        const request = {
          method: 'POST',
          path: '/blah/post/create'
        }

        const matchResult = matchOpenAPIOperation({
          request,
          operations,
          specType: 'openapi'
        })
        expect(matchResult.selected?.operation.id).toBe('createPost')
      })

      it('should handle multiple path parameters', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/users/{userId}/posts/{postId}/comments': {
              get: {
                operationId: 'getPostComments',
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const operations = extractOpenAPIOperations(apiSpec)

        const request = {
          method: 'GET',
          path: '/users/123/posts/456/comments'
        }

        const matchResult = matchOpenAPIOperation({
          request,
          operations,
          specType: 'openapi'
        })
        expect(matchResult.selected?.operation.id).toBe('getPostComments')
      })

      it('should handle versioned API paths', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/api/v1/posts/{id}': {
              get: {
                operationId: 'getPost',
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const operations = extractOpenAPIOperations(apiSpec)

        const request = {
          method: 'GET',
          path: '/api/v1/posts/123'
        }

        const matchResult = matchOpenAPIOperation({
          request,
          operations,
          specType: 'openapi'
        })
        expect(matchResult.selected?.operation.id).toBe('getPost')
      })
    })

    describe('Mock data to fixture conversion with actual paths', () => {
      it('should use actual paths from spec instead of inferring', () => {
        const spec = {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          paths: {
            '/blah/post/create': {
              post: {
                operationId: 'createPost',
                responses: { '201': { description: 'Created' } }
              }
            }
          }
        }

        const mockData = {
          createPost: {
            success: {
              status: 201,
              body: { id: '123', title: 'Test Post' }
            }
          }
        }

        const apiSpec = parseOpenAPISpec(spec)
        const fixtures = convertOpenAPIMockDataToFixtures(mockData, 'test-service', '1.0.0', apiSpec)

        expect(fixtures).toHaveLength(1)
        const requestData = fixtures[0].data.request as any
        expect(requestData.path).toBe('/blah/post/create') // Actual path from spec
        expect(requestData.method).toBe('POST')
      })

      it('should fall back to inference when operation not found in spec', () => {
        const mockData = {
          createPost: {
            success: {
              status: 201,
              body: { id: '123', title: 'Test Post' }
            }
          }
        }

        // No spec provided, should use inference
        const fixtures = convertOpenAPIMockDataToFixtures(mockData, 'test-service', '1.0.0')

        expect(fixtures).toHaveLength(1)
        const requestData = fixtures[0].data.request as any
        expect(requestData.path).toBe('/posts') // Inferred path
        expect(requestData.method).toBe('POST')
      })
    })
  })
})