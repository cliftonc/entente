import type {
  APIOperation,
  APISpec,
  EntityData,
  EntityRelationship,
  Fixture,
  FixtureSelectionResult,
  GraphQLSchema as GraphQLSchemaType,
  LocalMockData,
  OperationMatchCandidate,
  OperationMatchContext,
  OperationMatchResult,
  SpecHandler,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
} from '@entente/types'
import { debugLog } from '@entente/types'
import {
  DocumentNode,
  FieldNode,
  type GraphQLField,
  type GraphQLObjectType,
  GraphQLSchema,
  type OperationDefinitionNode,
  SelectionNode,
  buildClientSchema,
  buildSchema,
  introspectionFromSchema,
  isListType,
  isNonNullType,
  isObjectType,
  parse,
  printSchema,
} from 'graphql'
import {
  createSpecHandler,
  createValidationError,
  createValidationSuccess,
  generateOperationId,
  isGraphQLRequest,
} from './types.js'

// Pure function to check if spec is GraphQL
export const canHandleGraphQL = (spec: any): boolean => {
  // Check if it's GraphQL SDL (Schema Definition Language)
  if (typeof spec === 'string') {
    try {
      parse(spec)
      return true
    } catch {
      return false
    }
  }

  // Check if it's GraphQL introspection result
  if (spec && typeof spec === 'object' && spec.__schema) {
    return true
  }

  // Check if it's our GraphQLSchema type
  if (spec && typeof spec === 'object' && spec.schema && typeof spec.schema === 'string') {
    return true
  }

  return false
}

// Pure function to parse GraphQL spec
export const parseGraphQLSpec = (spec: any): APISpec => {
  let schema: string
  let introspection: any

  if (typeof spec === 'string') {
    // SDL string
    schema = spec
    const gqlSchema = buildSchema(spec)
    introspection = introspectionFromSchema(gqlSchema)
  } else if (spec.__schema) {
    // Introspection result
    introspection = spec
    const gqlSchema = buildClientSchema(spec)
    schema = printSchema(gqlSchema)
  } else if (spec.schema) {
    // Our GraphQLSchema type
    schema = spec.schema
    introspection = spec.introspection || introspectionFromSchema(buildSchema(spec.schema))
  } else {
    throw new Error('Invalid GraphQL spec format')
  }

  return {
    type: 'graphql',
    version: '1.0', // GraphQL doesn't have versions like OpenAPI
    spec: { schema, introspection } as GraphQLSchemaType,
  }
}

// Pure function to extract operations from GraphQL schema
export const extractGraphQLOperations = (spec: APISpec): APIOperation[] => {
  const graphqlSpec = spec.spec as GraphQLSchemaType
  const operations: APIOperation[] = []

  try {
    const schema = buildSchema(graphqlSpec.schema)

    // Extract queries
    const queryType = schema.getQueryType()
    if (queryType) {
      const queryOperations = extractOperationsFromType(queryType, 'query')
      operations.push(...queryOperations)
    }

    // Extract mutations
    const mutationType = schema.getMutationType()
    if (mutationType) {
      const mutationOperations = extractOperationsFromType(mutationType, 'mutation')
      operations.push(...mutationOperations)
    }

    // Extract subscriptions
    const subscriptionType = schema.getSubscriptionType()
    if (subscriptionType) {
      const subscriptionOperations = extractOperationsFromType(subscriptionType, 'subscription')
      operations.push(...subscriptionOperations)
    }
  } catch (error) {
    console.error('Error extracting GraphQL operations:', error)
  }

  return operations
}


// Pure function to validate GraphQL response
export const validateGraphQLResponse = (
  operation: APIOperation,
  expected: any,
  actual: any
): ValidationResult => {
  if (!actual) {
    return createValidationError('response', 'Response is null or undefined', expected, actual)
  }

  // GraphQL responses should have a data field
  if (!('data' in actual)) {
    return createValidationError(
      'response.data',
      'GraphQL response must have a data field',
      { data: expected },
      actual
    )
  }

  // If there are errors, they should be in the errors array
  if (actual.errors && !Array.isArray(actual.errors)) {
    return createValidationError(
      'response.errors',
      'GraphQL errors must be an array',
      [],
      actual.errors
    )
  }

  return createValidationSuccess()
}

// Pure function to generate mock data for GraphQL operation
export const generateGraphQLMockData = (operation: APIOperation): any => {
  const operationType = operation.type
  const fieldName = operation.id.split('.')[1]

  // Generate mock data based on operation
  if (operationType === 'query') {
    if (fieldName.startsWith('list')) {
      return [{ id: 'mock-id', name: 'Mock Item' }]
    } else if (fieldName.startsWith('get')) {
      return { id: 'mock-id', name: 'Mock Item' }
    }
  } else if (operationType === 'mutation') {
    if (fieldName.startsWith('create')) {
      return {
        [fieldName.replace('create', '').toLowerCase()]: { id: 'mock-id', name: 'Created Item' },
        errors: [],
      }
    } else if (fieldName.startsWith('delete')) {
      return {
        success: true,
        errors: [],
      }
    }
  }

  return null
}

