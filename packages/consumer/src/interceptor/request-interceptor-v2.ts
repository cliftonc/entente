import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { convertHTTPToUnified } from '@entente/fixtures'
import type {
  ClientConfig,
  ClientInteraction,
  Fixture,
  SupportedSpec,
  UnifiedRequest,
} from '@entente/types'
import { debugLog } from '@entente/types'
import {
  createOperationMatchingService,
  createFixtureCollectionService,
  createInteractionRecordingService,
  createErrorReporter,
  withErrorHandling,
  type OperationMatchingService,
  type FixtureCollectionService,
  type InteractionRecordingService,
} from '../shared/index.js'
import type { InterceptedCall, InterceptOptions, RequestInterceptor } from './types.js'

interface PendingRequest {
  startTime: number
  unifiedRequest: UnifiedRequest
  matchResult: any
  requestType: 'fetch' | 'http'
}

export class EntenteRequestInterceptor implements RequestInterceptor {
  private interceptor: BatchInterceptor<any>
  private operationMatching: OperationMatchingService
  private fixtureCollection: FixtureCollectionService
  private interactionRecording: InteractionRecordingService
  private errorReporter: ReturnType<typeof createErrorReporter>
  private isActive = false

  // Recording state
  private pendingRequests = new Map<string, PendingRequest>()
  private interceptedCalls: InterceptedCall[] = []

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

    // Initialize shared services
    this.errorReporter = createErrorReporter(service, 'interceptor')

    this.operationMatching = createOperationMatchingService(spec, fixtures, {
      debug: process.env.ENTENTE_DEBUG === 'true',
      useRouter: false, // Interceptor mode doesn't need response generation
    })

    this.fixtureCollection = createFixtureCollectionService({
      service,
      providerVersion,
      specType: this.operationMatching.getSpec().type,
      serviceUrl: config.serviceUrl,
      apiKey: config.apiKey,
      enabled: !skipOperations,
    })

    this.interactionRecording = createInteractionRecordingService({
      consumer: config.consumer,
      consumerVersion: config.consumerVersion,
      environment: config.environment,
      serviceUrl: config.serviceUrl,
      apiKey: config.apiKey,
      enabled: options.recording !== false,
      skipOperations,
    })

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
      await withErrorHandling(
        async () => {
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

          // Convert to unified format for matching
          const unifiedRequest = await this.convertRequestToUnified(request)

          // Match against spec operations
          const matchResult = this.operationMatching.match(unifiedRequest)

          // Store pending request for when response arrives
          this.pendingRequests.set(requestId, {
            startTime,
            unifiedRequest,
            matchResult,
            requestType,
          })
        },
        { service: this.service, mode: 'interceptor', phase: 'request' },
        () => {
          // Fallback: just continue without recording
          debugLog('⚠️ [Interceptor] Request handling failed, continuing without recording')
        }
      )
    })

    if (typeof (this.interceptor as any).on === 'function') {
      (this.interceptor as any).on('response', async ({ response, requestId }: any) => {
        await withErrorHandling(
          async () => {
            const pending = this.pendingRequests.get(requestId)
            if (!pending) {
              debugLog(`⚠️ [Interceptor] No pending request found for ${requestId}`)
              return
            }

            const duration = Date.now() - pending.startTime

            // Extract response data safely
            const responseBody = await this.extractResponseBody(response.clone())
            const responseHeaders = this.extractResponseHeaders(response)

            // Create intercepted call record
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
              operation: pending.matchResult.operation,
              matchContext: {
                selectedOperationId: pending.matchResult.operation,
                candidates: pending.matchResult.candidates || [],
                confidence: pending.matchResult.confidence,
              },
              duration,
              timestamp: new Date(),
              consumer: this.config.consumer,
              consumerVersion: this.config.consumerVersion,
              environment: this.config.environment,
            }

            this.interceptedCalls.push(interceptedCall)

            // Record interaction
            await this.interactionRecording.record({
              service: this.service,
              providerVersion: this.providerVersion,
              operation: interceptedCall.operation,
              request: {
                method: interceptedCall.request.method,
                path: interceptedCall.request.url,
                headers: interceptedCall.request.headers,
                body: interceptedCall.request.body,
              },
              response: interceptedCall.response,
              matchContext: interceptedCall.matchContext,
              duration: interceptedCall.duration,
            })

            // Collect fixture if successful response
            if (response.status >= 200 && response.status < 300) {
              await this.fixtureCollection.collect(interceptedCall.operation, {
                request: {
                  method: interceptedCall.request.method,
                  path: interceptedCall.request.url,
                  headers: interceptedCall.request.headers,
                  body: interceptedCall.request.body,
                },
                response: interceptedCall.response,
              })
            }

            // Clean up pending request
            this.pendingRequests.delete(requestId)

            debugLog(`📝 [Interceptor] Recorded interaction for operation: ${interceptedCall.operation}`)
          },
          { service: this.service, mode: 'interceptor', phase: 'response' },
          () => {
            // Cleanup on error
            this.pendingRequests.delete(requestId)
          }
        )
      })
    }
  }

  private detectRequestType(request: any): 'fetch' | 'http' {
    // MSW request objects have different properties based on their source
    // For simplicity, we'll default to fetch as it's more common
    return 'fetch'
  }

  private async convertRequestToUnified(request: any): Promise<UnifiedRequest> {
    const url = new URL(request.url)

    // Extract headers safely
    const headers: Record<string, string> = {}
    if (request.headers) {
      for (const [key, value] of request.headers.entries()) {
        headers[key.toLowerCase()] = value
      }
    }

    // Extract body safely
    let body: unknown = undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const clonedRequest = request.clone()
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

  private extractResponseHeaders(response: Response): Record<string, string> {
    try {
      return Object.fromEntries(response.headers.entries())
    } catch {
      return {}
    }
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

    debugLog('🔄 [Interceptor] Starting unpatch process...')

    // Dispose of interceptor
    this.interceptor.dispose()
    this.isActive = false

    // Flush all pending operations using shared services
    await Promise.all([
      this.interactionRecording.flush(),
      this.fixtureCollection.flush(),
    ])

    debugLog('🛑 [Interceptor] Request interception deactivated')
  }

  isPatched(): boolean {
    return this.isActive
  }

  getInterceptedCalls(): InterceptedCall[] {
    return [...this.interceptedCalls]
  }

  getRecordedInteractions(): ClientInteraction[] {
    // For compatibility - would need to be implemented if needed
    return []
  }

  getStats() {
    return { ...this.stats }
  }

  async [Symbol.dispose](): Promise<void> {
    await this.unpatch()
  }
}