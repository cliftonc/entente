---
title: "Spec Handler V2 & Request Router Refactor"
description: "Introduce structured operation matching, fixture scoring/selection, and a unified request router across all spec types with incremental, backward-compatible rollout"
---

# Spec Handler V2 & Request Router Refactor

**Owner**: Platform / Fixtures Team  
**Status**: Draft (Phase 0)  
**Target Start**: Week 1  
**Primary Goal**: Replace ad-hoc request → operation resolution & fixture lookup with a structured, cross-spec matching + selection pipeline with a clean break (no V1 compatibility layer retained).

## 1. Motivation
The current implementation duplicates logic for:
- Extracting operations (HTTP path/method vs GraphQL vs AsyncAPI)
- Matching incoming requests to an operation ID
- Selecting a fixture (priority, source, request alignment)
- Generating a mock response when no fixture matches

Pain points:
- Consumer package re-implements path and fixture matching (`extractOperationFromSpec`, `_findMatchingFixture`, `pathMatches`).
- GraphQL special casing lives in consumer code rather than handler.
- No structured context is passed to recorder / fixture collector (only raw operation string).
- Extending to other spec types (gRPC / SOAP) would multiply duplication.

## 2. Objectives (What Success Looks Like)
1. Unified, spec-agnostic router: `router.match(request)` returns ranked structured matches.
2. Deterministic fixture selection with explainable scoring.
3. Handlers expose richer metadata (path params, variables, channel params, inferred entities) via `OperationMatchContext`.
4. Recorder + fixture collector store enriched context (operationId + params + specType) enabling future differential verification and intelligent fixture normalization.
5. Legacy helpers removed immediately after V2 adoption (single cut-over), minimizing maintenance burden.

## 3. Scope
In Scope:
- New V2 type interfaces (additive) in `@entente/types` & `fixtures`.
- Router implementation in `packages/fixtures` consumed by consumer mock server.
- Adapter wrapping legacy `SpecHandler` → minimal V2 compliance.
- Updated GraphQL/OpenAPI/AsyncAPI handlers to produce confidence + context.
- Recorder / fixture collector upgrade (fields additive initially).
- Tests for matching and fixture selection across spec types.

Out of Scope (Future Phases):
- gRPC / SOAP handlers actual implementation.
- Persistence schema changes for interaction context (will follow after validation period).
- Advanced semantic fixture diffing / ML ranking.

## 4. Key Concepts & New Types
```ts
// packages/types/src (additive)
export interface OperationMatchContext {
  specType: SpecType
  operationId: string
  rawOperation?: APIOperation
  pathParams?: Record<string, string>
  variables?: Record<string, unknown> // GraphQL variables
  channelParams?: Record<string, string>
  requestBodyFingerprint?: string // Stable hash for body-driven matching
  method?: string
  path?: string
  channel?: string
  confidence: number // 0..1
  reasons: string[] // Ordered explanation messages
}

export interface OperationMatchResult {
  context: OperationMatchContext
  // Optional immediate response (e.g. handler-synthesized) if no fixture needed
  provisionalResponse?: UnifiedResponse
}

export interface FixtureScoreBreakdown {
  base: number
  sourceWeight: number
  priorityWeight: number
  requestAlignment: number
  recency?: number
  total: number
  reasons: string[]
}

export interface FixtureSelectionResult {
  fixture?: Fixture
  score: FixtureScoreBreakdown
  considered: Array<{ id: string; total: number }>
}

export interface SpecHandlerV2 {
  type: SpecType
  name: string
  // V1 compatibility retained
  legacy?: SpecHandler
  // Return zero or more candidate matches (ranked internally or not)
  matchOperation: (request: UnifiedRequest, spec: APISpec, operations: APIOperation[]) => OperationMatchResult[]
  // Allow handler-specific pre-selection / filtering of fixtures (optional)
  selectFixture?: (match: OperationMatchResult, fixtures: Fixture[]) => FixtureSelectionResult | null
  // Fallback response generation (invoked if no fixture selected)
  generateMockResponse: (match: OperationMatchResult, fixtures: Fixture[]) => UnifiedResponse
  // Optional: enrich newly recorded context (e.g., infer entities)
  enhanceContext?: (match: OperationMatchResult) => OperationMatchResult
}
```