// Pure function to get request schema (GraphQL doesn't have explicit request schemas)
export const getGraphQLRequestSchema = (operation: APIOperation): any => {
  return operation.request?.schema || null
}

// Pure function to get response schema
export const getGraphQLResponseSchema = (operation: APIOperation): any => {
  return operation.response?.schema || null
}

// Helper functions (pure)
const extractOperationsFromType = (
  type: GraphQLObjectType,
  operationType: 'query' | 'mutation' | 'subscription'
): APIOperation[] => {
  const operations: APIOperation[] = []
  const fields = type.getFields()

  for (const [fieldName, field] of Object.entries(fields)) {
    const operation: APIOperation = {
      id: generateOperationId(
        operationType === 'query'
          ? 'Query'
          : operationType === 'mutation'
            ? 'Mutation'
            : 'Subscription',
        fieldName
      ),
      type: operationType,
      description: field.description || undefined,
      request: extractGraphQLFieldRequestSchema(field),
      response: extractGraphQLFieldResponseSchema(field),
    }

    operations.push(operation)
  }

  return operations
}

const extractGraphQLFieldRequestSchema = (field: GraphQLField<any, any>): any => {
  if (field.args.length === 0) {
    return null
  }

  const requestSchema: any = {
    type: 'object',
    properties: {},
  }

  for (const arg of field.args) {
    requestSchema.properties[arg.name] = {
      type: getGraphQLTypeString(arg.type),
      description: arg.description,
    }
  }

  return requestSchema
}

const extractGraphQLFieldResponseSchema = (field: GraphQLField<any, any>): any => {
  return {
    type: getGraphQLTypeString(field.type),
    description: field.description,
  }
}

const getGraphQLTypeString = (type: any): string => {
  if (isNonNullType(type)) {
    return getGraphQLTypeString(type.ofType)
  }
  if (isListType(type)) {
    return 'array'
  }
  if (isObjectType(type)) {
    return 'object'
  }

  // Handle scalar types
  const typeName = type.name
  switch (typeName) {
    case 'String':
      return 'string'
    case 'Int':
      return 'integer'
    case 'Float':
      return 'number'
    case 'Boolean':
      return 'boolean'
    case 'ID':
      return 'string'
    default:
      return 'object'
  }
}

const isGraphQLRequestPath = (request: UnifiedRequest): boolean => {
  return request.path === '/graphql' || (request.path?.endsWith('/graphql') ?? false)
}

const isIntrospectionQuery = (operation: OperationDefinitionNode): boolean => {
  const selections = operation.selectionSet.selections

  for (const selection of selections) {
    if (selection.kind === 'Field' && selection.name.value === '__schema') {
      return true
    }
  }

  return false
}

const createIntrospectionOperation = (): APIOperation => ({
  id: '__introspection',
  type: 'query',
  description: 'GraphQL introspection query',
})

const generateIntrospectionResponse = (operation: APIOperation): UnifiedResponse => {
  // This would return the full schema introspection
  // For now, return a basic response
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      data: {
        __schema: {
          types: [],
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          subscriptionType: null,
        },
      },
    },
    success: true,
  }
}

