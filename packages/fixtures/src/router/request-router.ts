import type {
  APISpec,
  Fixture,
  FixtureSelectionResult,
  OperationMatchResult,
  SpecHandler,
  UnifiedRequest,
  UnifiedResponse,
} from '@entente/types'
import { debugLog } from '@entente/types'
import { scoreFixturesDefault } from '../scoring/fixture-scoring.js'
import { createOperationMatcher } from '../matching/operation-matcher.js'

export interface RequestRouterOptions {
  debug?: boolean
  // Use custom scoring override (e.g., for testing) when handler doesn't supply one
  scoreFixtures?: typeof scoreFixturesDefault
}

export interface MatchOutcome {
  match: OperationMatchResult
  fixtureSelection?: FixtureSelectionResult
  response: UnifiedResponse
}

export interface RequestRouter {
  handle: (request: UnifiedRequest) => MatchOutcome
}

export const createRequestRouter = ({
  spec,
  fixtures,
  handler,
  options = {},
}: {
  spec: APISpec
  fixtures: Fixture[]
  handler: SpecHandler
  options?: RequestRouterOptions
}): RequestRouter => {
  const debug = !!options.debug || process.env.ENTENTE_DEBUG === 'true'

  // Create operation matcher for reusable matching logic
  const operationMatcher = createOperationMatcher({
    spec,
    handler,
    options: { debug },
  })

  const scoreFn = handler.scoreFixtures ?? scoreFixturesDefault

  const handle = (request: UnifiedRequest): MatchOutcome => {
    // Use the shared operation matcher
    const matchResult: OperationMatchResult = operationMatcher.match(request)

    if (!matchResult.selected) {
      return {
        match: matchResult,
        response: {
          status: 404,
          headers: { 'content-type': 'application/json' },
          body: { error: 'operation_not_found' },
          success: false,
        },
      }
    }

    // Score fixtures for selected operation
    const fixtureSelection = scoreFn({
      fixtures,
      request,
      operation: matchResult.selected.operation, // adapt to scoreFixturesDefault signature
      match: matchResult.selected,
    } as any) // cast because handler.scoreFixtures uses different param shape vs default (operation present)

    if (debug) {
      debugLog('[entente][router] fixtureSelection', fixtureSelection)
    }

    // If fixture chosen, produce response directly from its data
    if (fixtureSelection.selected) {
      const chosenId = fixtureSelection.selected.fixtureId
      const chosen = fixtures.find(f => f.id === chosenId)
      if (chosen?.data?.response) {
        const responseBody = (chosen.data.response as any).body ?? (chosen.data.response as any)
        debugLog(`🔧 [Router] Returning fixture ${chosenId} response:`, JSON.stringify(responseBody, null, 2))
        return {
          match: matchResult,
          fixtureSelection,
          response: {
            status: (chosen.data.response as any).status ?? 200,
            headers: (chosen.data.response as any).headers ?? {
              'content-type': 'application/json',
            },
            body: responseBody,
            success: true,
          },
        }
      }
    }

    // Fallback to handler generation
    const response = handler.generateResponse({
      operation: matchResult.selected.operation,
      fixtures,
      request,
      match: matchResult.selected,
      fixtureSelection,
    })

    return { match: matchResult, fixtureSelection, response }
  }

  return { handle }
}
