import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { createRequestRouter } from '@entente/fixtures'
import { specRegistry } from '@entente/fixtures'
import { convertHTTPToUnified, generateInteractionHash } from '@entente/fixtures'
import type {
  APISpec,
  ClientConfig,
  ClientInteraction,
  Fixture,
  FixtureProposal,
  SupportedSpec,
  UnifiedRequest,
} from '@entente/types'
import { debugLog } from '@entente/types'
import { getGitSha } from '../git-utils.js'
import type { InterceptedCall, InterceptOptions, RequestInterceptor } from './types.js'

interface PendingRequest {
  startTime: number
  unifiedRequest: UnifiedRequest
  matchOutcome: any
  requestType: 'fetch' | 'http'
}

export class EntenteRequestInterceptor implements RequestInterceptor {
  private interceptor: BatchInterceptor<any>
  private spec: APISpec
  private router: any
  private isActive = false

  // Recording state
  private pendingRequests = new Map<string, PendingRequest>()
  private interceptedCalls: InterceptedCall[] = []
  private recordedInteractions: ClientInteraction[] = []
  private seenHashes = new Set<string>()
  private cachedGitSha: string | null = null

  // Statistics
  private stats = { fetch: 0, http: 0, total: 0 }

  // Configuration
  private config: ClientConfig & { consumer: string; consumerVersion: string }
  private service: string
  private providerVersion: string
  private options: InterceptOptions
  private skipOperations: boolean

  constructor(
    spec: SupportedSpec,
    fixtures: Fixture[],
    service: string,
    providerVersion: string,
    config: ClientConfig & { consumer: string; consumerVersion: string },
    options: InterceptOptions = {},
    skipOperations = false
  ) {
    this.service = service
    this.providerVersion = providerVersion
    this.config = config
    this.options = options
    this.skipOperations = skipOperations

    // Parse spec and create router
    const parsedSpec = specRegistry.parseSpec(spec)
    if (!parsedSpec) {
      throw new Error('Unsupported specification format')
    }
    this.spec = parsedSpec

    debugLog(`🔍 [Interceptor] Detected spec type: ${parsedSpec.type}`)

    // Create router for operation matching
    try {
      const handler = specRegistry.getHandler(parsedSpec.type)
      if (!handler) {
        throw new Error(`No handler found for spec type: ${parsedSpec.type}`)
      }

      this.router = createRequestRouter({
        spec: parsedSpec as any,
        fixtures,
        handler: handler as any,
        options: { debug: process.env.ENTENTE_DEBUG === 'true' },
      })
      debugLog(`✅ [Interceptor] Router created successfully for ${parsedSpec.type}`)
    } catch (e) {
      console.warn('[entente][interceptor] failed to initialize request router', e)
    }

    // Setup MSW interceptors
    this.interceptor = new BatchInterceptor({
      name: 'entente-interceptor',
      interceptors: [
        new ClientRequestInterceptor(), // For http/https/supertest/axios/etc
        new FetchInterceptor(), // For fetch API
      ],
    })

    this.setupInterceptorListeners()
  }