const findBestGraphQLFixture = (
  operation: APIOperation,
  fixtures: Fixture[],
  request?: UnifiedRequest
): Fixture | null => {
  debugLog(`🔍 [GraphQL] Looking for fixture for operation: ${operation.id}`)
  debugLog(`🔍 [GraphQL] Available fixtures: ${fixtures.length}`)

  // Find fixtures that match both operation and specType for isolation
  const matchingFixtures = fixtures.filter(
    f => f.operation === operation.id && f.specType === 'graphql'
  )

  debugLog(`🔍 [GraphQL] Found ${matchingFixtures.length} matching fixtures for operation ${operation.id}`)
  matchingFixtures.forEach((f, i) => {
    debugLog(`  ${i}: ${f.id} (operation: ${f.operation}, priority: ${f.priority})`)
  })

  if (matchingFixtures.length === 0) {
    debugLog(`❌ [GraphQL] No matching fixtures found for operation: ${operation.id}`)
    return null
  }

  // If we have request data, try to find a fixture that matches the variables
  if (request?.body && typeof request.body === 'object') {
    const requestBody = request.body as any
    const requestVariables = requestBody.variables || {}
    debugLog(`🔍 [GraphQL] Request variables:`, JSON.stringify(requestVariables, null, 2))

    // Try to find a fixture with matching variables
    for (const fixture of matchingFixtures) {
      const fixtureRequestData = fixture.data?.request as any
      const fixtureVariables = fixtureRequestData?.body?.variables || {}
      debugLog(`🔍 [GraphQL] Checking fixture ${fixture.id}:`)
      debugLog(`  - Fixture variables:`, JSON.stringify(fixtureVariables, null, 2))
      debugLog(`  - Full fixture request data:`, JSON.stringify(fixtureRequestData, null, 2))

      // Check if variables match
      const variablesMatch = Object.keys(requestVariables).every(
        key => {
          const match = fixtureVariables[key] === requestVariables[key]
          debugLog(`  - Variable ${key}: request=${requestVariables[key]}, fixture=${fixtureVariables[key]}, match=${match}`)
          return match
        }
      )

      if (variablesMatch) {
        debugLog(`✅ [GraphQL] Found matching fixture: ${fixture.id}`)
        return fixture
      }
    }
    debugLog(`⚠️ [GraphQL] No variable match found, using highest priority fixture`)
  }

  // Return highest priority fixture if no variable match found
  const sortedFixtures = matchingFixtures.sort((a, b) => {
    // Provider fixtures have higher priority than consumer fixtures
    if (a.source !== b.source) {
      const sourceOrder = { provider: 3, manual: 2, consumer: 1 }
      return sourceOrder[b.source] - sourceOrder[a.source]
    }

    return b.priority - a.priority
  })

  const selectedFixture = sortedFixtures[0]
  debugLog(`🎯 [GraphQL] Selected fixture: ${selectedFixture.id} (priority: ${selectedFixture.priority})`)
  return selectedFixture
}


// Pure function to convert GraphQL mock data to fixtures
export const convertGraphQLMockDataToFixtures = (
  mockData: any,
  service: string,
  version: string
): Fixture[] => {
  debugLog(`🏗️ [GraphQL] Converting mock data to fixtures for ${service}@${version}`)
  debugLog(`🏗️ [GraphQL] Mock data operations:`, Object.keys(mockData))

  const fixtures: Fixture[] = []
  let fixtureId = 1

  for (const [operationId, scenarios] of Object.entries(mockData)) {
    debugLog(`🏗️ [GraphQL] Processing operation: ${operationId}`)
    debugLog(`🏗️ [GraphQL] Scenarios:`, Object.keys(scenarios as any))

    for (const [scenarioName, mockResponse] of Object.entries(scenarios as any)) {
      const response = mockResponse as any

      // Extract the actual GraphQL response data
      const graphqlResponseData = response.response || response

      // Generate operation ID in the same format as request matching
      const operationIdForFixture = generateOperationId('Query', operationId)

      debugLog(`🏗️ [GraphQL] Creating fixture for ${operationId}.${scenarioName}`)
      debugLog(`🏗️ [GraphQL] Operation ID for fixture: ${operationIdForFixture}`)
      debugLog(`🏗️ [GraphQL] Mock response data:`, JSON.stringify(response, null, 2))

      const requestData = generateGraphQLRequestData(operationId, response)
      debugLog(`🏗️ [GraphQL] Generated request data:`, JSON.stringify(requestData, null, 2))

      const fixture: Fixture = {
        id: `local_${fixtureId++}`,
        service,
        serviceVersion: version,
        serviceVersions: [version],
        specType: 'graphql',
        operation: operationIdForFixture,
        status: 'approved',
        source: 'manual',
        priority: scenarioName === 'success' || scenarioName === 'default' ? 1 : 2,
        data: {
          request: requestData,
          response: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: graphqlResponseData,
          },
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'local-mock-data',
        },
        createdAt: new Date(),
        notes: `GraphQL mock data for ${operationId} - ${scenarioName}`,
      }
      debugLog(`✅ [GraphQL] Created fixture: ${fixture.id} for operation ${fixture.operation}`)
      fixtures.push(fixture)
    }
  }

  debugLog(`🏗️ [GraphQL] Created ${fixtures.length} fixtures total`)
  return fixtures
}

// Pure function to generate GraphQL request data from mock response
const generateGraphQLRequestData = (operationId: string, mockResponse: any): any => {
  const response = mockResponse as any

  // Extract variables from the mock response if available
  const variables = response.variables || {}

  // Generate the GraphQL query/mutation based on operation ID
  const query = response.query || generateDefaultGraphQLQuery(operationId, variables)

  return {
    method: 'POST',
    path: '/graphql',
    headers: { 'content-type': 'application/json' },
    query: {},
    body: {
      query,
      variables,
    },
  }
}

