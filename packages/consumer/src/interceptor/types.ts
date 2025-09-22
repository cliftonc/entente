import type { ClientInteraction, FixtureProposal, UnifiedRequest, UnifiedResponse } from '@entente/types'

export interface InterceptedCall {
  // Core request/response
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body: unknown
  }
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
  }

  // Operation matching (same as mock server)
  operation: string
  matchContext: {
    selectedOperationId: string
    candidates: Array<{
      operationId: string
      confidence: number
      reasons: string[]
    }>
    confidence?: number
  }

  // Timing and environment
  duration: number
  timestamp: Date

  // Consumer context
  consumer: string
  consumerVersion: string
  environment: string
}

export interface InterceptOptions {
  // Recording options
  recording?: boolean

  // Optional URL filter
  filter?: (url: string) => boolean
}

export interface RequestInterceptor {
  // Manual control
  unpatch(): Promise<void>
  isPatched(): boolean

  // Inspection
  getInterceptedCalls(): InterceptedCall[]
  getRecordedInteractions(): ClientInteraction[]

  // Statistics
  getStats(): {
    fetch: number
    http: number
    total: number
  }

  // Symbol.dispose for using statement
  [Symbol.dispose](): void
}