import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProvider } from '../src/index.js'
import { mockVerificationTask, mockVerificationTasks } from './mocks/interactions.mock.js'
import { mockPackageJson, mockPackageJsonFallback } from './mocks/package.mock.js'
import {
  mockProviderConfig,
  mockProviderConfigWithoutProvider,
  mockVerifyOptions,
} from './mocks/provider-config.mock.js'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

vi.mock('../src/git-utils.js', () => ({
  getGitSha: vi.fn(() => 'mock-git-sha-abc123'),
}))

global.fetch = vi.fn()

describe('createProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.warn = vi.fn()
    console.log = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create a provider with full config', async () => {
    const { readFileSync } = vi.mocked(await import('node:fs'))
    readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

    const provider = createProvider(mockProviderConfig)

    expect(provider).toHaveProperty('verify')
    expect(provider).toHaveProperty('getVerificationTasks')
    expect(typeof provider.verify).toBe('function')
    expect(typeof provider.getVerificationTasks).toBe('function')
  })

  it('should use package.json fallbacks when config is incomplete', async () => {
    const { readFileSync } = vi.mocked(await import('node:fs'))
    readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

    const provider = createProvider(mockProviderConfigWithoutProvider)

    expect(provider).toBeDefined()
  })

  it('should warn when using fallback values', async () => {
    const { readFileSync } = vi.mocked(await import('node:fs'))
    readFileSync.mockReturnValue(JSON.stringify(mockPackageJsonFallback))

    createProvider(mockProviderConfigWithoutProvider)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Entente provider using fallback values')
    )
  })

  it('should handle package.json read errors gracefully', async () => {
    const { readFileSync } = vi.mocked(await import('node:fs'))
    readFileSync.mockImplementation(() => {
      throw new Error('File not found')
    })

    const provider = createProvider(mockProviderConfigWithoutProvider)

    expect(provider).toBeDefined()
    expect(console.warn).toHaveBeenCalled()
  })

  describe('verify method', () => {
    it('should skip verification when using fallback values', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJsonFallback))

      const provider = createProvider(mockProviderConfigWithoutProvider)
      const result = await provider.verify(mockVerifyOptions)

      expect(result.taskId).toBeNull()
      expect(result.results).toEqual([])
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipping provider verification')
      )
    })

    it('should fetch verification tasks and process them', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)

      // Mock fetch for getting tasks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVerificationTasks),
      } as Response)

      // Mock fetch for replaying requests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ id: 'order-123', status: 'pending' }),
      } as Response)

      // Mock fetch for submitting results
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response)

      const provider = createProvider(mockProviderConfig)
      const result = await provider.verify(mockVerifyOptions)

      expect(result.providerVersion).toBe('1.2.3')
      expect(result.providerGitSha).toBe('mock-git-sha-abc123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/verification/order-service'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key-123',
          }),
        })
      )
    })

    it('should handle fetch errors gracefully', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      const provider = createProvider(mockProviderConfig)

      await expect(provider.verify(mockVerifyOptions)).rejects.toThrow('Network error')
    })

    it('should call state handlers for interactions', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)

      // Mock fetch for getting tasks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockVerificationTask]),
      } as Response)

      // Mock fetch for replaying requests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ id: 'order-123', status: 'pending' }),
      } as Response)

      // Mock fetch for submitting results
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response)

      const provider = createProvider(mockProviderConfig)
      await provider.verify(mockVerifyOptions)

      expect(mockVerifyOptions.stateHandlers?.getOrder).toHaveBeenCalled()
    })

    it('should call cleanup after each interaction', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)

      // Mock fetch for getting tasks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockVerificationTask]),
      } as Response)

      // Mock fetch for replaying requests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ id: 'order-123', status: 'pending' }),
      } as Response)

      // Mock fetch for submitting results
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response)

      const provider = createProvider(mockProviderConfig)
      await provider.verify(mockVerifyOptions)

      expect(mockVerifyOptions.cleanup).toHaveBeenCalledTimes(2) // Once per interaction
    })
  })

  describe('getVerificationTasks method', () => {
    it('should return empty array when using fallback values', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJsonFallback))

      const provider = createProvider(mockProviderConfigWithoutProvider)
      const tasks = await provider.getVerificationTasks()

      expect(tasks).toEqual([])
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipping verification task retrieval')
      )
    })

    it('should fetch verification tasks from API', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerificationTasks),
      } as Response)

      const provider = createProvider(mockProviderConfig)
      const tasks = await provider.getVerificationTasks('test')

      expect(tasks).toEqual(mockVerificationTasks)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://entente.example.com/api/verification/order-service?environment=test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key-123',
          }),
        })
      )
    })

    it('should handle API errors', async () => {
      const { readFileSync } = vi.mocked(await import('node:fs'))
      readFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as Response)

      const provider = createProvider(mockProviderConfig)

      await expect(provider.getVerificationTasks()).rejects.toThrow(
        'Failed to get verification tasks: Not Found'
      )
    })
  })
})