// V2 Methods: Rich operation matching with confidence scoring for GraphQL
export const matchGraphQLOperation = (ctx: OperationMatchContext): OperationMatchResult => {
  const { request, operations } = ctx
  const candidates: OperationMatchCandidate[] = []

  // GraphQL requests should go to /graphql endpoint or have GraphQL body
  if (!isGraphQLRequestPath(request) && !isGraphQLRequest(request)) {
    return { candidates: [], selected: null }
  }

  const body = request.body as any
  if (!body || !body.query) {
    return { candidates: [], selected: null }
  }

  try {
    // Parse the GraphQL query to find operation
    const document = parse(body.query)
    const operation = document.definitions.find(
      (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
    )

    if (!operation) {
      return { candidates: [], selected: null }
    }

    // Handle introspection queries
    if (isIntrospectionQuery(operation)) {
      const introspectionOp = createIntrospectionOperation()
      const candidate: OperationMatchCandidate = {
        operation: introspectionOp,
        confidence: 1.0,
        reasons: ['Introspection query detected'],
        metrics: { introspectionScore: 1.0 },
        parameters: {}
      }
      return { candidates: [candidate], selected: candidate }
    }

    const operationType = operation.operation // 'query', 'mutation', or 'subscription'
    const selections = operation.selectionSet.selections
    const variables = body.variables || {}

    // Find matching operations for each field in the selection
    for (const selection of selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value
        const operationId = generateOperationId(
          operationType === 'query'
            ? 'Query'
            : operationType === 'mutation'
              ? 'Mutation'
              : 'Subscription',
          fieldName
        )

        const matchedOp = operations.find(op => op.id === operationId)
        if (matchedOp) {
          const candidate = evaluateGraphQLOperationMatch(
            matchedOp,
            operationType,
            fieldName,
            variables,
            operation
          )
          candidates.push(candidate)
        }
      }
    }
  } catch (error) {
    console.error('Error parsing GraphQL query:', error)
    return { candidates: [], selected: null }
  }

  // Sort by confidence (highest first)
  candidates.sort((a, b) => b.confidence - a.confidence)

  return {
    candidates,
    selected: candidates.length > 0 ? candidates[0] : null
  }
}

// Evaluate how well a GraphQL operation matches
const evaluateGraphQLOperationMatch = (
  operation: APIOperation,
  operationType: string,
  fieldName: string,
  variables: Record<string, unknown>,
  parsedOperation: OperationDefinitionNode
): OperationMatchCandidate => {
  const reasons: string[] = []
  const metrics: Record<string, number> = {}
  let confidence = 0.8 // Base confidence for GraphQL matches

  // Operation type matching
  if (operation.type === operationType) {
    confidence += 0.15
    reasons.push(`Operation type matches: ${operationType}`)
    metrics.operationTypeScore = 1
  }

  // Field name matching
  if (operation.id.endsWith(fieldName)) {
    confidence += 0.05
    reasons.push(`Field name matches: ${fieldName}`)
    metrics.fieldNameScore = 1
  }

  // Check if operation has a name
  if (parsedOperation.name?.value) {
    reasons.push(`Named operation: ${parsedOperation.name.value}`)
    metrics.namedOperation = 1
  }

  // Extract selection info for richer context
  const selectionInfo = extractSelectionInfo(parsedOperation.selectionSet.selections)

  return {
    operation,
    confidence: Math.min(confidence, 1), // Cap at 1.0
    reasons,
    metrics,
    parameters: {
      variables,
      operationType,
      fieldName,
      operationName: parsedOperation.name?.value,
      ...selectionInfo
    }
  }
}

// Extract information about GraphQL selections
const extractSelectionInfo = (selections: readonly SelectionNode[]): Record<string, unknown> => {
  const info: Record<string, unknown> = {}
  const fields: string[] = []

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      fields.push(selection.name.value)

      // Extract arguments if present
      if (selection.arguments && selection.arguments.length > 0) {
        const args: Record<string, unknown> = {}
        for (const arg of selection.arguments) {
          if (arg.value.kind === 'Variable') {
            args[arg.name.value] = `$${arg.value.name.value}`
          }
          // Add more argument value types as needed
        }
        info.arguments = args
      }
    }
  }

  info.requestedFields = fields
  return info
}

