import { vi } from 'vitest'

export interface MockPrismInstance {
  request: (req: any, operations: any[]) => Promise<{ output?: any }>
}

export interface MockHttpServer {
  listen: (port: number, callback?: (err?: Error) => void) => void
  close: (callback?: () => void) => void
}

export const createMockPrismHttp = () => {
  const mockInstance: MockPrismInstance = {
    request: vi.fn().mockResolvedValue({
      output: {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: { message: 'mocked response' },
      },
    }),
  }

  const mockHttpServer: MockHttpServer = {
    listen: vi.fn().mockImplementation((port, callback) => {
      if (callback) callback()
    }),
    close: vi.fn().mockImplementation(callback => {
      if (callback) callback()
    }),
  }

  const mockCreateInstance = vi.fn().mockReturnValue(mockInstance)
  const mockGetHttpOperationsFromSpec = vi.fn().mockResolvedValue([
    {
      method: 'get',
      path: '/test',
      operationId: 'getTest',
    },
  ])

  const mockCreateServer = vi.fn().mockReturnValue(mockHttpServer)

  return {
    createInstance: mockCreateInstance,
    getHttpOperationsFromSpec: mockGetHttpOperationsFromSpec,
    mockInstance,
    mockHttpServer,
    mockCreateServer,
  }
}

// Mock the entire @stoplight/prism-http module
export const setupPrismMock = () => {
  const prismMock = createMockPrismHttp()

  vi.doMock('@stoplight/prism-http', () => prismMock)
  vi.doMock('http', () => ({
    createServer: prismMock.mockCreateServer,
  }))
  vi.doMock('url', () => ({
    URL: class URL {
      pathname: string
      searchParams: Map<string, string>

      constructor(url: string, base?: string) {
        const [pathname, search] = url.split('?')
        this.pathname = pathname
        this.searchParams = new Map()
        if (search) {
          search.split('&').forEach(param => {
            const [key, value] = param.split('=')
            this.searchParams.set(key, decodeURIComponent(value))
          })
        }
      }

      entries() {
        return this.searchParams.entries()
      }
    },
  }))

  return prismMock
}
