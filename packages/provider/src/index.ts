import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { diffJson, diffLines } from 'diff'
import { getProjectMetadata } from '@entente/metadata'
import type {
  ClientInteraction,
  Fixture,
  HTTPRequest,
  HTTPResponse,
  NormalizedFixtures,
  ProviderConfig,
  VerificationErrorDetails,
  VerificationResult,
  VerificationResults,
  VerificationTask,
  VerifyOptions,
} from '@entente/types'
import { debugLog } from '@entente/types'
import { getGitSha } from './git-utils.js'

export interface ProviderVerificationResults {
  taskId: string | null
  providerVersion: string
  providerGitSha?: string | null
  results: VerificationResult[]
}

export interface EntenteProvider {
  verify: (options: VerifyOptions) => Promise<ProviderVerificationResults>
  getVerificationTasks: (environment?: string) => Promise<VerificationTask[]>
}

const getPackageInfo = async (): Promise<{ name: string; version: string }> => {
  try {
    const metadata = await getProjectMetadata()
    return {
      name: metadata.name,
      version: metadata.version,
    }
  } catch (_error) {
    // Fallback if no project metadata can be read
    return {
      name: 'unknown-service',
      version: '0.0.0',
    }
  }
}

export const createProvider = async (config: ProviderConfig): Promise<EntenteProvider> => {
  // Get package info for fallbacks
  const packageInfo = await getPackageInfo()

  // Create resolved config with fallbacks
  const resolvedConfig = {
    ...config,
    provider: config.provider || packageInfo.name,
    providerVersion: config.providerVersion || packageInfo.version,
  }

  // Check if we're using fallback values and warn user
  const usingFallbackName = !config.provider && packageInfo.name === 'unknown-service'
  const usingFallbackVersion = !config.providerVersion && packageInfo.version === '0.0.0'

  if (usingFallbackName || usingFallbackVersion) {
    console.warn(
      '⚠️  Entente provider using fallback values - verification will be skipped. Please provide provider name/version or ensure project files exist.'
    )
    console.warn(`   Provider: ${resolvedConfig.provider}${usingFallbackName ? ' (fallback)' : ''}`)
    console.warn(
      `   Version: ${resolvedConfig.providerVersion}${usingFallbackVersion ? ' (fallback)' : ''}`
    )
  }

  return {
    verify: async (options: VerifyOptions): Promise<ProviderVerificationResults> => {
      // Skip verification if using fallback values
      if (usingFallbackName || usingFallbackVersion) {
        debugLog('🚫 Skipping provider verification - provider info unavailable')

        return {
          taskId: null,
          providerVersion: resolvedConfig.providerVersion,
          providerGitSha: getGitSha(),
          results: [],
        }
      }

      // Download and setup normalized fixtures if enabled
      if (resolvedConfig.useNormalizedFixtures && resolvedConfig.dataSetupCallback) {
        debugLog('📦 Downloading normalized fixtures for provider setup...')
        try {
          const normalizedFixtures = await downloadNormalizedFixtures(
            resolvedConfig.serviceUrl,
            resolvedConfig.apiKey,
            resolvedConfig.provider,
            resolvedConfig.providerVersion
          )

          debugLog(
            `🔧 Setting up ${Object.keys(normalizedFixtures.entities).length} entity types from ${normalizedFixtures.metadata.totalFixtures} fixtures...`
          )
          await resolvedConfig.dataSetupCallback(normalizedFixtures)
          debugLog('✅ Normalized fixture data setup completed')
        } catch (error) {
          console.error('❌ Failed to setup normalized fixtures:', error)
          // Continue with verification even if fixture setup fails
        }
      }

      // Get verification tasks from central service
      const tasks = await getVerificationTasks(
        resolvedConfig.serviceUrl,
        resolvedConfig.apiKey,
        resolvedConfig.provider,
        options.environment
      )

      const allResults: VerificationResult[] = []
      const submittedTasks: string[] = []

      // Process each task separately to handle different consumers/versions
      for (const task of tasks) {
        const taskResults: VerificationResult[] = []

        for (const interaction of task.interactions) {
          try {
            // Use state handlers to set up provider state
            if (options.stateHandlers) {
              const stateHandler = options.stateHandlers[interaction.operation]
              if (stateHandler) {
                await stateHandler()
              }
            }

            // Replay the recorded request against real provider
            const actualResponse = await replayRequest(options.baseUrl, interaction.request)


            // Validate response matches recorded response
            const validation = validateResponse(interaction.response, actualResponse, options.logger)

            const result: VerificationResult = {
              interactionId: interaction.id,
              success: validation.success,
              error: validation.success ? undefined : validation.error,
              errorDetails: validation.success ? undefined : validation.errorDetails,
              actualResponse,
            }

            taskResults.push(result)
            allResults.push(result)
          } catch (error) {
            const result: VerificationResult = {
              interactionId: interaction.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              actualResponse: undefined,
            }

            taskResults.push(result)
            allResults.push(result)
          }

          // Cleanup after each interaction
          if (options.cleanup) {
            await options.cleanup()
          }
        }

        // Submit results for this specific task
        if (taskResults.length > 0) {
          // Get git SHA for provider verification
          const providerGitSha = getGitSha()

          await submitResults(
            resolvedConfig.serviceUrl,
            resolvedConfig.apiKey,
            resolvedConfig.provider,
            {
              taskId: task.id,
              providerVersion: resolvedConfig.providerVersion,
              providerGitSha,
              consumer: task.consumer,
              consumerVersion: task.consumerVersion,
              consumerGitSha: task.consumerGitSha,
              specType: task.specType, // Include specType from the task
              results: taskResults,
            }
          )

          submittedTasks.push(task.id)

          // Update dependency status based on verification results for this task
          const allPassed = taskResults.every(r => r.success)
          const _dependencyStatus = allPassed ? 'verified' : 'failed'

          // Note: In a real implementation, we'd need the dependency ID
          // For now, this serves as a placeholder for the status update logic
          // The server-side verification results handler could update dependency status
        }
      }

      // Get git SHA for return value too
      const providerGitSha = getGitSha()

      return {
        taskId: submittedTasks[0] || null,
        providerVersion: resolvedConfig.providerVersion,
        providerGitSha,
        results: allResults,
      }
    },

    getVerificationTasks: (environment?: string): Promise<VerificationTask[]> => {
      // Skip getting tasks if using fallback values
      if (usingFallbackName || usingFallbackVersion) {
        debugLog('🚫 Skipping verification task retrieval - provider info unavailable')
        return Promise.resolve([])
      }

      return getVerificationTasks(
        resolvedConfig.serviceUrl,
        resolvedConfig.apiKey,
        resolvedConfig.provider,
        environment
      )
    },
  }
}