// V2 Methods: Response generation with fixture selection context for GraphQL
export const generateGraphQLResponseV2 = (params: {
  operation: APIOperation
  fixtures: Fixture[]
  request: UnifiedRequest
  match: OperationMatchCandidate
  fixtureSelection?: FixtureSelectionResult
}): UnifiedResponse => {
  const { operation, fixtures, request, match, fixtureSelection } = params

  debugLog(`🔥🔥🔥 [GraphQL] GENERATE RESPONSE CALLED for operation: ${operation.id} 🔥🔥🔥`)
  debugLog(`🎯 [GraphQL] Generating response for operation: ${operation.id}`)
  debugLog(`🎯 [GraphQL] Available fixtures: ${fixtures.length}`)
  debugLog(`🎯 [GraphQL] Fixture selection result:`, fixtureSelection)

  // Handle introspection queries
  if (operation.id === '__introspection') {
    return generateIntrospectionResponse(operation)
  }

  // Use selected fixture if available
  if (fixtureSelection?.selected) {
    const fixture = fixtures.find(f => f.id === fixtureSelection.selected!.fixtureId)
    debugLog(`✅ [GraphQL] Using selected fixture: ${fixtureSelection.selected.fixtureId}`)
    if (fixture && fixture.data.response) {
      const responseData = fixture.data.response as any
      const responseBody = responseData.body || responseData

      return {
        status: responseData.status || 200,
        headers: { 'content-type': 'application/json' },
        body: responseBody,
        success: true,
      }
    }
  }

  // Find the best matching fixture directly (no fallback to old method)
  debugLog(`🔍 [GraphQL] No fixture selection, finding best match for ${operation.id}`)
  const matchingFixtures = fixtures.filter(
    f => f.operation === operation.id && f.specType === 'graphql'
  )
  debugLog(`🔍 [GraphQL] Found ${matchingFixtures.length} matching fixtures`)

  let selectedFixture: Fixture | null = null

  // If we have request data, try to find a fixture that matches the variables
  if (request?.body && typeof request.body === 'object') {
    const requestBody = request.body as any
    const requestVariables = requestBody.variables || {}
    debugLog(`🔍 [GraphQL] Request variables:`, JSON.stringify(requestVariables, null, 2))

    // Try to find a fixture with matching variables
    for (const fixture of matchingFixtures) {
      const fixtureRequestData = fixture.data?.request as any
      const fixtureVariables = fixtureRequestData?.body?.variables || {}
      debugLog(`🔍 [GraphQL] Checking fixture ${fixture.id}:`)
      debugLog(`  - Fixture variables:`, JSON.stringify(fixtureVariables, null, 2))

      // Check if variables match
      const variablesMatch = Object.keys(requestVariables).every(
        key => {
          const match = fixtureVariables[key] === requestVariables[key]
          debugLog(`  - Variable ${key}: request=${requestVariables[key]}, fixture=${fixtureVariables[key]}, match=${match}`)
          return match
        }
      )

      if (variablesMatch) {
        debugLog(`✅ [GraphQL] Found matching fixture: ${fixture.id}`)
        selectedFixture = fixture
        break
      }
    }

    if (!selectedFixture) {
      debugLog(`⚠️ [GraphQL] No variable match found, using highest priority fixture`)
    }
  }

  // If no variable match, use highest priority fixture
  if (!selectedFixture && matchingFixtures.length > 0) {
    const sortedFixtures = matchingFixtures.sort((a, b) => {
      // Provider fixtures have higher priority than consumer fixtures
      if (a.source !== b.source) {
        const sourceOrder = { provider: 3, manual: 2, consumer: 1 }
        return sourceOrder[b.source] - sourceOrder[a.source]
      }
      return b.priority - a.priority
    })
    selectedFixture = sortedFixtures[0]
    debugLog(`🎯 [GraphQL] Selected highest priority fixture: ${selectedFixture.id}`)
  }

  if (selectedFixture) {
    const responseData = selectedFixture.data.response as any
    const responseBody = responseData.body || responseData

    return {
      status: responseData.status || 200,
      headers: { 'content-type': 'application/json' },
      body: responseBody,
      success: true,
    }
  }

  // Generate mock response using extracted parameters
  debugLog(`🚫 [GraphQL] No fixtures found, generating mock response`)
  return generateMockGraphQLResponseV2(operation, match.parameters || {})
}

// Enhanced GraphQL mock response generation with parameter context
const generateMockGraphQLResponseV2 = (
  operation: APIOperation,
  parameters: Record<string, unknown>
): UnifiedResponse => {
  const operationType = operation.type
  const fieldName = parameters.fieldName as string || operation.id.split('.')[1] || 'unknown'
  const variables = parameters.variables as Record<string, unknown> || {}

  let mockData: any = null

  // Generate mock data based on operation and parameters
  if (operationType === 'query') {
    if (fieldName.startsWith('list') || fieldName.includes('sByCategory')) {
      mockData = [
        { id: 'mock-id-1', name: 'Mock Item 1', ...variables },
        { id: 'mock-id-2', name: 'Mock Item 2', ...variables }
      ]
    } else if (fieldName.startsWith('get')) {
      const id = Object.values(variables)[0] || 'mock-id'
      mockData = { id, name: 'Mock Item', ...variables }
    } else {
      mockData = { id: 'mock-id', name: 'Mock Item', ...variables }
    }
  } else if (operationType === 'mutation') {
    if (fieldName.startsWith('create')) {
      mockData = {
        [fieldName.replace('create', '').toLowerCase()]: {
          id: 'mock-created-id',
          name: 'Created Item',
          ...variables
        },
        errors: [],
      }
    } else if (fieldName.startsWith('update')) {
      mockData = {
        [fieldName.replace('update', '').toLowerCase()]: {
          id: Object.values(variables)[0] || 'mock-id',
          name: 'Updated Item',
          ...variables
        },
        errors: [],
      }
    } else if (fieldName.startsWith('delete')) {
      mockData = {
        success: true,
        errors: [],
      }
    } else {
      mockData = { success: true, errors: [] }
    }
  } else if (operationType === 'subscription') {
    mockData = { id: 'mock-subscription-id', data: variables }
  }

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: {
      data: {
        [fieldName]: mockData
      }
    },
    success: true,
  }
}