  private setupInterceptorListeners() {
    // Improved check for interceptor capability
    if (!this.interceptor || typeof (this.interceptor as any).on !== 'function') {
      debugLog('⚠️ [Interceptor] Interceptor does not support event listeners, skipping setup')
      return
    }

    (this.interceptor as any).on('request', async ({ request, requestId }: any) => {
      try {
        const startTime = Date.now()

        // Apply URL filter if provided
        if (this.options.filter && !this.options.filter(request.url)) {
          return
        }

        // Determine request type
        const requestType = this.detectRequestType(request)
        this.stats[requestType]++
        this.stats.total++

        debugLog(`🔄 [Interceptor] Intercepted ${requestType} request: ${request.method} ${request.url}`)

        // Convert to unified format for matching - with additional error handling
        let unifiedRequest: UnifiedRequest
        try {
          unifiedRequest = await this.convertRequestToUnified(request)
        } catch (conversionError) {
          console.error('[entente][interceptor] Error converting request:', conversionError)
          // Create a minimal unified request as fallback
          const url = new URL(request.url)
          unifiedRequest = {
            method: request.method || 'GET',
            path: url.pathname,
            headers: {},
            query: {},
            body: undefined,
          }
        }

        // Match against spec operations
        let matchOutcome: any = { match: { selected: null, candidates: [] } }
        if (this.router && typeof this.router.handle === 'function') {
          try {
            matchOutcome = this.router.handle(unifiedRequest)
            debugLog(`✅ [Interceptor] Operation matched: ${matchOutcome.match.selected?.operation.id || 'unknown'}`)
          } catch (e) {
            debugLog(`⚠️ [Interceptor] Operation matching failed: ${e}`)
          }
        }

        // Store pending request for when response arrives
        this.pendingRequests.set(requestId, {
          startTime,
          unifiedRequest,
          matchOutcome,
          requestType,
        })
      } catch (error) {
        console.error('[entente][interceptor] Error handling request:', error)
        // Continue processing instead of failing completely
      }
    })

    if (typeof (this.interceptor as any).on === 'function') {
      (this.interceptor as any).on('response', async ({ response, requestId }: any) => {
      try {
        const pending = this.pendingRequests.get(requestId)
        if (!pending) {
          debugLog(`⚠️ [Interceptor] No pending request found for ${requestId}`)
          return
        }

        const duration = Date.now() - pending.startTime

        // Extract response body safely
        let responseBody: unknown
        try {
          responseBody = await this.extractResponseBody(response.clone())
        } catch (bodyError) {
          debugLog(`⚠️ [Interceptor] Failed to extract response body: ${bodyError}`)
          responseBody = null
        }

        // Extract response headers safely
        let responseHeaders: Record<string, string> = {}
        try {
          responseHeaders = Object.fromEntries(response.headers.entries())
        } catch (headerError) {
          debugLog(`⚠️ [Interceptor] Failed to extract response headers: ${headerError}`)
        }

        // Convert response to our format
        const interceptedCall: InterceptedCall = {
          request: {
            method: pending.unifiedRequest.method || 'GET',
            url: pending.unifiedRequest.path || '',
            headers: pending.unifiedRequest.headers || {},
            body: pending.unifiedRequest.body,
          },
          response: {
            status: response.status || 0,
            headers: responseHeaders,
            body: responseBody,
          },
          operation: pending.matchOutcome.match.selected?.operation.id || 'unknown',
          matchContext: {
            selectedOperationId: pending.matchOutcome.match.selected?.operation.id || 'unknown',
            candidates: pending.matchOutcome.match.candidates || [],
            confidence: pending.matchOutcome.match.selected?.confidence,
          },
          duration,
          timestamp: new Date(),
          consumer: this.config.consumer,
          consumerVersion: this.config.consumerVersion,
          environment: this.config.environment,
        }

        this.interceptedCalls.push(interceptedCall)

        // Record interaction if recording is enabled
        if (this.shouldRecordInteraction()) {
          await this.recordInteraction(interceptedCall)
        }

        // Clean up pending request
        this.pendingRequests.delete(requestId)

        debugLog(`📝 [Interceptor] Recorded interaction for operation: ${interceptedCall.operation}`)
      } catch (error) {
        console.error('[entente][interceptor] Error handling response:', error)
        // Clean up pending request even on error
        this.pendingRequests.delete(requestId)
      }
    })
    }
  }

  private detectRequestType(request: any): 'fetch' | 'http' {
    // MSW request objects have different properties based on their source
    // Fetch requests typically have a 'url' property as a string
    // HTTP requests typically have different structure
    // For now, we'll make a best guess
    return 'fetch' // Default assumption, can be refined
  }