## 5. Architecture Overview
Pipeline (per request):
1. Parse → `UnifiedRequest` (existing logic).
2. Lookup handler via `spec.type` → obtain operations array (cached).
3. `handlerV2.matchOperation()` returns candidates with confidence + reasons.
4. Router normalizes / sorts by confidence (tie-break: specificity → path param count, then operationId lexical).
5. Candidate fixture selection:
   - If handler provides `selectFixture`, accept first non-null.
   - Else apply default scorer across fixtures filtered by `operationId` & `specType`.
6. If fixture found → build `UnifiedResponse` (use fixture data directly).
7. Else call `handlerV2.generateMockResponse()` (which may reuse legacy `generateResponse`).
8. Emit enriched match context to recorder + (if success) fixture collector.

## 6. Fixture Scoring Heuristic (Default)
| Factor | Rationale | Weight (suggested) |
|--------|-----------|-------------------|
| Source | provider > manual > consumer | 30 / 20 / 10 |
| Priority | Higher numeric priority | +priority * 5 |
| Request alignment | Path params & body equality | up to +25 |
| Status code alignment (if request indicates expected) | Predictability | +5 |
| Recency (future) | Freshness | (deferred) |

Request alignment scoring:
- Exact path param count & values match fixture.request.path → +10
- Body deep-equal (if both present) → +10
- Query key subset match → +5

## 7. Rollout Plan
Single-cut release:
- Implement new types, router, scoring, and enhanced handlers in one coordinated change set.
- Swap consumer to router-driven operation + fixture selection.
- Remove legacy operation extraction & matching utilities in same PR (breaking change documented).
- Recorder emits new `matchContext`; legacy operation field may remain temporarily for external integrations but is no longer source of truth.

## 8. Detailed Task Breakdown
| ID | Task | Description | Output | Priority |
|----|------|-------------|--------|----------|
| 1 | V2 Types | Add new interfaces (no breaking) | types + export | High |
| 2 | Router Core | `createRequestRouter(spec, fixtures, handlerV2)` with pipeline | new module | High |
| 3 | Default Scoring | Implement `scoreFixture(match, fixture)` + rank | util | High |
| 4 | Consumer Integration | Replace operation extraction + fixture lookup | updated consumer | High |
| 6 | GraphQL Migration | Implement enhanced `matchOperation` & context | handler updates | Med |
| 7 | OpenAPI Migration | Add path params + confidence | handler updates | Med |
| 8 | AsyncAPI Migration | Channel params + confidence | handler updates | Med |
| 9 | Recorder Update | Enrich recorded interaction payload | consumer change | Med |
| 10 | Test Harness | Cross-spec tests: matching, scoring, fallback | new tests | Med |
| 11 | Cleanup | Remove legacy utilities & dead code | removals | Low |

## 9. Module & File Changes (Proposed)
- `packages/types/src/index.ts`: Add new interfaces & exports (suffix V2 names distinct). No removals in initial PR.
- `packages/fixtures/src/spec-handlers/types.ts`: Export adapter & shared scoring types or create `matching.ts`.
- `packages/fixtures/src/router/request-router.ts` (new): Implements pipeline.
- `packages/fixtures/src/scoring/fixture-scoring.ts` (new): Default scoring util.
- `packages/fixtures/src/spec-handlers/{openapi,graphql,asyncapi}.ts`: Add V2 `matchOperation`; keep legacy functions until cleanup.
- `packages/consumer/src/index.ts`: Use router for request handling & recorder context.
- Tests: `packages/fixtures/test/router/*.test.ts` and augment handler tests.

## 10. Removed Adapter Strategy
Legacy adapter intentionally omitted to avoid dual maintenance. All handlers are upgraded directly to V2 interfaces.