// Pure function to generate default GraphQL query for operation
// GraphQL-specific entity extraction functions
export const inferGraphQLEntityType = (operation: string): string | null => {
  debugLog('🎯 GraphQL inferEntityType called with operation:', operation)

  // Handle GraphQL operations (Query.getRulersByCastle, Mutation.createRuler, etc)
  if (operation.includes('.')) {
    const [operationType, fieldName] = operation.split('.')

    if (['Query', 'Mutation', 'Subscription'].includes(operationType) && fieldName) {
      // Extract entity name from GraphQL field name
      let entityName = fieldName

      // Strip common prefixes
      const prefixes = ['get', 'list', 'create', 'update', 'delete', 'find', 'search']
      for (const prefix of prefixes) {
        if (fieldName.toLowerCase().startsWith(prefix)) {
          entityName = fieldName.slice(prefix.length)
          break
        }
      }

      // Handle special cases like getRulersByCastle -> Ruler
      if (entityName.includes('By')) {
        entityName = entityName.split('By')[0]
      }

      // Convert plural to singular and capitalize
      if (entityName.endsWith('s') && entityName.length > 1) {
        entityName = entityName.slice(0, -1)
      }

      const result = entityName.charAt(0).toUpperCase() + entityName.slice(1)
      debugLog('✅ GraphQL entity type extracted:', result)
      return result
    }
  }

  // Handle GraphQL operations without Query. prefix (GetRulersByCastle, ListRulers, etc)
  const methodPrefixes = ['get', 'create', 'update', 'delete', 'list', 'find', 'search']
  let entityName = operation

  for (const prefix of methodPrefixes) {
    if (operation.toLowerCase().startsWith(prefix)) {
      entityName = operation.slice(prefix.length)
      break
    }
  }

  if (!entityName) {
    debugLog('❌ No entity name found for operation:', operation)
    return null
  }

  // Handle special cases like getRulersByCastle -> Ruler (for both REST and GraphQL)
  if (entityName.includes('By')) {
    entityName = entityName.split('By')[0]
  }

  // Capitalize first letter and return singular form
  const capitalized = entityName.charAt(0).toUpperCase() + entityName.slice(1)

  // Convert plural to singular
  const result =
    capitalized.endsWith('s') && capitalized.length > 1 ? capitalized.slice(0, -1) : capitalized

  debugLog('✅ GraphQL entity type extracted (no prefix):', result)
  return result
}