export const replayRequest = async (
  baseUrl: string,
  request: HTTPRequest
): Promise<HTTPResponse> => {
  const url = new URL(request.path, baseUrl)

  if (request.query) {
    for (const [key, value] of Object.entries(request.query)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body ? JSON.stringify(request.body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  const isJsonResponse = contentType.includes('application/json') || contentType.includes('application/graphql-response+json')

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: isJsonResponse
      ? await response.json()
      : await response.text(),
  }
}

const createResponseDiff = (expected: unknown, actual: unknown): string => {
  const expectedJson = JSON.stringify(expected, null, 2)
  const actualJson = JSON.stringify(actual, null, 2)

  try {
    const diff = diffJson(expected as any, actual as any)
    const lines: string[] = []

    lines.push('\n📊 Response Comparison:')
    lines.push('─'.repeat(80))

    // Create side-by-side diff
    diff.forEach((part: any) => {
      if (part.removed) {
        const removedLines = part.value.split('\n').filter((line: string) => line.trim())
        removedLines.forEach((line: string) => {
          lines.push(`❌ Expected: ${line}`)
        })
      } else if (part.added) {
        const addedLines = part.value.split('\n').filter((line: string) => line.trim())
        addedLines.forEach((line: string) => {
          lines.push(`✅ Actual:   ${line}`)
        })
      }
    })

    lines.push('─'.repeat(80))

    // Also show full JSON diff for complex cases
    const jsonDiff = diffLines(expectedJson, actualJson)
    let hasChanges = false

    jsonDiff.forEach((part: any) => {
      if (part.added || part.removed) {
        hasChanges = true
      }
    })

    if (hasChanges) {
      lines.push('\n📄 Full JSON Diff:')
      jsonDiff.forEach((part: any) => {
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  '
        const color = part.added ? '✅' : part.removed ? '❌' : '  '
        part.value.split('\n').forEach((line: string) => {
          if (line.trim()) {
            lines.push(`${color} ${prefix}${line}`)
          }
        })
      })
    }

    return lines.join('\n')
  } catch (error) {
    // Fallback to simple text diff if JSON diff fails
    return `\n📊 Simple Text Comparison:\n❌ Expected:\n${expectedJson}\n✅ Actual:\n${actualJson}`
  }
}

export const validateResponse = (
  expected: HTTPResponse,
  actual: HTTPResponse,
  logger?: (level: 'info' | 'warn' | 'error', message: string) => void
): { success: boolean; error?: string; errorDetails?: VerificationErrorDetails } => {
  // Add debug logging for response validation
  debugLog('🔍 Validating response structure:')
  debugLog(`  Expected status: ${expected.status}`)
  debugLog(`  Actual status: ${actual.status}`)
  debugLog(`  Expected body: ${JSON.stringify(expected.body, null, 2)}`)
  debugLog(`  Actual body: ${JSON.stringify(actual.body, null, 2)}`)

  // Validate status code
  if (expected.status !== actual.status) {
    const error = `Status code mismatch: expected ${expected.status}, got ${actual.status}`

    // Show response bodies for context when status doesn't match
    const diff = createResponseDiff(expected.body, actual.body)
    const fullMessage = `🔍 Status Code Mismatch:\n${error}${diff}`

    if (logger) {
      logger('error', fullMessage)
    } else {
      console.error(fullMessage)
    }

    return {
      success: false,
      error,
      errorDetails: {
        type: 'status_mismatch',
        message: error,
        expected: expected.status,
        actual: actual.status,
      },
    }
  }

  // Validate response body structure
  if (expected.body && actual.body) {
    const structureResult = validateJsonStructure(expected.body, actual.body, 'body')
    if (!structureResult.success) {
      debugLog(`❌ Structure validation failed: ${structureResult.error}`)

      // Generate detailed diff for better debugging
      const diff = createResponseDiff(expected.body, actual.body)
      const fullMessage = `🔍 Response Structure Mismatch:\n${structureResult.error}${diff}`

      if (logger) {
        logger('error', fullMessage)
      } else {
        console.error(fullMessage)
      }

      return {
        success: false,
        error: `Response structure mismatch: ${structureResult.error}`,
        errorDetails: structureResult.errorDetails,
      }
    }

    // For successful GET requests, also check if the data is reasonable
    if (actual.status >= 200 && actual.status < 300) {
      const contentCheck = validateResponseContent(expected.body, actual.body)
      if (!contentCheck.success) {
        return {
          success: false,
          error: contentCheck.error,
          errorDetails: {
            type: 'content_mismatch',
            message: contentCheck.error || 'Content validation failed',
            expected: expected.body,
            actual: actual.body,
          },
        }
      }
    }
  }

  return { success: true }
}

export const validateJsonStructure = (
  expected: unknown,
  actual: unknown,
  fieldPath?: string
): { success: boolean; error?: string; errorDetails?: VerificationErrorDetails } => {
  // Implement deep structure validation
  // Check that actual has all required fields from expected
  // Allow extra fields in actual
  // Validate types match

  if (typeof expected !== typeof actual) {
    const error = `Type mismatch: expected ${typeof expected}, got ${typeof actual}`
    return {
      success: false,
      error,
      errorDetails: {
        type: 'structure_mismatch',
        message: error,
        expected: typeof expected,
        actual: typeof actual,
        field: fieldPath,
      },
    }
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      const error = 'Expected array but got non-array'
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'array',
          actual: typeof actual,
          field: fieldPath,
        },
      }
    }

    if (expected.length === 0) {
      return { success: true }
    }

    if (actual.length === 0) {
      const error = 'Expected non-empty array but got empty array'
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'non-empty array',
          actual: 'empty array',
          field: fieldPath,
        },
      }
    }

    return validateJsonStructure(expected[0], actual[0], fieldPath ? `${fieldPath}[0]` : '[0]')
  }

  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) {
      const error = 'Expected object but got non-object'
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'object',
          actual: actual === null ? 'null' : typeof actual,
          field: fieldPath,
        },
      }
    }

    const expectedObj = expected as Record<string, unknown>
    const actualObj = actual as Record<string, unknown>

    for (const key in expectedObj) {
      if (!(key in actualObj)) {
        const currentFieldPath = fieldPath ? `${fieldPath}.${key}` : key
        const error = `Missing required field: ${key}`
        return {
          success: false,
          error: `Missing required field: ${key}. Expected: ${JSON.stringify(expectedObj, null, 2)}, Actual: ${JSON.stringify(actualObj, null, 2)}`,
          errorDetails: {
            type: 'structure_mismatch',
            message: error,
            expected: expectedObj,
            actual: actualObj,
            field: currentFieldPath,
          },
        }
      }
      const currentFieldPath = fieldPath ? `${fieldPath}.${key}` : key
      const fieldResult = validateJsonStructure(expectedObj[key], actualObj[key], currentFieldPath)
      if (!fieldResult.success) {
        const error = `Field validation failed for '${key}': ${fieldResult.error}`
        return {
          success: false,
          error,
          errorDetails: fieldResult.errorDetails,
        }
      }
    }
  }

  return { success: true }
}