## 11. Testing Strategy (Updated)
Layers:
1. Unit: scoring function deterministic ordering (snapshot of breakdown). 
2. Unit: handler-specific `matchOperation` variants (exact vs param vs fallback). 
3. Integration: router end-to-end (request → response) with combinations:
   - Exact fixture
   - Multiple fixtures (different source, priority) → correct selection.
   - No fixture → mock response fallback.
   - GraphQL doc without operationName (single operation) → lowered confidence.
4. Regression: legacy operation extraction still returns same operationId for unchanged handlers (compare before/after on sample requests).
5. Performance: baseline requests per second unchanged (±5%) vs legacy for OpenAPI (micro-benchmark optional).

## 12. Breaking Changes & Deprecations
This refactor intentionally removes legacy matching utilities in the same release to prevent split-brain logic:
- Removed: `extractOperationFromSpec`, `_findMatchingFixture`, `pathMatches`, `_generateResponseFromSpec`, `generateRequestDataForOperation`.
- New router + handlers are canonical; any external code relying on removed exports must migrate to V2 router APIs.
- Transitional field: legacy `operation` string may persist in recorded payloads short-term but will be marked deprecated.

## 13. Rollback Plan
Rollback requires reverting the merge commit introducing V2 router & handlers. No runtime flag available (explicit decision to avoid dual paths). Ensure comprehensive tests before release.

## 14. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Confidence mis-ranking leads to wrong fixture | Incorrect test behavior | Deterministic scoring + test corpus covering edge cases |
| Performance regression | Slower test suites | Cache operations & precompute fixture indexes (by operationId) |
| Over-collection of interaction context size | Increased payload size | Add context selectively (omit large bodies; store body hash only) |
| Handler divergence (V1 vs V2) | Inconsistent behavior | Run dual assertions in tests during migration |

## 15. Metrics & Validation
- % interactions with `matchContext` present (target >95% after migration).
- Avg fixture selection latency (target <= legacy ±2ms median on local bench for 500 ops, 100 fixtures).
- Number of ambiguous matches (confidence ties) — monitor; design doc update if >2%.
- Reduction in duplicated matching code lines (baseline vs post-cleanup >30% reduction).

## 16. Timeline (Indicative)
| Week | Deliverables |
|------|--------------|
| 1 | V2 types, adapter, router core, default scoring, consumer integration (flagged) |
| 2 | OpenAPI + GraphQL + AsyncAPI handler enhancements, recorder update, base tests |
| 3 | Hard enable router (remove flag), cleanup legacy, expand tests, publish migration notes |

## 17. Developer Workflow Changes
- New utility to debug matches: `ENTENTE_DEBUG_MATCH=1` logs candidate contexts + fixture scoring breakdown (optional follow-up).
- Fixture proposals (future) can embed `matchContext` enabling smarter server-side validation.

## 18. Open Questions
1. Do we need per-request dynamic state (e.g., time-based) influencing scoring? (Deferred)
2. Should recorder collapse matchContext into normalized canonical key for faster provider verification lookup? (Later design)
3. Is a global fixture cache (by operation → sorted fixtures) required now, or premature? (Start simple; evaluate benchmarks.)

## 19. Acceptance Criteria Checklist
- [ ] All new type definitions exported without breaking existing builds
- [ ] Router returns deterministic ordering & confidence scores
- [ ] Default scoring documented & test-covered (fixtures with higher source weight selected)
- [ ] Consumer mock server uses router for operation mapping
- [ ] Recorder includes `matchContext` (additive) and legacy fields intact
- [ ] GraphQL handler supplies variables + operationType + confidence rationale
- [ ] OpenAPI handler supplies pathParams + confidence tiers
- [ ] AsyncAPI handler supplies channelParams (if any)
- [ ] Legacy helpers only referenced by adapter or removed post-cleanup
- [ ] Test suite green across packages with router enabled

## 20. Release & Communication Plan
- Release 0.X.0: Introduce router (flagged) + docs (this file)
- Release 0.X.1: Enable router by default; deprecation warnings emit when legacy helpers used
- Release 0.X.2: Remove legacy helpers; publish migration summary in CHANGELOG

---
**Next Action**: Implement Task 1 (V2 Types) with adapter in fixtures package.