export const extractGraphQLEntitiesFromFixture = (
  fixture: Fixture
): {
  entities: EntityData[]
  relationships: EntityRelationship[]
} => {
  const entities: EntityData[] = []
  const relationships: EntityRelationship[] = []

  debugLog('🔧 GraphQL Processing fixture:', fixture.operation, 'specType:', fixture.specType)
  debugLog('🔧 GraphQL Fixture data:', JSON.stringify(fixture.data, null, 2))

  const entityType = inferGraphQLEntityType(fixture.operation)
  debugLog('📋 GraphQL Inferred entity type:', entityType, 'for operation:', fixture.operation)

  if (!entityType) {
    debugLog('❌ No entity type could be inferred for operation:', fixture.operation)
    return { entities, relationships }
  }

  // For GraphQL, we don't extract entities from request data
  // (GraphQL requests contain queries/mutations, not entity data)
  // We only extract from response data below

  // Extract entity from response data (for read operations or successful creates)
  if (fixture.data.response && typeof fixture.data.response === 'object') {
    const responseData = fixture.data.response as Record<string, unknown>

    // Handle GraphQL responses - check for both responseData.data and responseData.body.data
    const graphqlResponseData = responseData.data || (responseData.body as any)?.data
    if (graphqlResponseData) {
      debugLog('🔍 Processing GraphQL fixture:', fixture.operation)

      // Extract operation name from fixture.operation (e.g., "Query.getRulersByCastle" -> "getRulersByCastle")
      const operationName = fixture.operation.includes('.')
        ? fixture.operation.split('.')[1]
        : fixture.operation

      const graphqlData = graphqlResponseData as Record<string, unknown>
      const operationData = graphqlData[operationName]

      debugLog(`🎯 Looking for operation "${operationName}" in GraphQL response`)
      debugLog('📦 Available operations:', Object.keys(graphqlData))
      debugLog('🔍 Operation data:', operationData)
      debugLog('🔍 Full GraphQL response data:', JSON.stringify(responseData, null, 2))

      if (operationData) {
        // Determine operation type based on GraphQL operation name
        const operationType = inferOperationType(operationName)
        debugLog(`🎯 Inferred operation type: ${operationType} for operation: ${operationName}`)

        if (Array.isArray(operationData)) {
          // Multiple entities (e.g., listRulers, getRulersByCastle)
          debugLog(`📋 Found ${operationData.length} entities in array`)
          for (const item of operationData) {
            debugLog(`🔍 Processing array item:`, JSON.stringify(item, null, 2))
            const entity = extractEntityFromData(item, entityType, operationType, fixture.operation)
            if (entity) {
              debugLog(`✅ Extracted entity:`, entity)
              entities.push(entity)
            } else {
              debugLog(`❌ Failed to extract entity from item:`, item)
            }
          }
        } else if (typeof operationData === 'object' && operationData !== null) {
          // Single entity (e.g., getRuler)
          debugLog('📄 Found single entity')
          debugLog(`🔍 Processing single item:`, JSON.stringify(operationData, null, 2))
          const entity = extractEntityFromData(
            operationData,
            entityType,
            operationType,
            fixture.operation
          )
          if (entity) {
            debugLog(`✅ Extracted entity:`, entity)
            entities.push(entity)
          } else {
            debugLog(`❌ Failed to extract entity from single item:`, operationData)
          }
        }
      } else {
        debugLog('❌ No operation data found for:', operationName)
      }
    }
  }

  return { entities, relationships }
}

// Helper function to infer operation type from GraphQL operation name
const inferOperationType = (operationName: string): 'create' | 'update' | 'delete' => {
  debugLog('🔍 Inferring operation type for:', operationName)

  const lowerName = operationName.toLowerCase()

  // Check for update operations
  if (lowerName.startsWith('update') ||
      lowerName.startsWith('edit') ||
      lowerName.startsWith('modify') ||
      lowerName.startsWith('patch') ||
      lowerName.includes('update')) {
    debugLog('✅ Identified as update operation')
    return 'update'
  }

  // Check for delete operations
  if (lowerName.startsWith('delete') ||
      lowerName.startsWith('remove') ||
      lowerName.startsWith('destroy') ||
      lowerName.includes('delete')) {
    debugLog('✅ Identified as delete operation')
    return 'delete'
  }

  // Default to create for all other operations (including queries)
  debugLog('✅ Defaulting to create operation')
  return 'create'
}

const extractEntityFromData = (
  data: unknown,
  entityType: string,
  operation: 'create' | 'update' | 'delete',
  source: string
): EntityData | null => {
  debugLog('🔍 extractEntityFromData called with:', { data, entityType, operation, source })

  if (!data || typeof data !== 'object') {
    debugLog('❌ Data is not an object:', typeof data)
    return null
  }

  const record = data as Record<string, unknown>
  debugLog('🔍 Record keys:', Object.keys(record))
  debugLog('🔍 Record.id:', record.id)

  // Must have an ID field
  if (!record.id) {
    debugLog('❌ No ID field found in record')
    return null
  }

  const entity = {
    id: String(record.id),
    type: entityType,
    data: record,
    operation,
    source,
  }

  debugLog('✅ Created entity:', entity)
  return entity
}

const generateDefaultGraphQLQuery = (operationId: string, variables: any): string => {
  const variablesStr =
    Object.keys(variables).length > 0
      ? `(${Object.keys(variables)
          .map(key => `$${key}: ${getVariableType(variables[key])}`)
          .join(', ')})`
      : ''

  const argsStr =
    Object.keys(variables).length > 0
      ? `(${Object.keys(variables)
          .map(key => `${key}: $${key}`)
          .join(', ')})`
      : ''

  return `query ${operationId}${variablesStr} { ${operationId}${argsStr} }`
}

// Pure function to get GraphQL variable type from value
const getVariableType = (value: any): string => {
  if (typeof value === 'string') return 'String'
  if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Float'
  if (typeof value === 'boolean') return 'Boolean'
  if (Array.isArray(value)) return '[String]'
  return 'String'
}

