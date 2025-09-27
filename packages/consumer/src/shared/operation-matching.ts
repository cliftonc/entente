import { createOperationMatcher, createRequestRouter } from '@entente/fixtures'
import { specRegistry } from '@entente/fixtures'
import type { APISpec, Fixture, SupportedSpec, UnifiedRequest } from '@entente/types'
import { debugLog } from '@entente/types'

export interface OperationMatchingService {
  match(request: UnifiedRequest): OperationMatchResult
  handleRequest(request: UnifiedRequest): RequestHandleResult
  getSpec(): APISpec
}

export interface OperationMatchResult {
  operation: string
  confidence: number
  candidates: Array<{
    operationId: string
    confidence: number
    reasons: string[]
  }>
  metadata?: {
    selectedOperationId: string
    fixtureId?: string
    fixtureReasons?: string[]
  }
}

export interface RequestHandleResult {
  match: OperationMatchResult
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
    success: boolean
  }
  fixtureUsed?: {
    fixtureId: string
    reasons: string[]
  }
}

export interface OperationMatchingOptions {
  debug?: boolean
  useRouter?: boolean
}

export const createOperationMatchingService = (
  spec: SupportedSpec,
  fixtures: Fixture[] = [],
  options: OperationMatchingOptions = {}
): OperationMatchingService => {
  const debug = options.debug ?? process.env.ENTENTE_DEBUG === 'true'
  const useRouter = options.useRouter ?? true

  // Parse spec and validate
  const parsedSpec = specRegistry.parseSpec(spec)
  if (!parsedSpec) {
    throw new Error('Unsupported specification format')
  }

  debugLog(`🔍 [OperationMatching] Detected spec type: ${parsedSpec.type}`)

  // Get handler for this spec type
  const handler = specRegistry.getHandler(parsedSpec.type)
  if (!handler) {
    throw new Error(`No handler found for spec type: ${parsedSpec.type}`)
  }

  // Create operation matcher (always available)
  let operationMatcher: any
  try {
    operationMatcher = createOperationMatcher({
      spec: parsedSpec as any,
      handler: handler as any,
      options: { debug },
    })
    debugLog(`✅ [OperationMatching] Operation matcher created successfully for ${parsedSpec.type}`)
  } catch (e) {
    console.warn('[entente][operation-matching] failed to initialize operation matcher', e)
    operationMatcher = null
  }

  // Create router if fixtures are available and router is requested
  let router: any
  if (useRouter && fixtures.length > 0 && parsedSpec.type !== 'asyncapi') {
    try {
      debugLog(`🚀 [OperationMatching] Creating V2 router for ${parsedSpec.type} spec`)
      router = createRequestRouter({
        spec: parsedSpec as any,
        fixtures,
        handler: handler as any,
        options: { debug },
      })
      debugLog(`✅ [OperationMatching] V2 router created successfully for ${parsedSpec.type}`)
    } catch (e) {
      console.warn('[entente][operation-matching] failed to initialize request router, falling back', e)
      router = null
    }
  }

  const match = (request: UnifiedRequest): OperationMatchResult => {
    if (!operationMatcher || typeof operationMatcher.match !== 'function') {
      debugLog(`⚠️ [OperationMatching] No operation matcher available`)
      return {
        operation: 'unknown',
        confidence: 0,
        candidates: [],
        metadata: {
          selectedOperationId: 'unknown',
        },
      }
    }

    try {
      const matchResult = operationMatcher.match(request)

      return {
        operation: matchResult.selected?.operation.id || 'unknown',
        confidence: matchResult.selected?.confidence || 0,
        candidates: matchResult.candidates?.map((c: any) => ({
          operationId: c.operation.id,
          confidence: c.confidence,
          reasons: c.reasons || [],
        })) || [],
        metadata: {
          selectedOperationId: matchResult.selected?.operation.id || 'unknown',
        },
      }
    } catch (e) {
      debugLog(`⚠️ [OperationMatching] Operation matching failed: ${e}`)
      return {
        operation: 'unknown',
        confidence: 0,
        candidates: [],
        metadata: {
          selectedOperationId: 'unknown',
        },
      }
    }
  }

  const handleRequest = (request: UnifiedRequest): RequestHandleResult => {
    // If router is available, use it for full request handling
    if (router && typeof router.handle === 'function') {
      try {
        debugLog(`🔄 [OperationMatching] Using V2 router for ${request.method} ${request.path}`)
        const routerResult = router.handle(request)

        const matchResult: OperationMatchResult = {
          operation: routerResult.match.selected?.operation.id || 'unknown',
          confidence: routerResult.match.selected?.confidence || 0,
          candidates: routerResult.match.candidates?.map((c: any) => ({
            operationId: c.operation.id,
            confidence: c.confidence,
            reasons: c.reasons || [],
          })) || [],
          metadata: {
            selectedOperationId: routerResult.match.selected?.operation.id || 'unknown',
            fixtureId: routerResult.fixtureSelection?.selected?.fixtureId,
            fixtureReasons: routerResult.fixtureSelection?.selected?.reasons,
          },
        }

        return {
          match: matchResult,
          response: routerResult.response,
          fixtureUsed: routerResult.fixtureSelection?.selected ? {
            fixtureId: routerResult.fixtureSelection.selected.fixtureId,
            reasons: routerResult.fixtureSelection.selected.reasons || [],
          } : undefined,
        }
      } catch (e) {
        console.warn('[entente][operation-matching] router handling failed, falling back to match-only', e)
      }
    }

    // Fallback to match-only mode
    const matchResult = match(request)

    return {
      match: matchResult,
      response: {
        status: matchResult.operation === 'unknown' ? 404 : 200,
        headers: { 'content-type': 'application/json' },
        body: matchResult.operation === 'unknown'
          ? { error: 'operation_not_found' }
          : { message: 'No fixture available, operation matched' },
        success: matchResult.operation !== 'unknown',
      },
    }
  }

  const getSpec = (): APISpec => parsedSpec

  return {
    match,
    handleRequest,
    getSpec,
  }
}