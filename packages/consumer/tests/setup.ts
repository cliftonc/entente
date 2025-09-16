import { beforeEach, vi } from 'vitest'
import { setupFetchMock } from './mocks/fetch.js'
import { setupFsMock } from './mocks/filesystem.js'
import { setupFixturesMock } from './mocks/fixtures.js'
import { setupGitUtilsMock } from './mocks/git-utils.js'
import { setupPrismMock } from './mocks/prism.js'

// Setup all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// Export mock factories for use in tests
export const createTestMocks = () => {
  const fetchMock = setupFetchMock()
  const prismMock = setupPrismMock()
  const fsMock = setupFsMock()
  const fixturesMock = setupFixturesMock()
  const gitUtilsMock = setupGitUtilsMock()

  return {
    fetch: fetchMock,
    prism: prismMock,
    fs: fsMock,
    fixtures: fixturesMock,
    gitUtils: gitUtilsMock,
  }
}

// Default mock setup for common test scenarios
export const setupDefaultMocks = () => {
  const mocks = createTestMocks()

  // Setup default package.json at the current working directory
  mocks.fs.setMockFile(
    `${process.cwd()}/package.json`,
    JSON.stringify({
      name: 'test-consumer',
      version: '1.2.3', // Realistic consumer version
    })
  )

  // Setup default fetch responses
  mocks.fetch.fetch.mockImplementation((url: string, _options?: any) => {
    if (url.includes('/api/specs/')) {
      return Promise.resolve(
        mocks.fetch.mockSuccess({
          spec: {
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' }, // This should be ignored!
            paths: {
              '/test': {
                get: {
                  operationId: 'getTest',
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          example: { message: 'test response' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          metadata: {
            providerVersion: '2.1.0', // This is the actual provider version that should be used
            serviceVersionId: 'sv_123',
            environment: 'test',
            branch: 'main',
            hasSpec: true,
            createdAt: '2024-01-01T00:00:00Z',
            resolvedFromLatest: false,
            isDeployed: true,
          },
        })
      )
    }

    if (url.includes('/api/fixtures/')) {
      return Promise.resolve(mocks.fetch.mockSuccess([]))
    }

    if (url.includes('/api/interactions/batch')) {
      return Promise.resolve(
        mocks.fetch.mockSuccess({
          results: { recorded: 1, duplicates: 0 },
        })
      )
    }

    return Promise.resolve(mocks.fetch.mockSuccess({}))
  })

  return mocks
}
