import { generateFixtureHash } from '@entente/fixtures'
import type { FixtureProposal, SpecType } from '@entente/types'
import { debugLog } from '@entente/types'

export interface FixtureCollectionData {
  operation: string
  data: {
    request?: unknown
    response: unknown
  }
}

export interface FixtureCollectionService {
  collect(operation: string, data: { request?: unknown; response: unknown }): Promise<void>
  getCollectedCount(): number
  flush(): Promise<void>
  clear(): void
}

export interface FixtureCollectionOptions {
  service: string
  providerVersion: string
  specType?: SpecType
  serviceUrl: string
  apiKey: string
  enabled?: boolean
}

export const createFixtureCollectionService = (
  options: FixtureCollectionOptions
): FixtureCollectionService => {
  const collectedFixtures = new Map<string, FixtureCollectionData>()
  const specType = options.specType || 'openapi'

  const shouldCollect = (): boolean => {
    return (
      options.enabled !== false && // Can be explicitly disabled
      process.env.CI === 'true' // Only collect in CI
    )
  }

  const collect = async (operation: string, data: { request?: unknown; response: unknown }): Promise<void> => {
    if (!shouldCollect()) {
      debugLog(`🚫 [FixtureCollection] Collection disabled or not in CI environment`)
      return
    }

    if (operation === 'unknown') {
      debugLog(`🚫 [FixtureCollection] Skipping collection for unknown operation`)
      return
    }

    try {
      // Generate hash to check for duplicates
      const hash = await generateFixtureHash(operation, data)

      if (!collectedFixtures.has(hash)) {
        collectedFixtures.set(hash, { operation, data })
        debugLog(`📥 [FixtureCollection] Collected fixture for operation: ${operation}`)
      } else {
        debugLog(`⏭️ [FixtureCollection] Skipping duplicate fixture: ${hash}`)
      }
    } catch (error) {
      console.error(`❌ [FixtureCollection] Error collecting fixture for ${operation}:`, error)
    }
  }

  const getCollectedCount = (): number => {
    return collectedFixtures.size
  }

  const flush = async (): Promise<void> => {
    if (collectedFixtures.size === 0) {
      debugLog(`📋 [FixtureCollection] No fixtures collected for ${options.service}@${options.providerVersion} - skipping upload`)
      return
    }

    debugLog(`📤 [FixtureCollection] Preparing to upload ${collectedFixtures.size} fixtures for ${options.service}@${options.providerVersion}`)

    try {
      // Convert collected fixtures to fixture proposals
      const fixtureProposals: FixtureProposal[] = Array.from(collectedFixtures.values()).map(
        ({ operation, data }) => ({
          service: options.service,
          serviceVersion: options.providerVersion,
          specType,
          operation,
          source: 'consumer' as const,
          data,
          createdFrom: {
            type: 'test_output',
            timestamp: new Date(),
            generatedBy: 'consumer-test',
            testRun: process.env.BUILD_ID || 'local',
          },
          notes: 'Auto-generated fixture from consumer test',
        })
      )

      // Batch upload all fixtures
      const url = `${options.serviceUrl}/api/fixtures/batch`
      debugLog(`🌐 [FixtureCollection] POSTing to ${url} with ${fixtureProposals.length} fixtures`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fixtures: fixtureProposals }),
      })

      if (response.ok) {
        const result = await response.json()
        debugLog(
          `✅ [FixtureCollection] Batch uploaded ${fixtureProposals.length} fixtures: ${result.created} created, ${result.duplicates} duplicates`
        )
      } else {
        const errorText = await response.text().catch(() => 'No error details')
        console.error(
          `❌ [FixtureCollection] Failed to batch upload fixtures: ${response.status} ${response.statusText}`
        )
        debugLog(`❌ [FixtureCollection] Upload error details: ${errorText}`)
      }
    } catch (error) {
      console.error(`❌ [FixtureCollection] Error batch uploading fixtures: ${error}`)
    }

    // Clear collected fixtures after upload attempt
    collectedFixtures.clear()
  }

  const clear = (): void => {
    collectedFixtures.clear()
    debugLog(`🧹 [FixtureCollection] Cleared collected fixtures`)
  }

  return {
    collect,
    getCollectedCount,
    flush,
    clear,
  }
}