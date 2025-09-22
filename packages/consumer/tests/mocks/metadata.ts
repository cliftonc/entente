import { vi } from 'vitest'

export const createMetadataMock = () => {
  let shouldReturnFallback = false

  const getProjectMetadata = vi.fn().mockImplementation(async () => {
    if (shouldReturnFallback) {
      return {
        name: 'unknown-service',
        version: '0.0.0',
        projectType: 'unknown',
        raw: {}
      }
    }
    return {
      name: 'test-consumer',
      version: '1.2.3',
      projectType: 'node',
      raw: {
        name: 'test-consumer',
        version: '1.2.3'
      }
    }
  })

  const setFallbackMode = (enabled: boolean) => {
    shouldReturnFallback = enabled
  }

  return {
    getProjectMetadata,
    setFallbackMode
  }
}

export const setupMetadataMock = () => {
  const metadataMock = createMetadataMock()

  vi.doMock('@entente/metadata', () => metadataMock)

  return metadataMock
}