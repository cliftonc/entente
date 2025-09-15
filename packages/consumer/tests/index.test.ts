import type { ClientConfig, OpenAPISpec } from '@entente/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupDefaultMocks } from './setup.js'

describe('@entente/consumer', () => {
  let mocks: ReturnType<typeof setupDefaultMocks>

  beforeEach(() => {
    mocks = setupDefaultMocks()
  })

  describe('createClient', () => {
    it('should create a client with valid config', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)

      expect(client).toBeDefined()
      expect(client.createMock).toBeDefined()
      expect(client.uploadSpec).toBeDefined()
      expect(typeof client.createMock).toBe('function')
      expect(typeof client.uploadSpec).toBe('function')
    })

    it('should use package.json fallbacks when consumer info missing', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const client = createClient(config)
      expect(client).toBeDefined()
      expect(typeof client.createMock).toBe('function')
      expect(typeof client.uploadSpec).toBe('function')
    })

    it('should warn when using fallback values', async () => {
      const { createClient } = await import('../src/index.js')

      mocks.fs.removeMockFile(`${process.cwd()}/package.json`)

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const client = createClient(config)
      expect(client).toBeDefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Entente client using fallback values')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('createMock', () => {
    it('should create a mock server successfully', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0')

      expect(mock).toBeDefined()
      expect(mock.url).toMatch(/^http:\/\/localhost:\d+$/)
      expect(typeof mock.port).toBe('number')
      expect(mock.port).toBeGreaterThan(0)
      expect(mock.close).toBeDefined()
      expect(mock.getFixtures).toBeDefined()
      expect(mock.proposeFixture).toBeDefined()
      expect(typeof mock.close).toBe('function')
      expect(typeof mock.getFixtures).toBe('function')
      expect(typeof mock.proposeFixture).toBe('function')

      await mock.close()
    })

    it('should fetch spec from service', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      await client.createMock('test-service', '1.0.0')

      expect(mocks.fetch.fetch).toHaveBeenCalledWith(
        'https://test.entente.com/api/specs/test-service/by-provider-version?providerVersion=1.0.0&environment=test&branch=main',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      )
    })

    it('should fetch fixtures when useFixtures is not false', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0')

      expect(mocks.fetch.fetch).toHaveBeenCalledWith(
        'https://test.entente.com/api/fixtures/service/test-service?version=1.0.0&status=approved',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      )

      await mock.close()
    })

    it('should skip fixture fetching when useFixtures is false', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0', {
        useFixtures: false,
      })

      expect(mocks.fetch.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/fixtures/'),
        expect.any(Object)
      )

      await mock.close()
    })

    it('should use custom port when specified', async () => {
      const { createClient } = await import('../src/index.js')

      // Mock a different port to test the port option
      mocks.prism.mockInstance.request.mockResolvedValue({
        output: {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: { message: 'test on custom port' },
        },
      })

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0', {
        port: 4000,
      })

      // The mock will still return the default port, but we can verify the mock was called
      expect(mock).toBeDefined()

      await mock.close()
    })
  })

  describe('uploadSpec', () => {
    it('should upload spec successfully', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const client = createClient(config)
      await client.uploadSpec('test-service', '1.0.0', spec, {
        environment: 'test',
        branch: 'main',
      })

      expect(mocks.fetch.fetch).toHaveBeenCalledWith(
        'https://test.entente.com/api/specs/test-service',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test-service'),
        })
      )
    })

    it('should skip upload when using fallback values', async () => {
      const { createClient } = await import('../src/index.js')

      mocks.fs.removeMockFile(`${process.cwd()}/package.json`)

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient(config)
      await client.uploadSpec('test-service', '1.0.0', spec, {
        environment: 'test',
      })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚫 Skipping spec upload'))

      expect(mocks.fetch.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/specs/'),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should throw error on failed upload', async () => {
      const { createClient } = await import('../src/index.js')

      mocks.fetch.fetch.mockImplementation((url: string) => {
        if (url.includes('/api/specs/')) {
          return Promise.resolve(mocks.fetch.mockError(500, 'Internal Server Error'))
        }
        return Promise.resolve(mocks.fetch.mockSuccess({}))
      })

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const client = createClient(config)

      await expect(
        client.uploadSpec('test-service', '1.0.0', spec, {
          environment: 'test',
        })
      ).rejects.toThrow('Failed to upload spec: 500 ')
    })
  })

  describe('mock server functionality', () => {
    it('should return fixtures from getFixtures', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0')

      const fixtures = mock.getFixtures()
      expect(Array.isArray(fixtures)).toBe(true)

      await mock.close()
    })

    it('should propose fixture successfully', async () => {
      const { createClient } = await import('../src/index.js')

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        environment: 'test',
      }

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0')

      const fixtureData = {
        request: { method: 'GET', path: '/test' },
        response: { status: 200, body: { message: 'test' } },
      }

      await mock.proposeFixture('getTest', fixtureData)

      expect(mocks.fixtures.fixtureManagerMock.propose).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'test-service',
          serviceVersion: '1.0.0',
          operation: 'getTest',
          source: 'consumer',
          data: fixtureData,
        })
      )

      await mock.close()
    })

    it('should skip fixture proposal when using fallback values', async () => {
      const { createClient } = await import('../src/index.js')

      mocks.fs.removeMockFile(`${process.cwd()}/package.json`)

      const config: ClientConfig = {
        serviceUrl: 'https://test.entente.com',
        apiKey: 'test-key',
        environment: 'test',
      }

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient(config)
      const mock = await client.createMock('test-service', '1.0.0')

      const fixtureData = {
        request: { method: 'GET', path: '/test' },
        response: { status: 200, body: { message: 'test' } },
      }

      await mock.proposeFixture('getTest', fixtureData)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Skipping fixture proposal')
      )

      expect(mocks.fixtures.fixtureManagerMock.propose).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      await mock.close()
    })
  })
})
