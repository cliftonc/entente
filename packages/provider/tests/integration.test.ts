import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedFixtures, ProviderConfig } from '@entente/types'
import { createProvider } from '../src/index.js'
import { mockFetch, createMockResponse } from './setup.js'

describe('Provider Integration Tests', () => {
  const mockConfig: ProviderConfig = {
    serviceUrl: 'https://entente.test.com',
    apiKey: 'test-api-key',
    provider: 'order-service',
    providerVersion: '2.1.0',
  }

  // Mock database for testing
  const mockDatabase = {
    data: new Map<string, any[]>(),

    clear(table: string) {
      this.data.set(table, [])
    },

    batchInsert(table: string, records: any[]) {
      const existing = this.data.get(table) || []
      this.data.set(table, [...existing, ...records])
    },

    find(table: string, id: string) {
      const records = this.data.get(table) || []
      return records.find(r => r.id === id)
    },

    reset() {
      this.data.clear()
    }
  }

  const realWorldNormalizedFixtures: NormalizedFixtures = {
    entities: {
      User: [
        {
          id: 'user-123',
          type: 'User',
          data: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
            status: 'active'
          },
          operation: 'create',
          source: 'getUser',
        },
        {
          id: 'user-456',
          type: 'User',
          data: {
            id: 'user-456',
            name: 'Jane Smith',
            email: 'jane@example.com',
            status: 'active'
          },
          operation: 'create',
          source: 'listUsers',
        },
      ],
      Product: [
        {
          id: 'product-789',
          type: 'Product',
          data: {
            id: 'product-789',
            name: 'Premium Widget',
            price: 99.99,
            category: 'widgets',
            inStock: true
          },
          operation: 'create',
          source: 'getProduct',
        },
      ],
      Order: [
        {
          id: 'order-abc',
          type: 'Order',
          data: {
            id: 'order-abc',
            userId: 'user-123',
            productId: 'product-789',
            quantity: 2,
            total: 199.98,
            status: 'pending'
          },
          operation: 'create',
          source: 'createOrder',
        },
      ],
    },
    relationships: [
      {
        fromEntity: 'Order',
        fromId: 'order-abc',
        toEntity: 'User',
        toId: 'user-123',
        relationship: 'belongsTo',
      },
    ],
    metadata: {
      service: 'order-service',
      version: '2.1.0',
      totalFixtures: 12,
      extractedAt: new Date('2024-01-15T10:00:00Z'),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabase.reset()
  })

  describe('End-to-End Provider Verification', () => {
    it('should perform complete workflow: download fixtures → setup database → verify interactions', async () => {
      const setupDatabase = async (fixtures: NormalizedFixtures) => {
        const insertOrder = ['User', 'Product', 'Order']

        for (const entityType of insertOrder) {
          const entities = fixtures.entities[entityType] || []
          if (entities.length > 0) {
            const tableName = entityType.toLowerCase() + 's'
            mockDatabase.clear(tableName)
            const records = entities.map(e => e.data)
            mockDatabase.batchInsert(tableName, records)
          }
        }
      }

      const provider = await createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback: setupDatabase,
      })

      // Setup mocks for complete workflow
      mockFetch.mockResolvedValueOnce(createMockResponse(realWorldNormalizedFixtures))
      mockFetch.mockResolvedValueOnce(createMockResponse([
        {
          id: 'task-1',
          tenantId: 'tenant-1',
          providerId: 'provider-1',
          consumerId: 'consumer-1',
          provider: 'order-service',
          providerVersion: '2.1.0',
          consumer: 'web-app',
          consumerVersion: '1.2.0',
          interactions: [
            {
              id: 'interaction-get-user',
              service: 'order-service',
              consumer: 'web-app',
              consumerVersion: '1.2.0',
              providerVersion: '2.1.0',
              environment: 'test',
              operation: 'getUser',
              request: {
                method: 'GET',
                path: '/users/user-123',
                headers: { 'Accept': 'application/json' },
              },
              response: {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  id: 'user-123',
                  name: 'John Doe',
                  email: 'john@example.com',
                  status: 'active'
                },
              },
              timestamp: new Date('2024-01-15T10:00:00Z'),
              duration: 45,
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
      ]))
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active'
      }))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      const result = await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })

      // Verify the complete workflow
      expect(result.results).toHaveLength(1)
      expect(result.results[0].success).toBe(true)

      // Verify database was populated correctly
      expect(mockDatabase.data.get('users')).toHaveLength(2)
      expect(mockDatabase.data.get('products')).toHaveLength(1)
      expect(mockDatabase.data.get('orders')).toHaveLength(1)

      // Verify specific entities were inserted
      const user123 = mockDatabase.find('users', 'user-123')
      expect(user123).toEqual({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active'
      })
    })

    it('should work with both normalized fixtures and state handlers', async () => {
      const setupDatabase = vi.fn()
      const customStateHandler = vi.fn()

      const provider = await createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback: setupDatabase,
      })

      mockFetch.mockResolvedValueOnce(createMockResponse(realWorldNormalizedFixtures))
      mockFetch.mockResolvedValueOnce(createMockResponse([
        {
          id: 'task-1',
          tenantId: 'tenant-1',
          providerId: 'provider-1',
          consumerId: 'consumer-1',
          provider: 'order-service',
          providerVersion: '2.1.0',
          consumer: 'web-app',
          consumerVersion: '1.2.0',
          interactions: [
            {
              id: 'interaction-create-order',
              service: 'order-service',
              consumer: 'web-app',
              consumerVersion: '1.2.0',
              providerVersion: '2.1.0',
              environment: 'test',
              operation: 'createOrder',
              request: {
                method: 'POST',
                path: '/orders',
                headers: { 'Content-Type': 'application/json' },
                body: { userId: 'user-123', productId: 'product-789', quantity: 2 },
              },
              response: {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { id: 'order-new', status: 'pending' },
              },
              timestamp: new Date('2024-01-15T10:05:00Z'),
              duration: 120,
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
      ]))
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'order-new', status: 'pending' }, 200))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      const result = await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
        stateHandlers: {
          createOrder: customStateHandler,
        },
      })

      // Both normalized fixtures and custom state handler should be used
      expect(setupDatabase).toHaveBeenCalledWith(realWorldNormalizedFixtures)
      expect(customStateHandler).toHaveBeenCalledOnce()
      expect(result.results).toHaveLength(1)
      expect(result.results[0].success).toBe(true)
    })
  })

  describe('Performance Testing', () => {
    it('should handle large normalized fixtures efficiently', async () => {
      const largeFixtures: NormalizedFixtures = {
        entities: {
          User: Array.from({ length: 1000 }, (_, i) => ({
            id: `user-${i}`,
            type: 'User',
            data: { id: `user-${i}`, name: `User ${i}`, email: `user${i}@example.com` },
            operation: 'create' as const,
            source: 'listUsers',
          })),
        },
        relationships: [],
        metadata: {
          service: 'order-service',
          version: '2.1.0',
          totalFixtures: 1000,
          extractedAt: new Date(),
        },
      }

      const setupDatabase = vi.fn()

      const provider = await createProvider({
        ...mockConfig,
        useNormalizedFixtures: true,
        dataSetupCallback: setupDatabase,
      })

      mockFetch.mockResolvedValueOnce(createMockResponse(largeFixtures))
      mockFetch.mockResolvedValueOnce(createMockResponse([]))

      const startTime = Date.now()
      await provider.verify({
        baseUrl: 'http://localhost:3000',
        environment: 'test',
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(1000) // Should complete quickly
      expect(setupDatabase).toHaveBeenCalledWith(largeFixtures)
    })
  })
})