const getVerificationTasks = async (
  serviceUrl: string,
  apiKey: string,
  provider: string,
  environment?: string
): Promise<VerificationTask[]> => {
  const url = `${serviceUrl}/api/verification/${provider}${environment ? `?environment=${environment}` : ''}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get verification tasks: ${response.statusText}`)
  }

  return response.json()
}

const submitResults = async (
  serviceUrl: string,
  apiKey: string,
  provider: string,
  results: VerificationResults
): Promise<void> => {
  const response = await fetch(`${serviceUrl}/api/verification/${provider}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(results),
  })

  if (!response.ok) {
    throw new Error(`Failed to submit verification results: ${response.statusText}`)
  }
}

const validateResponseContent = (
  expected: unknown,
  actual: unknown
): { success: boolean; error?: string } => {
  // For arrays, check that they're both arrays and have reasonable length
  if (Array.isArray(expected) && Array.isArray(actual)) {
    // Allow actual to have different items, but should be same type
    if (expected.length > 0 && actual.length === 0) {
      return {
        success: false,
        error: 'Expected non-empty array but got empty array',
      }
    }
    return { success: true }
  }

  // For objects, check key fields exist
  if (
    typeof expected === 'object' &&
    expected !== null &&
    typeof actual === 'object' &&
    actual !== null
  ) {
    const expectedObj = expected as Record<string, unknown>
    const actualObj = actual as Record<string, unknown>

    // Check that critical ID fields match if they exist
    if (expectedObj.id && actualObj.id) {
      // Allow different IDs for created resources, but both should exist
      if (typeof expectedObj.id !== typeof actualObj.id) {
        return {
          success: false,
          error: `ID field type mismatch: expected ${typeof expectedObj.id}, got ${typeof actualObj.id}`,
        }
      }
    }

    return { success: true }
  }

  return { success: true }
}

const downloadNormalizedFixtures = async (
  serviceUrl: string,
  apiKey: string,
  provider: string,
  providerVersion: string
): Promise<NormalizedFixtures> => {
  const url = `${serviceUrl}/api/fixtures/normalized/${provider}/${providerVersion}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to download normalized fixtures: ${response.statusText}`)
  }

  return response.json()
}