// Pure function to extract GraphQL operation name from request body
export const extractGraphQLOperationName = (requestBody: any): string => {
  if (!requestBody) {
    return 'unknown'
  }

  try {
    const body = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody

    // First try to get operationName from the request body
    if (body.operationName && typeof body.operationName === 'string') {
      return body.operationName
    }

    // If no operationName, try to parse it from the query
    if (body.query && typeof body.query === 'string') {
      const document = parse(body.query)
      const operationDefinition = document.definitions.find(
        def => def.kind === 'OperationDefinition'
      ) as any

      if (operationDefinition?.name?.value) {
        return operationDefinition.name.value
      }

      // If no operation name, try to extract the first field name from the selection
      if (operationDefinition?.selectionSet?.selections?.[0]?.name?.value) {
        return operationDefinition.selectionSet.selections[0].name.value
      }
    }
  } catch (error) {
    console.warn('Failed to parse GraphQL operation:', error)
  }

  return 'unknown'
}

// GraphQL-specific fixture scoring that considers variables
export const scoreGraphQLFixtures = (params: {
  fixtures: Fixture[]
  request: UnifiedRequest
  operation: APIOperation
  match: OperationMatchCandidate
}): FixtureSelectionResult => {
  const { fixtures, request, operation, match } = params

  debugLog(`🎯 [GraphQL] Scoring fixtures for operation: ${operation.id}`)
  debugLog(`🎯 [GraphQL] Available fixtures: ${fixtures.length}`)

  // Filter fixtures that match this operation and spec type
  const matchingFixtures = fixtures.filter(
    f => f.operation === operation.id && f.specType === 'graphql'
  )

  debugLog(`🎯 [GraphQL] Matching operation fixtures: ${matchingFixtures.length}`)

  if (matchingFixtures.length === 0) {
    return { ordered: [], selected: undefined }
  }

  // Get request variables for GraphQL variable matching
  const requestVariables = (request.body as any)?.variables || {}
  debugLog(`🎯 [GraphQL] Request variables:`, requestVariables)

  const scored = matchingFixtures.map(fixture => {
    let score = 0
    const reasons: string[] = []

    // Base score from source and priority
    switch (fixture.source) {
      case 'provider':
        score += 30
        reasons.push('source_provider')
        break
      case 'manual':
        score += 20
        reasons.push('source_manual')
        break
      case 'consumer':
        score += 10
        reasons.push('source_consumer')
        break
    }

    score += fixture.priority * 5
    reasons.push(`priority_${fixture.priority}`)

    // GraphQL variable matching - this is crucial
    const fixtureRequestData = fixture.data?.request as any
    const fixtureVariables = fixtureRequestData?.body?.variables || {}

    debugLog(`🎯 [GraphQL] Fixture ${fixture.id} variables:`, fixtureVariables)

    // Check if all request variables match fixture variables
    const variableMatchCount = Object.keys(requestVariables).filter(
      key => fixtureVariables[key] === requestVariables[key]
    ).length

    const totalVariables = Object.keys(requestVariables).length

    if (totalVariables > 0 && variableMatchCount === totalVariables) {
      score += 100 // Perfect variable match gets highest score
      reasons.push('variables_exact_match')
      debugLog(`✅ [GraphQL] Perfect variable match for fixture ${fixture.id}`)
    } else if (variableMatchCount > 0) {
      score += variableMatchCount * 20
      reasons.push(`variables_partial_match_${variableMatchCount}`)
      debugLog(`🔶 [GraphQL] Partial variable match for fixture ${fixture.id}: ${variableMatchCount}/${totalVariables}`)
    } else {
      debugLog(`❌ [GraphQL] No variable match for fixture ${fixture.id}`)
    }

    return {
      fixtureId: fixture.id,
      base: 0,
      priority: fixture.priority,
      sourceBias: score - fixture.priority * 5,
      specificity: variableMatchCount,
      total: score,
      reasons,
    }
  })

  // Sort by total score (highest first)
  scored.sort((a, b) => b.total - a.total)

  const selected = scored.length > 0 ? scored[0] : undefined
  debugLog(`🎯 [GraphQL] Selected fixture: ${selected?.fixtureId} (score: ${selected?.total})`)

  return { ordered: scored, selected }
}

// Create the GraphQL handler using the pure functions
export const createGraphQLHandler = (): SpecHandler => ({
  ...createSpecHandler({
    type: 'graphql',
    name: 'GraphQL',
    canHandle: canHandleGraphQL,
    parseSpec: parseGraphQLSpec,
    extractOperations: extractGraphQLOperations,
    matchOperation: matchGraphQLOperation,
    generateResponse: generateGraphQLResponseV2,
    validateResponse: validateGraphQLResponse,
    generateMockData: generateGraphQLMockData,
    getRequestSchema: getGraphQLRequestSchema,
    getResponseSchema: getGraphQLResponseSchema,
    scoreFixtures: scoreGraphQLFixtures,
  }),
  convertMockDataToFixtures: convertGraphQLMockDataToFixtures,
  extractEntitiesFromFixture: extractGraphQLEntitiesFromFixture,
  inferEntityType: inferGraphQLEntityType,
})
