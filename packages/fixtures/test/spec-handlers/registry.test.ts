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