import type {
  APIOperation,
  APISpec,
  Fixture,
  FixtureSelectionResult,
  OperationMatchCandidate,
  OperationMatchContext,
  OperationMatchResult,
  SpecType,
  UnifiedRequest,
  UnifiedResponse,
  ValidationError,
  ValidationResult,
} from '@entente/types'

// Helper functions available to all handlers
export const generateOperationId = (prefix: string, name: string): string => {
  return `${prefix}.${name}`
}

export const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value
  }
  return normalized
}

export const parseContentType = (contentType: string): { type: string; charset?: string } => {
  const [type, ...params] = contentType.split(';').map(s => s.trim())
  const charset = params.find(p => p.startsWith('charset='))?.split('=')[1]

  return { type: type.toLowerCase(), charset }
}

export const createValidationError = (
  path: string,
  message: string,
  expected?: any,
  actual?: any,
  code?: string
): ValidationResult => {
  return {
    valid: false,
    errors: [
      {
        path,
        message,
        expected,
        actual,
        code,
      },
    ],
  }
}

export const createValidationSuccess = (): ValidationResult => {
  return {
    valid: true,
    errors: [],
  }
}

export const combineValidationResults = (results: ValidationResult[]): ValidationResult => {
  const allErrors = results.flatMap(r => r.errors)
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  }
}

// Higher-order function to create a spec handler with V2 interface
export const createSpecHandler = (config: {
  type: SpecType
  name: string
  canHandle: (spec: any) => boolean
  parseSpec: (spec: any) => APISpec
  extractOperations: (spec: APISpec) => APIOperation[]
  matchOperation: (ctx: OperationMatchContext) => OperationMatchResult
  generateResponse: (params: {
    operation: APIOperation
    fixtures: Fixture[]
    request: UnifiedRequest
    match: OperationMatchCandidate
    fixtureSelection?: FixtureSelectionResult
  }) => UnifiedResponse
  scoreFixtures?: (params: {
    operation: APIOperation
    fixtures: Fixture[]
    request: UnifiedRequest
    match: OperationMatchCandidate
  }) => FixtureSelectionResult
  validateResponse: (operation: APIOperation, expected: any, actual: any) => ValidationResult
  generateMockData: (operation: APIOperation) => any
  getRequestSchema: (operation: APIOperation) => any
  getResponseSchema: (operation: APIOperation) => any
}) => config

// Type guard functions
export const isHTTPRequest = (request: UnifiedRequest): boolean => {
  return !!(request.method && request.path)
}

export const isGraphQLRequest = (request: UnifiedRequest): boolean => {
  return !!(
    request.body &&
    typeof request.body === 'object' &&
    ('query' in request.body || 'mutation' in request.body)
  )
}

export const isEventRequest = (request: UnifiedRequest): boolean => {
  return !!(request.channel && request.eventType)
}

export const isRPCRequest = (request: UnifiedRequest): boolean => {
  return !!(request.service && request.procedure)
}
