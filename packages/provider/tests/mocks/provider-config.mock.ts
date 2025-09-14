import type { ProviderConfig, VerifyOptions } from '@entente/types'
import { vi } from 'vitest'

export const mockProviderConfig: ProviderConfig = {
  serviceUrl: 'https://entente.example.com',
  apiKey: 'test-api-key-123',
  provider: 'order-service',
  providerVersion: '1.2.3',
}

export const mockProviderConfigWithoutProvider: ProviderConfig = {
  serviceUrl: 'https://entente.example.com',
  apiKey: 'test-api-key-456',
}

export const mockProviderConfigWithoutVersion: ProviderConfig = {
  serviceUrl: 'https://entente.example.com',
  apiKey: 'test-api-key-789',
  provider: 'order-service',
}

export const mockVerifyOptions: VerifyOptions = {
  baseUrl: 'http://localhost:3000',
  environment: 'test',
  stateHandlers: {
    getOrder: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue(undefined),
  },
  cleanup: vi.fn().mockResolvedValue(undefined),
}

export const mockVerifyOptionsMinimal: VerifyOptions = {
  baseUrl: 'http://localhost:8080',
}
