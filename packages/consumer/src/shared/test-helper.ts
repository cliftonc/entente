import type { ClientInteraction, Fixture, SupportedSpec } from '@entente/types'
import { debugLog } from '@entente/types'
import type { OperationMatchingService } from './operation-matching.js'
import type { FixtureCollectionService } from './fixture-collection.js'
import type { InteractionRecordingService } from './interaction-recording.js'
import { createErrorReporter } from './error-handling.js'

export type TestMode = 'mock' | 'interceptor'

export interface TestHelperStats {
  mode: TestMode
  requestsHandled: number
  fixturesCollected: number
  interactionsRecorded: number
  errors: number
  warnings: number
}

export interface TestHelperConfig {
  service: string
  providerVersion: string
  mode: TestMode
  spec: SupportedSpec
  fixtures: Fixture[]
  url?: string // Only for mock mode
  port?: number // Only for mock mode
}

export interface UnifiedTestHelper {
  // Common interface for both modes
  readonly mode: TestMode
  readonly service: string
  readonly providerVersion: string
  readonly url?: string
  readonly port?: number

  // Statistics and introspection
  getStats(): TestHelperStats
  getFixtures(): Fixture[]
  getRecordedInteractions(): ClientInteraction[]

  // Fixture management
  proposeFixture(operation: string, data: { request?: unknown; response: unknown }): Promise<void>

  // Cleanup (supports both patterns)
  close(): Promise<void>
  [Symbol.dispose](): Promise<void>

  // Mode-specific capabilities check
  canMockRequests(): boolean
  canInterceptRequests(): boolean
}

export interface TestHelperDependencies {
  operationMatching: OperationMatchingService
  fixtureCollection: FixtureCollectionService
  interactionRecording: InteractionRecordingService
}

export const createUnifiedTestHelper = (
  config: TestHelperConfig,
  dependencies: TestHelperDependencies
): UnifiedTestHelper => {
  const { operationMatching, fixtureCollection, interactionRecording } = dependencies
  const errorReporter = createErrorReporter(config.service, config.mode)

  let stats: TestHelperStats = {
    mode: config.mode,
    requestsHandled: 0,
    fixturesCollected: 0,
    interactionsRecorded: 0,
    errors: 0,
    warnings: 0,
  }

  let isDisposed = false

  const ensureNotDisposed = () => {
    if (isDisposed) {
      throw errorReporter.error('TestHelper has been disposed', { phase: 'cleanup' })
    }
  }

  const getStats = (): TestHelperStats => {
    ensureNotDisposed()
    return {
      ...stats,
      fixturesCollected: fixtureCollection.getCollectedCount(),
      interactionsRecorded: interactionRecording.getRecordedCount(),
    }
  }

  const getFixtures = (): Fixture[] => {
    ensureNotDisposed()
    return [...config.fixtures]
  }

  const getRecordedInteractions = (): ClientInteraction[] => {
    ensureNotDisposed()
    // This would need to be implemented by the specific mode
    return []
  }

  const proposeFixture = async (
    operation: string,
    data: { request?: unknown; response: unknown }
  ): Promise<void> => {
    ensureNotDisposed()

    try {
      await fixtureCollection.collect(operation, data)
      debugLog(`✅ [TestHelper] Proposed fixture for operation: ${operation}`)
    } catch (error) {
      stats.errors++
      throw errorReporter.error(
        `Failed to propose fixture for operation: ${operation}`,
        { operation, phase: 'request' },
        error
      )
    }
  }

  const close = async (): Promise<void> => {
    if (isDisposed) {
      debugLog(`⚠️ [TestHelper] Already disposed`)
      return
    }

    debugLog(`🔄 [TestHelper] Starting cleanup for ${config.mode} mode`)

    try {
      // Flush all pending operations
      await Promise.all([
        fixtureCollection.flush(),
        interactionRecording.flush(),
      ])

      debugLog(`✅ [TestHelper] Cleanup completed for ${config.service}@${config.providerVersion}`)
    } catch (error) {
      stats.errors++
      throw errorReporter.error(
        'Failed to cleanup test helper',
        { phase: 'cleanup' },
        error
      )
    } finally {
      isDisposed = true
    }
  }

  const canMockRequests = (): boolean => {
    return config.mode === 'mock'
  }

  const canInterceptRequests = (): boolean => {
    return config.mode === 'interceptor'
  }

  return {
    mode: config.mode,
    service: config.service,
    providerVersion: config.providerVersion,
    url: config.url,
    port: config.port,

    getStats,
    getFixtures,
    getRecordedInteractions,
    proposeFixture,
    close,
    [Symbol.dispose]: close,

    canMockRequests,
    canInterceptRequests,
  }
}

// Helper function to update stats safely
export const incrementStat = (
  stats: TestHelperStats,
  field: keyof Omit<TestHelperStats, 'mode'>
): void => {
  ;(stats[field] as number)++
}