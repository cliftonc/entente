import { beforeEach, vi } from 'vitest'
import { setupFetchMock } from './mocks/fetch.js'
import { setupFsMock } from './mocks/filesystem.js'
import { setupFixturesMock } from './mocks/fixtures.js'
import { setupGitUtilsMock } from './mocks/git-utils.js'
import { setupPrismMock } from './mocks/prism.js'
import { setupMetadataMock } from './mocks/metadata.js'

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
  const metadataMock = setupMetadataMock()

  return {
    fetch: fetchMock,
    prism: prismMock,
    fs: fsMock,
    fixtures: fixturesMock,
    gitUtils: gitUtilsMock,
    metadata: metadataMock,
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
  mocks.fetch.fetch.mockImplementation((url: string, options?: any) => {
    // Handle uploadSpec POST requests
    if (url.includes('/api/specs/') && options?.method === 'POST') {
      return Promise.resolve(mocks.fetch.mockSuccess({ uploaded: true }))
    }

    // Handle spec fetching GET requests
    if (url.includes('/api/specs/')) {
      // Return AsyncAPI spec for castle-events service
      if (url.includes('castle-events')) {
        return Promise.resolve(
          mocks.fetch.mockSuccess({
            spec: {
              asyncapi: '2.6.0',
              info: { title: 'Castle Events API', version: '1.0.0' },
              channels: {
                'castle/created': {
                  description: 'Event fired when a new castle is created',
                  subscribe: {
                    operationId: 'subscribeCastleCreated',
                    message: {
                      payload: {
                        type: 'object',
                        properties: {
                          eventId: { type: 'string' },
                          eventType: { type: 'string' },
                          castle: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                'castle/deleted': {
                  description: 'Event fired when a castle is deleted',
                  subscribe: {
                    operationId: 'subscribeCastleDeleted',
                    message: {
                      payload: {
                        type: 'object',
                        properties: {
                          eventId: { type: 'string' },
                          eventType: { type: 'string' },
                          castleId: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                'castle/status': {
                  description: 'Castle status updates',
                  subscribe: {
                    operationId: 'subscribeCastleStatus',
                    message: {
                      payload: {
                        type: 'object',
                        properties: {
                          eventId: { type: 'string' },
                          castleId: { type: 'string' },
                          status: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            metadata: {
              providerVersion: '1.0.0',
              serviceVersionId: 'sv_async_123',
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

      // Default OpenAPI spec for other services
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

    // Handle mock server requests with special headers
    if (url.includes('/api/ws')) {
      return Promise.resolve(
        mocks.fetch.mockResponse({}, {
          headers: { 'x-detected-type': 'asyncapi' }
        })
      )
    }

    if (url.includes('/events')) {
      return Promise.resolve(
        mocks.fetch.mockResponse({}, {
          headers: {
            'content-type': 'text/event-stream',
            'x-detected-type': 'asyncapi',
            'cache-control': 'no-cache',
            'connection': 'keep-alive'
          }
        })
      )
    }

    return Promise.resolve(mocks.fetch.mockSuccess({}))
  })

  return mocks
}
