import type {
  APISpec,
  OperationMatchContext,
  OperationMatchResult,
  SpecHandler,
  UnifiedRequest,
} from '@entente/types'
import { debugLog } from '@entente/types'

export interface OperationMatcherOptions {
  debug?: boolean
}

export interface OperationMatcher {
  match: (request: UnifiedRequest) => OperationMatchResult
}

/**
 * Creates a pure operation matcher that only identifies which operation
 * a request matches, without any fixture selection or response generation.
 * This is used by interceptors for recording purposes.
 */
export const createOperationMatcher = ({
  spec,
  handler,
  options = {},
}: {
  spec: APISpec
  handler: SpecHandler
  options?: OperationMatcherOptions
}): OperationMatcher => {
  // Cache operations once
  const operations = handler.extractOperations(spec)
  const debug = !!options.debug || process.env.ENTENTE_DEBUG === 'true'

  const match = (request: UnifiedRequest): OperationMatchResult => {
    const ctx: OperationMatchContext = {
      request,
      specType: spec.type,
      spec,
      operations,
    }

    const matchResult: OperationMatchResult = handler.matchOperation(ctx)

    if (debug) {
      debugLog(
        '[entente][matcher] candidates',
        matchResult.candidates.map(c => ({
          op: c.operation.id,
          conf: c.confidence,
          reasons: c.reasons,
        }))
      )
    }

    return matchResult
  }

  return { match }
}