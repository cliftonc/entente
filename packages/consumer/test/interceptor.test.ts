import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ClientConfig, OpenAPISpec } from '@entente/types'
import { setupDefaultMocks } from '../tests/setup.js'

// Mock the MSW interceptors since they're not available in test environment
vi.mock('@mswjs/interceptors', () => ({
  BatchInterceptor: vi.fn().mockImplementation(() => ({
    apply: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn().mockReturnValue(undefined),
  })),
}))

vi.mock('@mswjs/interceptors/ClientRequest', () => ({
  ClientRequestInterceptor: vi.fn(),
}))

vi.mock('@mswjs/interceptors/fetch', () => ({
  FetchInterceptor: vi.fn(),
}))

describe('Request Interceptor', () => {
  let mocks: ReturnType<typeof setupDefaultMocks>

  beforeEach(() => {
    mocks = setupDefaultMocks()
  })

  describe('patchRequests', () => {
    it('should create a request interceptor', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = await createClient(config)
      const interceptor = await client.patchRequests('test-service', '1.0.0')

      expect(interceptor).toBeDefined()
      expect(interceptor.unpatch).toBeDefined()
      expect(interceptor.isPatched).toBeDefined()
      expect(interceptor.getInterceptedCalls).toBeDefined()
      expect(interceptor.getRecordedInteractions).toBeDefined()
      expect(interceptor.getStats).toBeDefined()
      expect(typeof interceptor.unpatch).toBe('function')
      expect(typeof interceptor.isPatched).toBe('function')
      expect(typeof interceptor.getInterceptedCalls).toBe('function')
      expect(typeof interceptor.getRecordedInteractions).toBe('function')
      expect(typeof interceptor.getStats).toBe('function')

      // Clean up
      await interceptor.unpatch()
    })

    it('should support Symbol.dispose for automatic cleanup', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = await createClient(config)

      // Test the Symbol.dispose pattern
      {
        // @ts-ignore - using is not yet widely supported in TypeScript
        using interceptor = await client.patchRequests('test-service', '1.0.0')

        expect(interceptor).toBeDefined()
        expect(interceptor.isPatched()).toBe(true)

      } // Should automatically dispose here

      // Note: In a real environment, the interceptor would be disposed automatically
      // but in our mocked environment, we can't test the actual disposal behavior
    })

    it('should support interception options', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = await createClient(config)

      const interceptor = await client.patchRequests('test-service', '1.0.0', {
        recording: true,
        filter: (url) => url.includes('api.example.com'),
      })

      expect(interceptor).toBeDefined()

      // Clean up
      await interceptor.unpatch()
    })

    it('should warn when using fallback values', async () => {
      const { createClient } = await import('../src/index.js')

      // Enable fallback mode for metadata
      mocks.metadata.setFallbackMode(true)

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const client = await createClient(config)
      const interceptor = await client.patchRequests('test-service', '1.0.0')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Entente request interception using fallback values')
      )

      await interceptor.unpatch()
      consoleSpy.mockRestore()

      // Reset fallback mode
      mocks.metadata.setFallbackMode(false)
    })
  })

  describe('downloadFixtures', () => {
    it('should download fixtures for a service', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = await createClient(config)
      const fixtures = await client.downloadFixtures('test-service', '1.0.0')

      expect(Array.isArray(fixtures)).toBe(true)
      // In our mock environment, fixtures should be empty or mocked
    })

    it('should skip download when using fallback values', async () => {
      const { createClient } = await import('../src/index.js')

      // Enable fallback mode for metadata
      mocks.metadata.setFallbackMode(true)

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const client = await createClient(config)
      const fixtures = await client.downloadFixtures('test-service', '1.0.0')

      expect(fixtures).toEqual([])

      // Reset fallback mode
      mocks.metadata.setFallbackMode(false)
    })
  })

  describe('usage patterns', () => {
    it('should demonstrate typical usage with different HTTP clients', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = await createClient(config)

      // Example usage (in real environment, these would intercept actual requests)
      {
        // @ts-ignore - using is not yet widely supported
        using interceptor = await client.patchRequests('order-service', '2.1.0')

        // These would normally be intercepted in a real environment:
        // await fetch('https://api.example.com/orders/123')
        // await axios.get('https://api.example.com/orders/123')
        // await request(app).get('/orders/123')

        const stats = interceptor.getStats()
        expect(stats).toEqual({ fetch: 0, http: 0, total: 0 })

        const calls = interceptor.getInterceptedCalls()
        expect(calls).toEqual([])

        const interactions = interceptor.getRecordedInteractions()
        expect(interactions).toEqual([])
      }
    })
  })
})