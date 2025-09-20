import type {
  Fixture,
  FixtureSelectionResult,
  FixtureScoreBreakdown,
  OperationMatchCandidate,
  UnifiedRequest,
} from '@entente/types'

// Source weights (design intent: provider > manual > consumer)
const SOURCE_WEIGHT: Record<Fixture['source'], number> = {
  provider: 30,
  manual: 20,
  consumer: 10,
}

// Compute alignment score between incoming request and a fixture's stored request data (if present)
const computeRequestAlignment = (
  request: UnifiedRequest,
  fixture: Fixture
): {
  alignment: number
  reasons: string[]
} => {
  const reasons: string[] = []
  let score = 0
  const fxReq: any = fixture.data.request
  if (!fxReq) return { alignment: score, reasons }

  // Path matching for REST
  if (request.path && fxReq.path && request.path === fxReq.path) {
    score += 10
    reasons.push('path_exact')
  }

  // Body deep equality (shallow stringify compare for now; improvement later)
  if (request.body && fxReq.body) {
    try {
      const reqStr = JSON.stringify(request.body)
      const fxStr = JSON.stringify(fxReq.body)
      if (reqStr === fxStr) {
        score += 10
        reasons.push('body_equal')
      }
    } catch {
      // ignore serialization issues
    }
  }

  // Query subset match
  if (request.query && fxReq.query) {
    const reqKeys = Object.keys(request.query)
    const fxKeys = Object.keys(fxReq.query)
    const subset = reqKeys.every(k => fxKeys.includes(k))
    if (subset && reqKeys.length > 0) {
      score += 5
      reasons.push('query_subset')
    }
  }

  return { alignment: score, reasons }
}

export interface ScoreFixturesParams {
  fixtures: Fixture[]
  request: UnifiedRequest
  match: OperationMatchCandidate
}

export const scoreFixturesDefault = ({
  fixtures,
  request,
  match,
}: ScoreFixturesParams): FixtureSelectionResult => {
  const related = fixtures.filter(f => f.operation === match.operation.id)
  if (related.length === 0) return { ordered: [] }

  const scored: FixtureScoreBreakdown[] = related.map(fixture => {
    const base = 0
    const priority = fixture.priority ?? 0
    const sourceBias = SOURCE_WEIGHT[fixture.source]
    const { alignment, reasons: alignmentReasons } = computeRequestAlignment(request, fixture)

    const reasons = [`source_${fixture.source}`, `priority_${priority}`, ...alignmentReasons]

    const total = base + priority * 5 + sourceBias + alignment

    return {
      fixtureId: fixture.id,
      base,
      priority: priority * 5,
      sourceBias,
      specificity: alignment > 0 ? alignment : undefined,
      total,
      reasons,
    }
  })

  scored.sort((a, b) => b.total - a.total)

  return {
    ordered: scored,
    selected: scored[0],
  }
}
