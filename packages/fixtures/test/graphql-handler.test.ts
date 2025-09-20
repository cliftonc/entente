import { describe, it, expect } from 'vitest'
import {
  canHandleGraphQL,
  parseGraphQLSpec,
  extractGraphQLOperations,
  createGraphQLHandler
} from '../src/spec-handlers/graphql.js'
import type { APISpec } from '@entente/types'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('GraphQL Handler', () => {
  const castlesGraphQLSchema = readFileSync(
    resolve(__dirname, 'specs/castles.graphql'),
    'utf-8'
  )

  describe('canHandleGraphQL', () => {
    it('should detect GraphQL SDL strings', () => {
      expect(canHandleGraphQL(castlesGraphQLSchema)).toBe(true)
    })

    it('should detect GraphQL schema objects', () => {
      const schemaObject = {
        schema: castlesGraphQLSchema,
        introspection: {}
      }
      expect(canHandleGraphQL(schemaObject)).toBe(true)
    })

    it('should reject non-GraphQL content', () => {
      expect(canHandleGraphQL('not graphql')).toBe(false)
      expect(canHandleGraphQL(123)).toBe(false)
      expect(canHandleGraphQL(null)).toBe(false)
    })
  })

  describe('parseGraphQLSpec', () => {
    it('should parse GraphQL SDL string', () => {
      const spec = parseGraphQLSpec(castlesGraphQLSchema)

      expect(spec.type).toBe('graphql')
      expect(spec.version).toBe('1.0')
      expect(spec.spec).toHaveProperty('schema')
      expect(spec.spec).toHaveProperty('introspection')
    })
  })

  describe('extractGraphQLOperations', () => {
    it('should extract operations from GraphQL schema', () => {
      const spec: APISpec = {
        type: 'graphql',
        version: '1.0',
        spec: {
          schema: castlesGraphQLSchema,
          introspection: {}
        }
      }

      const operations = extractGraphQLOperations(spec)

      expect(operations.length).toBeGreaterThan(0)

      // Should find Query operations
      const listCastlesOp = operations.find(op => op.id === 'Query.listCastles')
      expect(listCastlesOp).toBeDefined()
      expect(listCastlesOp?.type).toBe('query')

      // Should find Mutation operations
      const createCastleOp = operations.find(op => op.id === 'Mutation.createCastle')
      expect(createCastleOp).toBeDefined()
      expect(createCastleOp?.type).toBe('mutation')
    })
  })

  describe('createGraphQLHandler', () => {
    it('should create a functioning GraphQL handler', () => {
      const handler = createGraphQLHandler()

      expect(handler.type).toBe('graphql')
      expect(handler.name).toBe('GraphQL')
      expect(typeof handler.canHandle).toBe('function')
      expect(typeof handler.parseSpec).toBe('function')
      expect(typeof handler.extractOperations).toBe('function')
    })
  })
})