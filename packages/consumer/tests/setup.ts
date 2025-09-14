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
      version: '1.0.0',
    })
  )

  // Setup default fetch responses
  mocks.fetch.fetch.mockImplementation((url: string, options?: any) => {
    if (url.includes('/api/specs/')) {
      return Promise.resolve(
        mocks.fetch.mockSuccess({
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
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