  private async convertRequestToUnified(request: any): Promise<UnifiedRequest> {
    const url = new URL(request.url)

    // Extract headers
    const headers: Record<string, string> = {}
    if (request.headers) {
      for (const [key, value] of request.headers.entries()) {
        headers[key.toLowerCase()] = value
      }
    }

    // Extract body - handle carefully to avoid "unusable" error
    let body: unknown = undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        // Clone the request to avoid consuming the original body
        const clonedRequest = request.clone()

        // Check if body exists and is readable
        if (clonedRequest.body && !clonedRequest.bodyUsed) {
          const bodyText = await clonedRequest.text()
          if (bodyText) {
            const contentType = headers['content-type'] || ''
            if (contentType.includes('application/json')) {
              try {
                body = JSON.parse(bodyText)
              } catch {
                body = bodyText
              }
            } else {
              body = bodyText
            }
          }
        }
      } catch (error) {
        // Log the error for debugging but don't fail
        debugLog(`⚠️ [Interceptor] Failed to read request body: ${error}`)
      }
    }

    // Extract query parameters
    const query: Record<string, unknown> = {}
    for (const [key, value] of url.searchParams.entries()) {
      query[key] = value
    }

    return {
      method: request.method,
      path: url.pathname,
      headers,
      query,
      body,
    }
  }

  private async extractResponseBody(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        return await response.json()
      } else {
        return await response.text()
      }
    } catch {
      return null
    }
  }

  private shouldRecordInteraction(): boolean {
    return (
      this.options.recording !== false && // Default to true unless explicitly disabled
      !this.skipOperations && // Don't record if using fallback values
      (this.config.recordingEnabled || process.env.CI === 'true') // Record in CI or if explicitly enabled
    )
  }

  private async recordInteraction(call: InterceptedCall): Promise<void> {
    if (this.skipOperations) {
      debugLog(`🚫 [Interceptor] Skipping interaction recording - consumer info unavailable`)
      return
    }

    // Generate hash for deduplication
    const hash = await generateInteractionHash(
      call.consumer,
      call.consumerVersion,
      this.service,
      call.operation,
      call.request,
      call.response
    )

    // Skip if we've already seen this interaction
    if (this.seenHashes.has(hash)) {
      return
    }
    this.seenHashes.add(hash)

    // Get git SHA once and cache it
    if (this.cachedGitSha === null) {
      this.cachedGitSha = getGitSha()
    }

    const interaction: ClientInteraction = {
      id: this.generateId(),
      timestamp: call.timestamp,
      service: this.service,
      consumer: call.consumer,
      consumerVersion: call.consumerVersion,
      providerVersion: this.providerVersion,
      environment: call.environment,
      operation: call.operation,
      request: {
        ...call.request,
        path: call.request.url, // Map url to path for HTTPRequest compatibility
      } as any,
      response: call.response,
      matchContext: call.matchContext,
      duration: call.duration,
      consumerGitSha: this.cachedGitSha || undefined,
      clientInfo: {
        library: '@entente/consumer',
        version: '0.1.0', // TODO: Get from package.json
        buildId: process.env.BUILD_ID,
        commit: this.cachedGitSha || undefined,
      },
    }

    this.recordedInteractions.push(interaction)

    // Auto-flush in CI to avoid losing data
    if (process.env.CI && this.recordedInteractions.length >= 10) {
      await this.flushInteractions()
    }
  }

  private generateId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Public API methods

  apply(): void {
    if (this.isActive) {
      console.warn('[entente][interceptor] Interceptor is already active')
      return
    }

    this.interceptor.apply()
    this.isActive = true
    debugLog('🚀 [Interceptor] Request interception activated')
  }

  async unpatch(): Promise<void> {
    if (!this.isActive) return

    // Dispose of interceptor
    this.interceptor.dispose()
    this.isActive = false

    // Flush any remaining interactions
    await this.flushInteractions()

    debugLog('🛑 [Interceptor] Request interception deactivated')
  }

  isPatched(): boolean {
    return this.isActive
  }

  getInterceptedCalls(): InterceptedCall[] {
    return [...this.interceptedCalls]
  }

  getRecordedInteractions(): ClientInteraction[] {
    return [...this.recordedInteractions]
  }

  getStats() {
    return { ...this.stats }
  }

  async [Symbol.dispose](): Promise<void> {
    await this.unpatch()
  }

  private async flushInteractions(): Promise<void> {
    if (this.recordedInteractions.length === 0) return

    try {
      // Send all interactions in one batch request
      const response = await fetch(`${this.config.serviceUrl}/api/interactions/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.recordedInteractions),
      })

      if (response.ok) {
        const result = await response.json()
        debugLog(
          `✅ [Interceptor] Batch uploaded ${this.recordedInteractions.length} interactions: ${result.results.recorded} recorded, ${result.results.duplicates} duplicates`
        )
      } else {
        console.error(
          `❌ [Interceptor] Failed to upload interactions batch: ${response.status} ${response.statusText}`
        )
      }

      this.recordedInteractions.length = 0 // Clear array
      this.seenHashes.clear() // Clear deduplication cache
    } catch (error) {
      console.error(`❌ [Interceptor] Error uploading interactions batch: ${error}`)
    }
  }
}