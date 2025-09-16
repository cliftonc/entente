import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderConfig } from '@entente/types'
import { createProvider } from '../src/index.js'
import {
  mockFetch,
  createMockResponse,
  mockNormalizedFixtures,
  mockVerificationTasks,
  setupSuccessfulMocks,
  setupFailedFixturesMock,
  mockPackageJson
} from './setup.js'

describe('Normalized Fixtures', () => {
  const mockConfig: ProviderConfig = {
    serviceUrl: 'https://entente.test.com',
    apiKey: 'test-api-key',
    provider: 'test-service',
    providerVersion: '1.0.0',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('successful download and setup', () => {
    it('should download and setup normalized fixtures', async () => {
      const dataSetupCallback = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      setupSuccessfulMocks()

      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).toHaveBeenCalledWith(mockNormalizedFixtures)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://entente.test.com/api/fixtures/normalized/test-service/1.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should work with mixed normalized fixtures and state handlers', async () => {
      const dataSetupCallback = vi.fn()
      const stateHandler = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      setupSuccessfulMocks()

      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
        stateHandlers: {
          getUser: stateHandler,
        },
      })

      expect(dataSetupCallback).toHaveBeenCalledWith(mockNormalizedFixtures)
      expect(stateHandler).toHaveBeenCalledOnce()
    })
  })

  describe('error handling', () => {
    it('should handle fixture download failure gracefully', async () => {
      const dataSetupCallback = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      setupFailedFixturesMock()

      const result = await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should handle dataSetupCallback errors gracefully', async () => {
      const dataSetupCallback = vi.fn().mockRejectedValue(new Error('Database error'))
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      setupSuccessfulMocks()

      const result = await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).toHaveBeenCalledWith(mockNormalizedFixtures)
      expect(result).toBeDefined()
    })

    it('should handle network errors when downloading fixtures', async () => {
      const dataSetupCallback = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockFetch.mockResolvedValueOnce(createMockResponse(mockVerificationTasks))
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123', name: 'John' }))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      const result = await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })

  describe('configuration options', () => {
    it('should not download fixtures when useNormalizedFixtures is false', async () => {
      const dataSetupCallback = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: false,
        dataSetupCallback,
      })

      mockFetch.mockResolvedValueOnce(createMockResponse(mockVerificationTasks))
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123', name: 'John' }))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/fixtures/normalized/'),
        expect.any(Object)
      )
    })

    it('should not download fixtures when dataSetupCallback is not provided', async () => {
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        // No dataSetupCallback
      })

      mockFetch.mockResolvedValueOnce(createMockResponse(mockVerificationTasks))
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123', name: 'John' }))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/fixtures/normalized/'),
        expect.any(Object)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty normalized fixtures', async () => {
      const emptyFixtures = {
        entities: {},
        relationships: [],
        metadata: {
          service: 'test-service',
          version: '1.0.0',
          totalFixtures: 0,
          extractedAt: new Date(),
        },
      }

      const dataSetupCallback = vi.fn()
      const provider = createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback,
      })

      mockFetch.mockResolvedValueOnce(createMockResponse(emptyFixtures))
      mockFetch.mockResolvedValueOnce(createMockResponse([]))

      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      expect(dataSetupCallback).toHaveBeenCalledWith(emptyFixtures)
    })

    // Note: Fallback provider detection tested in other test suites
    // since it requires complex mocking of file system operations
  })
})