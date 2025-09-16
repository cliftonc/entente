import { vi } from 'vitest'
import type { NormalizedFixtures, VerificationTask } from '@entente/types'

// Mock fetch globally
export const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock git utils
vi.mock('../src/git-utils.js', () => ({
  getGitSha: () => 'test-sha-123',
}))

// Mock fs for controlling package.json reading
export const mockPackageJson = vi.fn()
vi.mock('node:fs', () => ({
  readFileSync: mockPackageJson,
}))

// Default mock for normal package.json
mockPackageJson.mockReturnValue(JSON.stringify({
  name: 'test-service',
  version: '1.0.0'
}))

export const createMockResponse = (data: any, status = 200, ok = true) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  headers: new Headers({ 'Content-Type': 'application/json' }),
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
})

export const mockNormalizedFixtures: NormalizedFixtures = {
  entities: {
    User: [
      {
        id: '123',
        type: 'User',
        data: { id: '123', name: 'John Doe', email: 'john@example.com' },
        operation: 'create',
        source: 'getUser',
      },
    ],
    Order: [
      {
        id: '456',
        type: 'Order',
        data: { id: '456', userId: '123', total: 100, status: 'pending' },
        operation: 'create',
        source: 'getOrder',
      },
    ],
  },
  relationships: [
    {
      fromEntity: 'Order',
      fromId: '456',
      toEntity: 'User',
      toId: '123',
      relationship: 'belongsTo',
    },
  ],
  metadata: {
    service: 'test-service',
    version: '1.0.0',
    totalFixtures: 2,
    extractedAt: new Date('2024-01-15T10:00:00Z'),
  },
}

export const mockVerificationTasks: VerificationTask[] = [
  {
    id: 'task-1',
    tenantId: 'tenant-1',
    providerId: 'provider-1',
    consumerId: 'consumer-1',
    provider: 'test-service',
    providerVersion: '1.0.0',
    consumer: 'test-consumer',
    consumerVersion: '1.0.0',
    interactions: [
      {
        id: 'interaction-1',
        service: 'test-service',
        consumer: 'test-consumer',
        consumerVersion: '1.0.0',
        providerVersion: '1.0.0',
        environment: 'test',
        operation: 'getUser',
        request: {
          method: 'GET',
          path: '/users/123',
          headers: { 'Content-Type': 'application/json' },
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { id: '123', name: 'John Doe', email: 'john@example.com' },
        },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        duration: 100,
        clientInfo: {
          library: '@entente/consumer',
          version: '1.0.0',
          environment: 'test',
        },
      },
    ],
    environment: 'test',
    createdAt: new Date('2024-01-15T10:00:00Z'),
  },
]

export const setupSuccessfulMocks = () => {
  mockFetch.mockResolvedValueOnce(createMockResponse(mockNormalizedFixtures)) // normalized fixtures
  mockFetch.mockResolvedValueOnce(createMockResponse(mockVerificationTasks)) // verification tasks
  mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123', name: 'John Doe', email: 'john@example.com' })) // API call
  mockFetch.mockResolvedValueOnce(createMockResponse({})) // results submission
}

export const setupFailedFixturesMock = () => {
  mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Not Found' }, 404, false)) // failed fixtures
  mockFetch.mockResolvedValueOnce(createMockResponse(mockVerificationTasks)) // verification tasks
  mockFetch.mockResolvedValueOnce(createMockResponse({ id: '123', name: 'John Doe', email: 'john@example.com' })) // API call
  mockFetch.mockResolvedValueOnce(createMockResponse({})) // results submission
}