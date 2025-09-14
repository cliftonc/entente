import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { replayRequest } from '../src/index.js'
import { mockHTTPRequest, mockHTTPRequestPost } from './mocks/interactions.mock.js'

global.fetch = vi.fn()

describe('replayRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should replay GET request with query parameters', async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ id: 'order-123', status: 'pending' }),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequest)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/orders/123?include=items',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer token123',
        },
        body: undefined,
      }
    )

    expect(result.status).toBe(200)
    expect(result.headers).toEqual({ 'content-type': 'application/json' })
    expect(result.body).toEqual({ id: 'order-123', status: 'pending' })
  })

  it('should replay POST request with JSON body', async () => {
    const mockResponse = {
      status: 201,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ id: 'order-456', status: 'created' }),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequestPost)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token456',
        },
        body: JSON.stringify({
          customerId: 'customer-456',
          items: [{ productId: 'prod-789', quantity: 2 }],
        }),
      }
    )

    expect(result.status).toBe(201)
    expect(result.body).toEqual({ id: 'order-456', status: 'created' })
  })

  it('should handle requests without query parameters', async () => {
    const requestWithoutQuery = {
      ...mockHTTPRequest,
      query: undefined,
    }

    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ success: true }),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    await replayRequest('http://localhost:3000', requestWithoutQuery)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/orders/123',
      expect.objectContaining({
        method: 'GET',
      })
    )
  })

  it('should handle requests without body', async () => {
    const requestWithoutBody = {
      ...mockHTTPRequestPost,
      body: undefined,
    }

    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ success: true }),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    await replayRequest('http://localhost:3000', requestWithoutBody)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/orders',
      expect.objectContaining({
        method: 'POST',
        body: undefined,
      })
    )
  })

  it('should handle text responses', async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      text: () => Promise.resolve('Hello, World!'),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequest)

    expect(result.body).toBe('Hello, World!')
  })

  it('should handle responses without content-type header', async () => {
    const mockResponse = {
      status: 200,
      headers: new Map(),
      text: () => Promise.resolve('Plain text response'),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequest)

    expect(result.body).toBe('Plain text response')
  })

  it('should handle JSON responses with partial content-type match', async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'application/json; charset=utf-8']]),
      json: () => Promise.resolve({ data: 'json response' }),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequest)

    expect(result.body).toEqual({ data: 'json response' })
  })

  it('should convert response headers to plain object', async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([
        ['content-type', 'application/json'],
        ['x-custom-header', 'custom-value'],
        ['cache-control', 'no-cache'],
      ]),
      json: () => Promise.resolve({}),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    const result = await replayRequest('http://localhost:3000', mockHTTPRequest)

    expect(result.headers).toEqual({
      'content-type': 'application/json',
      'x-custom-header': 'custom-value',
      'cache-control': 'no-cache',
    })
  })

  it('should handle multiple query parameters', async () => {
    const requestWithMultipleQuery = {
      ...mockHTTPRequest,
      query: {
        include: 'items',
        sort: 'created_at',
        limit: '10',
        filter: 'active',
      },
    }

    const mockResponse = {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({}),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    await replayRequest('http://localhost:3000', requestWithMultipleQuery)

    const expectedUrl = 'http://localhost:3000/api/orders/123?include=items&sort=created_at&limit=10&filter=active'
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
  })

  it('should handle fetch errors', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(replayRequest('http://localhost:3000', mockHTTPRequest))
      .rejects.toThrow('Network error')
  })

  it('should preserve different HTTP methods', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    const mockResponse = {
      status: 200,
      headers: new Map(),
      text: () => Promise.resolve(''),
    }

    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(mockResponse as Response)

    for (const method of methods) {
      const request = { ...mockHTTPRequest, method }
      await replayRequest('http://localhost:3000', request)

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ method })
      )
    }
  })
})