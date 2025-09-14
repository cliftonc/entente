import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as config from './config.js'
import * as gitUtils from './git-utils.js'

// Mock external dependencies
vi.mock('node:fs/promises')
vi.mock('./config.js')
vi.mock('./git-utils.js')
vi.mock('@entente/fixtures')

// Mock chalk - return the input string for testing
vi.mock('chalk', () => ({
  default: {
    green: (str: string) => str,
    yellow: (str: string) => str,
    blue: (str: string) => str,
    red: (str: string) => str,
    gray: (str: string) => str,
  },
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import the functions after mocking
const {
  uploadSpec,
  recordDeployment,
  canIDeploy,
  getDeploymentStatus,
  registerService,
  deployConsumer,
  deployProvider,
} = await import('./index.js')

describe('CLI Core Functions', () => {
  const mockReadFile = vi.mocked(fs.readFile)
  const mockGetApiKey = vi.mocked(config.getApiKey)
  const mockGetServerUrl = vi.mocked(config.getServerUrl)
  const mockGetGitSha = vi.mocked(gitUtils.getGitSha)
  const mockGetGitRepositoryUrl = vi.mocked(gitUtils.getGitRepositoryUrl)

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetApiKey.mockResolvedValue('test-api-key')
    mockGetServerUrl.mockResolvedValue('https://test.entente.dev')
    mockGetGitSha.mockReturnValue('abc123')
    mockGetGitRepositoryUrl.mockResolvedValue('https://github.com/test/repo')
  })

  describe('uploadSpec', () => {
    it('should upload OpenAPI spec successfully', async () => {
      const mockSpec = { openapi: '3.0.0', info: { title: 'Test API' } }
      mockReadFile.mockResolvedValue(JSON.stringify(mockSpec))

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ isNew: true }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await uploadSpec({
        service: 'test-service',
        version: '1.0.0',
        spec: '/path/to/spec.json',
        environment: 'test',
      })

      expect(mockReadFile).toHaveBeenCalledWith('/path/to/spec.json', 'utf-8')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/specs/test-service',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test-service'),
        })
      )
    })

    it('should handle invalid spec file', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'))

      await expect(
        uploadSpec({
          service: 'test-service',
          version: '1.0.0',
          spec: '/invalid/path.json',
          environment: 'test',
        })
      ).rejects.toThrow('Failed to read spec file')
    })

    it('should handle API errors', async () => {
      const mockSpec = { openapi: '3.0.0' }
      mockReadFile.mockResolvedValue(JSON.stringify(mockSpec))

      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({ error: 'Invalid spec' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(
        uploadSpec({
          service: 'test-service',
          version: '1.0.0',
          spec: '/path/to/spec.json',
          environment: 'test',
        })
      ).rejects.toThrow('Failed to upload spec: Invalid spec')
    })
  })

  describe('recordDeployment', () => {
    it('should record deployment successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'deployment-123' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await recordDeployment({
        service: 'test-service',
        version: '1.0.0',
        environment: 'production',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/deployments',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"service":"test-service"'),
        })
      )
    })

    it('should handle deployment recording failure', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server error'),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(
        recordDeployment({
          service: 'test-service',
          version: '1.0.0',
          environment: 'production',
        })
      ).rejects.toThrow('Failed to record deployment: 500 Internal Server Error - Server error')
    })
  })

  describe('canIDeploy', () => {
    it('should check deployment compatibility', async () => {
      const mockResult = {
        canDeploy: true,
        reason: 'All tests passing',
        verifications: [],
      }
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockResult),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await canIDeploy({
        service: 'test-consumer',
        version: '1.0.0',
        environment: 'production',
      })

      expect(result).toEqual(mockResult)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/can-i-deploy?service=test-consumer&version=1.0.0&environment=production',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should handle backward compatibility with consumer parameter', async () => {
      const mockResult = { canDeploy: false }
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockResult),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await canIDeploy({
        consumer: 'legacy-consumer',
        version: '1.0.0',
        environment: 'production',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('service=legacy-consumer'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })
  })

  describe('registerService', () => {
    it('should register a new service', async () => {
      const mockPackageJson = {
        name: 'test-service',
        version: '1.0.0',
        description: 'Test service',
      }
      mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson))

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          isNew: true,
          id: 'service-123',
          createdAt: '2024-01-01',
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await registerService({
        name: 'test-service',
        type: 'provider',
        packagePath: './package.json',
        description: 'Test provider service',
      })

      expect(mockReadFile).toHaveBeenCalledWith('./package.json', 'utf-8')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/services',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"provider"'),
        })
      )
    })

    it('should handle package.json reading failure', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'))

      await expect(
        registerService({
          name: 'test-service',
          type: 'consumer',
          packagePath: './invalid.json',
        })
      ).rejects.toThrow('Failed to read package.json from ./invalid.json')
    })
  })

  describe('getDeploymentStatus', () => {
    it('should get active deployments', async () => {
      const mockDeployments = [
        {
          service: 'service-a',
          version: '1.0.0',
          deployedAt: '2024-01-01T00:00:00Z',
        },
        {
          service: 'service-b',
          version: '2.0.0',
          deployedAt: '2024-01-01T01:00:00Z',
        },
      ]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockDeployments),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await getDeploymentStatus('production')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/deployments/active?environment=production',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should handle empty deployment list', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await getDeploymentStatus('staging')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('environment=staging'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })
  })

  describe('deployConsumer', () => {
    it('should deploy consumer successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          deployment: { id: 'deployment-123' },
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await deployConsumer({
        name: 'test-consumer',
        version: '1.0.0',
        environment: 'production',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/deployments/consumer',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"test-consumer"'),
        })
      )
    })
  })

  describe('deployProvider', () => {
    it('should deploy provider successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          deployment: { id: 'deployment-456' },
        }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await deployProvider({
        name: 'test-provider',
        version: '2.0.0',
        environment: 'staging',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.entente.dev/api/deployments/provider',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"test-provider"'),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'))

      await expect(
        recordDeployment({
          service: 'test-service',
          version: '1.0.0',
          environment: 'production',
        })
      ).rejects.toThrow('Cannot connect to Entente server')
    })

    it('should handle authentication errors', async () => {
      const mockSpec = { openapi: '3.0.0' }
      mockReadFile.mockResolvedValue(JSON.stringify(mockSpec))
      mockGetApiKey.mockResolvedValue(undefined)

      await expect(
        uploadSpec({
          service: 'test-service',
          version: '1.0.0',
          spec: '/path/to/spec.json',
          environment: 'test',
        })
      ).rejects.toThrow('Not authenticated. Please run "entente login" first.')
    })

    it('should handle 401 unauthorized responses', async () => {
      const mockSpec = { openapi: '3.0.0' }
      mockReadFile.mockResolvedValue(JSON.stringify(mockSpec))

      const mockResponse = {
        ok: false,
        status: 401,
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(
        uploadSpec({
          service: 'test-service',
          version: '1.0.0',
          spec: '/path/to/spec.json',
          environment: 'test',
        })
      ).rejects.toThrow('Authentication failed. Please run "entente login" to re-authenticate.')
    })
  })

  describe('Configuration Integration', () => {
    it('should use custom server URL from config', async () => {
      mockGetServerUrl.mockResolvedValue('https://custom.entente.dev')

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await getDeploymentStatus('production')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.entente.dev/api/deployments/active?environment=production',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })
  })

  describe('Git Integration', () => {
    it('should include git SHA in deployment records', async () => {
      mockGetGitSha.mockReturnValue('custom-sha-123')

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'deployment-123' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await recordDeployment({
        service: 'test-service',
        version: '1.0.0',
        environment: 'production',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"gitSha":"custom-sha-123"'),
        })
      )
    })

    it('should handle missing git SHA gracefully', async () => {
      mockGetGitSha.mockReturnValue(null)

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'deployment-123' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      await recordDeployment({
        service: 'test-service',
        version: '1.0.0',
        environment: 'production',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"gitSha":null'),
        })
      )
    })
  })
})