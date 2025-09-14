import { vi } from 'vitest'

export interface MockFetchResponse {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<any>
}

export const createMockFetch = () => {
  const mockFetch = vi.fn()

  const mockResponse = (data: any, options: { status?: number; ok?: boolean } = {}) => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.status === 404 ? 'Not Found' : 'OK',
    json: vi.fn().mockResolvedValue(data),
  })

  return {
    fetch: mockFetch,
    mockResponse,
    mockSuccess: (data: any) => mockResponse(data),
    mockError: (status: number, message: string) =>
      mockResponse({ error: message }, { status, ok: false }),
  }
}

// Global fetch mock setup
export const setupFetchMock = () => {
  const mockFetchUtils = createMockFetch()
  global.fetch = mockFetchUtils.fetch
  return mockFetchUtils
}
