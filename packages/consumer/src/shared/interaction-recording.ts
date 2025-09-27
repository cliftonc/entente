import { generateInteractionHash } from '@entente/fixtures'
import type { ClientInteraction, ClientConfig } from '@entente/types'
import { debugLog } from '@entente/types'
import { getGitSha } from '../git-utils.js'
import type { OperationMatchResult } from './operation-matching.js'

export interface InteractionData {
  service: string
  consumer: string
  consumerVersion: string
  providerVersion: string
  environment: string
  operation: string
  request: {
    method: string
    path: string
    headers: Record<string, string>
    query?: Record<string, unknown>
    body?: unknown
  }
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
  }
  matchContext?: {
    selectedOperationId: string
    candidates?: Array<{
      operationId: string
      confidence: number
      reasons: string[]
    }>
    fixtureId?: string
    fixtureReasons?: string[]
  }
  duration: number
}

export interface InteractionRecordingService {
  record(interaction: Omit<InteractionData, 'consumer' | 'consumerVersion' | 'environment'>): Promise<void>
  getRecordedCount(): number
  flush(): Promise<void>
  clear(): void
}

export interface InteractionRecordingOptions {
  consumer: string
  consumerVersion: string
  environment: string
  serviceUrl: string
  apiKey: string
  enabled?: boolean
  skipOperations?: boolean
}

export const createInteractionRecordingService = (
  options: InteractionRecordingOptions
): InteractionRecordingService => {
  const pendingInteractions: ClientInteraction[] = []
  const seenInteractionHashes = new Set<string>()
  let cachedGitSha: string | null = null

  const shouldRecord = (): boolean => {
    return (
      options.enabled !== false && // Default to true unless explicitly disabled
      !options.skipOperations && // Don't record if using fallback values
      (process.env.CI === 'true') // Record in CI environments
    )
  }

  const generateId = (): string => {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const record = async (
    interaction: Omit<InteractionData, 'consumer' | 'consumerVersion' | 'environment'>
  ): Promise<void> => {
    if (!shouldRecord()) {
      debugLog(`🚫 [InteractionRecording] Recording disabled or skipped`)
      return
    }

    try {
      // Generate hash for client-side deduplication
      const hash = await generateInteractionHash(
        interaction.service,
        options.consumer,
        options.consumerVersion,
        interaction.operation,
        interaction.request,
        interaction.response
      )

      // Skip if we've already seen this interaction hash in this session
      if (seenInteractionHashes.has(hash)) {
        debugLog(`⏭️ [InteractionRecording] Skipping duplicate interaction: ${hash}`)
        return
      }

      seenInteractionHashes.add(hash)

      // Get git SHA once and cache it
      if (cachedGitSha === null) {
        cachedGitSha = getGitSha()
      }

      const fullInteraction: ClientInteraction = {
        ...interaction,
        id: generateId(),
        timestamp: new Date(),
        consumer: options.consumer,
        consumerVersion: options.consumerVersion,
        consumerGitSha: cachedGitSha || undefined,
        environment: options.environment,
        clientInfo: {
          library: '@entente/consumer',
          version: '0.1.0',
          buildId: process.env.BUILD_ID,
          commit: cachedGitSha || undefined,
        },
      }

      pendingInteractions.push(fullInteraction)
      debugLog(`📝 [InteractionRecording] Recorded interaction for operation: ${interaction.operation}`)

      // Auto-flush in CI to avoid losing data
      if (process.env.CI && pendingInteractions.length >= 10) {
        await flush()
      }
    } catch (error) {
      console.error(`❌ [InteractionRecording] Error recording interaction for ${interaction.operation}:`, error)
    }
  }

  const getRecordedCount = (): number => {
    return pendingInteractions.length
  }

  const flush = async (): Promise<void> => {
    if (pendingInteractions.length === 0) {
      debugLog(`📋 [InteractionRecording] No interactions to flush`)
      return
    }

    debugLog(`🔄 [InteractionRecording] Flushing ${pendingInteractions.length} recorded interactions`)

    try {
      const url = `${options.serviceUrl}/api/interactions/batch`
      debugLog(`🌐 [InteractionRecording] Uploading interactions to: ${url}`)

      // Send all interactions in one batch request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingInteractions),
      })

      if (response.ok) {
        const result = await response.json()
        debugLog(
          `✅ [InteractionRecording] Batch uploaded ${pendingInteractions.length} interactions: ${result.results.recorded} recorded, ${result.results.duplicates} duplicates`
        )
      } else {
        console.error(
          `❌ [InteractionRecording] Failed to upload interactions batch: ${response.status} ${response.statusText}`
        )
      }
    } catch (error) {
      console.error(`❌ [InteractionRecording] Error uploading interactions batch: ${error}`)
    }

    // Clear arrays after flush attempt
    pendingInteractions.length = 0
    seenInteractionHashes.clear()
  }

  const clear = (): void => {
    pendingInteractions.length = 0
    seenInteractionHashes.clear()
    debugLog(`🧹 [InteractionRecording] Cleared recorded interactions`)
  }

  return {
    record,
    getRecordedCount,
    flush,
    clear,
  }
}