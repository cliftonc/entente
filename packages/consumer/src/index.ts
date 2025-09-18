import { readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { resolve } from 'node:path'
import {
  createFixtureManager,
  extractOperationFromPath,
  extractOperationFromSpec,
  generateFixtureHash,
  generateInteractionHash,
  prioritizeFixtures,
  createOpenAPIMockHandler,
  handleMockRequest,
  type MockRequest as FixtureMockRequest,
  type MockResponse as FixtureMockResponse,
  type MockHandler
} from '@entente/fixtures'
import type {
  ClientConfig,
  ClientInteraction,
  Fixture,
  FixtureProposal,
  HTTPRequest,
  HTTPResponse,
  LocalMockData,
  MockOptions,
  OpenAPISpec,
} from '@entente/types'
import { getGitSha } from './git-utils.js'

export interface EntenteClient {
  createMock: (service: string, version: string, options?: MockOptions) => Promise<EntenteMock>
  uploadSpec: (
    service: string,
    version: string,
    spec: OpenAPISpec,
    metadata: {
      branch?: string
      environment: string
    }
  ) => Promise<void>
}

export interface EntenteMock {
  url: string
  port: number
  close: () => Promise<void>
  getFixtures: () => Fixture[]
  proposeFixture: (
    operation: string,
    data: { request?: unknown; response: unknown }
  ) => Promise<void>
}

interface FixtureCollector {
  collect: (operation: string, data: { request?: unknown; response: unknown }) => Promise<void>
  uploadCollected: () => Promise<void>
  getCollectedCount: () => number
}

export interface InteractionRecorder {
  record: (interaction: Omit<ClientInteraction, 'id' | 'timestamp' | 'clientInfo'>) => Promise<void>
  flush: () => Promise<void>
}

const getPackageInfo = (): { name: string; version: string } => {
  try {
    // Look for package.json starting from current working directory
    const packageJsonPath = resolve(process.cwd(), 'package.json')
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent)

    return {
      name: packageJson.name || 'unknown-service',
      version: packageJson.version || '0.0.0',
    }
  } catch (_error) {
    // Fallback if package.json can't be read
    return {
      name: 'unknown-service',
      version: '0.0.0',
    }
  }
}

export const createClient = (config: ClientConfig): EntenteClient => {
  // Get package info for fallbacks
  const packageInfo = getPackageInfo()

  // Create resolved config with fallbacks
  const resolvedConfig = {
    ...config,
    consumer: config.consumer || packageInfo.name,
    consumerVersion: config.consumerVersion || packageInfo.version,
  }

  // Check if we're using fallback values and warn user
  const usingFallbackName = !config.consumer && packageInfo.name === 'unknown-service'
  const usingFallbackVersion = !config.consumerVersion && packageInfo.version === '0.0.0'

  if (usingFallbackName || usingFallbackVersion) {
    console.warn(
      '⚠️  Entente client using fallback values - operations will be skipped. Please provide consumer name/version or ensure package.json exists.'
    )
    console.warn(`   Consumer: ${resolvedConfig.consumer}${usingFallbackName ? ' (fallback)' : ''}`)
    console.warn(
      `   Version: ${resolvedConfig.consumerVersion}${usingFallbackVersion ? ' (fallback)' : ''}`
    )
  }

  const fixtureManager = createFixtureManager(resolvedConfig.serviceUrl, resolvedConfig.apiKey)

  return {
    createMock: async (
      service: string,
      providerVersion: string,
      options?: MockOptions
    ): Promise<EntenteMock> => {
      // NOTE: This creates a mock for testing but does NOT register dependencies.
      // Dependencies should be registered at deployment time using the CLI:
      // entente deploy-consumer -n my-app -v 1.0.0 -e production -D order-service:2.1.0

      // Fetch OpenAPI spec from central service using provider deployment version
      const { spec, providerVersion: actualProviderVersion } = await fetchSpec(
        resolvedConfig.serviceUrl,
        resolvedConfig.apiKey,
        service,
        providerVersion,
        resolvedConfig.environment,
        options?.branch
      )

      // Fetch existing fixtures if requested
      let fixtures: Fixture[] = []
      if (options?.useFixtures !== false) {
        fixtures = await fetchFixtures(
          resolvedConfig.serviceUrl,
          resolvedConfig.apiKey,
          service,
          actualProviderVersion,
          options?.localFixtures,
          options?.localMockData
        )
      }

      // Convert LocalMockData to fixtures if provided
      let allFixtures = fixtures
      if (options?.localMockData && fixtures.length === 0) {
        console.log(
          `📋 Converting local mock data to fixtures for ${service}@${actualProviderVersion}`
        )
        const convertedFixtures = convertMockDataToFixtures(
          options.localMockData,
          service,
          actualProviderVersion,
          spec
        )
        allFixtures = prioritizeFixtures(convertedFixtures)
      }

      // Create mock server with fixture support
      const mockServer = await createMockServer({
        spec,
        fixtures: allFixtures,
        port: options?.port || 0,
        validateRequest: options?.validateRequests ?? true,
        validateResponse: options?.validateResponses ?? true,
      })

      // Set up recording if enabled and not using fallback values
      let recorder: InteractionRecorder | undefined
      if (resolvedConfig.recordingEnabled && !usingFallbackName && !usingFallbackVersion) {
        recorder = createInteractionRecorder(resolvedConfig)
      } else if (resolvedConfig.recordingEnabled && (usingFallbackName || usingFallbackVersion)) {
        console.log('🚫 Skipping interaction recording - consumer info unavailable')
      }

      return createEntenteMock({
        service,
        providerVersion: actualProviderVersion,
        mockServer,
        recorder,
        fixtures: allFixtures,
        fixtureManager,
        hasFixtures: allFixtures.length > 0,
        config: resolvedConfig, // Pass the resolved config for access to consumer info
        skipOperations: usingFallbackName || usingFallbackVersion, // Skip operations if using fallbacks
      })
    },

    uploadSpec: async (
      service: string,
      version: string,
      spec: OpenAPISpec,
      metadata: {
        branch?: string
        environment: string
      }
    ): Promise<void> => {
      // Skip upload if using fallback values
      if (usingFallbackName || usingFallbackVersion) {
        console.log(`🚫 Skipping spec upload for ${service}@${version} - consumer info unavailable`)
        return
      }

      const response = await fetch(`${resolvedConfig.serviceUrl}/api/specs/${service}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spec,
          metadata: {
            service,
            version,
            branch: metadata.branch || 'main',
            environment: metadata.environment,
            uploadedBy: resolvedConfig.consumer,
            uploadedAt: new Date(),
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to upload spec: ${response.status} ${response.statusText}`)
      }
    },
  }
}

const fetchSpec = async (
  serviceUrl: string,
  apiKey: string,
  service: string,
  providerVersion: string,
  environment: string,
  branch = 'main'
): Promise<{ spec: OpenAPISpec; providerVersion: string }> => {
  // Use the new endpoint that looks up specs by provider deployment version
  const params = new URLSearchParams({
    providerVersion,
    environment,
    branch,
  })
  const response = await fetch(`${serviceUrl}/api/specs/${service}/by-provider-version?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    if (response.status === 404) {
      const errorMsg =
        errorData.message || `Provider version ${providerVersion} not found for ${service}`
      const suggestion = errorData.suggestion || ''
      const availableVersions = errorData.availableVersions || []

      let fullErrorMsg = errorMsg
      if (availableVersions.length > 0) {
        fullErrorMsg += `\nAvailable versions: ${availableVersions.join(', ')}`
      }
      if (suggestion) {
        fullErrorMsg += `\n${suggestion}`
      }

      throw new Error(fullErrorMsg)
    }

    throw new Error(
      `Failed to fetch spec for ${service}@${providerVersion}: ${response.statusText}`
    )
  }

  const data = await response.json()

  // Show helpful messages (safely check for metadata)
  const resolvedVersion = data.metadata?.providerVersion || providerVersion

  console.log(
    `🔍 Provider version resolution: requested="${providerVersion}" → resolved="${resolvedVersion}" for ${service}`
  )

  if (data.metadata?.resolvedFromLatest) {
    console.log(`📋 Using latest provider version: ${resolvedVersion} for ${service}`)
  }

  if (data.metadata && !data.metadata.isDeployed) {
    console.log(
      `ℹ️  Using spec for ${service}@${resolvedVersion} (not currently deployed in ${environment})`
    )
  }

  return {
    spec: data.spec || data, // Support both new format (data.spec) and old format (data directly)
    providerVersion: resolvedVersion, // Use resolved version consistently
  }
}

// Convert LocalMockData to Fixture format for mock server
const convertMockDataToFixtures = (
  mockData: LocalMockData,
  service: string,
  version: string,
  spec: OpenAPISpec
): Fixture[] => {
  const fixtures: Fixture[] = []
  let fixtureId = 1

  // Create mapping from operation ID to path and method
  const operationMap = new Map<string, { path: string; method: string }>()
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation === 'object' && operation && (operation as any).operationId) {
        operationMap.set((operation as any).operationId, { path, method: method.toUpperCase() })
      }
    }
  }

  for (const [operationId, scenarios] of Object.entries(mockData)) {
    const operationInfo = operationMap.get(operationId)
    if (!operationInfo) {
      console.warn(`⚠️  Operation ${operationId} not found in OpenAPI spec, skipping fixture`)
      continue
    }

    for (const [scenarioName, mockResponse] of Object.entries(scenarios)) {
      // Generate request data based on operation info and scenario
      const requestData = generateRequestDataForOperation(
        operationId,
        scenarioName,
        operationInfo,
        mockResponse
      )

      const fixture: Fixture = {
        id: `local_${fixtureId++}`,
        service,
        serviceVersion: version,
        serviceVersions: [version],
        operation: operationId,
        status: 'approved',
        source: 'manual',
        priority: scenarioName === 'success' || scenarioName === 'default' ? 1 : 2,
        data: {
          request: requestData,
          response: {
            status: mockResponse.status,
            headers: mockResponse.headers || { 'content-type': 'application/json' },
            body: mockResponse.body,
          },
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'local-mock-data',
        },
        createdAt: new Date(),
        notes: `Local mock data for ${operationId} - ${scenarioName}`,
      }
      fixtures.push(fixture)
    }
  }

  return fixtures
}

// Generate request data for a given operation and scenario
const generateRequestDataForOperation = (
  operationId: string,
  scenarioName: string,
  operationInfo: { path: string; method: string },
  mockResponse: any
): HTTPRequest => {
  let path = operationInfo.path
  let body: unknown = null

  // Handle different scenarios and operations
  switch (operationId) {
    case 'getCastle':
      // For getCastle, we need to replace {id} with actual ID based on scenario
      if (scenarioName === 'notFound') {
        path = path.replace('{id}', 'non-existent-id')
      } else {
        // Use the ID from the response body if available
        const responseBody = mockResponse.body
        const id = responseBody?.id || '550e8400-e29b-41d4-a716-446655440000'
        path = path.replace('{id}', id)
      }
      break

    case 'deleteCastle':
      // For deleteCastle, replace {id} with actual ID
      if (scenarioName === 'notFound') {
        path = path.replace('{id}', 'non-existent-id')
      } else {
        path = path.replace('{id}', '550e8400-e29b-41d4-a716-446655440000')
      }
      break

    case 'createCastle':
      // For createCastle, set request body based on scenario
      if (scenarioName === 'validationError') {
        body = {
          name: '',
          region: 'Test Region',
          yearBuilt: 999,
        }
      } else {
        body = {
          name: 'Château de Test',
          region: 'Test Region',
          yearBuilt: 1500,
        }
      }
      break

    case 'listCastles':
      // For listCastles, no special handling needed
      break

    default:
      console.warn(`⚠️  Unknown operation ${operationId}, using default request data`)
  }

  const headers: Record<string, string> = {}
  if (operationInfo.method === 'POST' || operationInfo.method === 'PUT') {
    headers['content-type'] = 'application/json'
  }

  return {
    method: operationInfo.method,
    path,
    headers,
    query: {},
    body,
  }
}

const fetchFixtures = async (
  serviceUrl: string,
  apiKey: string,
  service: string,
  version: string,
  localFixtures?: Fixture[],
  localMockData?: LocalMockData
): Promise<Fixture[]> => {
  try {
    // Handle new LocalMockData format (preferred)
    if (localMockData) {
      console.log(`📋 Using local mock data for ${service}@${version}`)
      // We need the spec to generate proper request data, but we don't have it yet at this point
      // This will be handled in createMockServer where we have the spec available
      return []
    }

    // Handle legacy local fixtures format (deprecated)
    if (localFixtures && localFixtures.length > 0) {
      console.log(
        `⚠️  Using legacy local fixtures format - consider migrating to localMockData format`
      )

      // Fix any fixtures that have wrong versions (override with resolved version)
      const correctedFixtures = localFixtures.map(fixture => ({
        ...fixture,
        serviceVersion: version, // Override with resolved provider version
        serviceVersions: [version], // Update service versions array
      }))

      // Upload local fixtures to the server for future use
      await uploadLocalFixtures(serviceUrl, apiKey, correctedFixtures)

      const prioritizedFixtures = prioritizeFixtures(correctedFixtures)
      return prioritizedFixtures
    }

    // Fallback: Get all approved fixtures from server
    const response = await fetch(
      `${serviceUrl}/api/fixtures/service/${service}?version=${version}&status=approved`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.ok) {
      const fixtures = await response.json()
      return prioritizeFixtures(fixtures)
    }

    return []
  } catch (_error) {
    return []
  }
}

// Mock server implementation (simplified - would integrate with Prism in real implementation)
interface MockServer {
  url: string
  port: number
  close: () => Promise<void>
  onRequest: (handler: (req: MockRequest, res: MockResponse) => Promise<void>) => void
  getOperations: () => SpecOperation[]
}

// OpenAPI operation from spec
interface SpecOperation {
  method: string
  path: string
  operationId?: string
}

interface MockRequest {
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, unknown>
  body: unknown
}

interface MockResponse {
  status: number
  headers: Record<string, string>
  body: unknown
  duration: number
}

const createMockServer = async (config: {
  spec: OpenAPISpec
  fixtures: Fixture[]
  port: number
  validateRequest: boolean
  validateResponse: boolean
}): Promise<MockServer> => {
  // This is a simplified implementation
  // In practice, this would use Prism or similar tool

  let server: MockServer

  if (config.fixtures.length > 0) {
    // Use fixtures for deterministic responses
    server = await createFixtureBasedMockServer(config.spec, config.fixtures, config.port)
  } else {
    // Use dynamic schema-based mocking
    server = await createSchemaMockServer(config.spec, config.port)
  }

  return server
}

const createFixtureBasedMockServer = async (
  spec: OpenAPISpec,
  fixtures: Fixture[],
  port: number
): Promise<MockServer> => {
  return await createBasicMockServer(spec, fixtures, port)
}

const createSchemaMockServer = async (spec: OpenAPISpec, port: number): Promise<MockServer> => {
  // Schema-based (no fixtures) - the mock handler will fall back to OpenAPI examples or 501 responses
  return await createBasicMockServer(spec, [], port)
}

const extractOperationsFromSpec = (spec: OpenAPISpec): SpecOperation[] => {
  const operations: SpecOperation[] = []

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation === 'object' && operation) {
        operations.push({
          method: method.toUpperCase(),
          path,
          operationId: (operation as any).operationId
        })
      }
    }
  }

  return operations
}

const createBasicMockServer = async (
  spec: OpenAPISpec,
  fixtures: Fixture[],
  port: number
): Promise<MockServer> => {
  const { createServer } = await import('node:http')
  const actualPort = port || 3000 + Math.floor(Math.random() * 1000)

  // Extract operations from OpenAPI spec
  const operations: SpecOperation[] = extractOperationsFromSpec(spec)

  // Create mock handlers using the fixtures package
  const mockHandlers = createOpenAPIMockHandler(spec, fixtures)

  let httpServer: Server | null = null
  const handlers: Array<(req: MockRequest, res: MockResponse) => Promise<void>> = []

  const startServer = async () => {
    httpServer = createServer(async (req, res) => {
      const startTime = Date.now()

      try {
        // Parse request
        const url = new URL(req.url || '/', `http://localhost:${actualPort}`)
        const method = req.method || 'GET'

        // Get headers
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') {
            headers[key.toLowerCase()] = value
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value.join(', ')
          }
        }

        // Get query parameters
        const query: Record<string, unknown> = {}
        for (const [key, value] of url.searchParams.entries()) {
          query[key] = value
        }

        // Get request body if present
        let body: unknown = undefined
        if (method !== 'GET' && method !== 'HEAD') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            const bodyText = Buffer.concat(chunks).toString()

            if (bodyText) {
              const contentType = headers['content-type'] || ''
              if (contentType.includes('application/json')) {
                body = JSON.parse(bodyText)
              } else {
                body = bodyText
              }
            }
          } catch {
            // Ignore body parsing errors
          }
        }

        // Create mock request
        const mockRequest: FixtureMockRequest = {
          method,
          path: url.pathname,
          headers,
          query,
          body
        }

        // Handle request with mock handlers
        const mockResponse = handleMockRequest(mockRequest, mockHandlers)
        const duration = Date.now() - startTime

        // Set response headers
        res.statusCode = mockResponse.status
        for (const [key, value] of Object.entries(mockResponse.headers)) {
          res.setHeader(key, value)
        }

        // Send response
        const responseBody = typeof mockResponse.body === 'string'
          ? mockResponse.body
          : JSON.stringify(mockResponse.body)
        res.end(responseBody)

        // Create mock objects for handlers
        const mockReq: MockRequest = {
          method,
          path: url.pathname,
          headers,
          query,
          body
        }

        const mockRes: MockResponse = {
          status: mockResponse.status,
          headers: mockResponse.headers,
          body: mockResponse.body,
          duration
        }

        // Invoke all registered handlers
        for (const handler of handlers) {
          try {
            await handler(mockReq, mockRes)
          } catch (handlerError) {
            console.error('Handler error:', handlerError)
          }
        }

      } catch (error) {
        console.error('Mock server error:', error)
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })

    await new Promise<void>((resolve, reject) => {
      httpServer!.listen(actualPort, (err?: Error) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  await startServer()

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    close: async () => {
      if (httpServer) {
        await new Promise<void>(resolve => {
          httpServer!.close(() => resolve())
        })
        httpServer = null
      }
    },
    onRequest: handler => {
      handlers.push(handler)
    },
    getOperations: () => operations
  }
}

// Legacy Prism types and functions removed - functionality moved to fixtures package

const createFixtureCollector = (
  service: string,
  providerVersion: string,
  serviceUrl: string,
  apiKey: string
): FixtureCollector => {
  const collectedFixtures = new Map<
    string,
    { operation: string; data: { request?: unknown; response: unknown } }
  >()

  return {
    collect: async (operation: string, data: { request?: unknown; response: unknown }) => {
      // Generate hash to check for duplicates
      const hash = await generateFixtureHash(operation, data)

      if (!collectedFixtures.has(hash)) {
        collectedFixtures.set(hash, { operation, data })
      }
    },

    uploadCollected: async () => {
      if (collectedFixtures.size === 0) {
        return
      }

      // Convert collected fixtures to fixture proposals
      const fixtureProposals: FixtureProposal[] = Array.from(collectedFixtures.values()).map(
        ({ operation, data }) => ({
          service,
          serviceVersion: providerVersion,
          operation,
          source: 'consumer' as const,
          data,
          createdFrom: {
            type: 'test_output',
            timestamp: new Date(),
            generatedBy: 'consumer-test',
            testRun: process.env.BUILD_ID || 'local',
          },
          notes: 'Auto-generated fixture from consumer test',
        })
      )

      // Batch upload all fixtures
      try {
        const response = await fetch(`${serviceUrl}/api/fixtures/batch`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fixtures: fixtureProposals }),
        })

        if (response.ok) {
          const result = await response.json()
          console.log(
            `✅ Batch uploaded ${fixtureProposals.length} fixtures: ${result.created} created, ${result.duplicates} duplicates`
          )
        } else {
          console.error(
            `❌ Failed to batch upload fixtures: ${response.status} ${response.statusText}`
          )
        }
      } catch (error) {
        console.error(`❌ Error batch uploading fixtures: ${error}`)
      }

      collectedFixtures.clear()
    },

    getCollectedCount: () => collectedFixtures.size,
  }
}

const createEntenteMock = (mockConfig: {
  service: string
  providerVersion: string
  mockServer: MockServer
  recorder?: InteractionRecorder
  fixtures: Fixture[]
  fixtureManager: ReturnType<typeof createFixtureManager>
  hasFixtures: boolean
  config: ClientConfig & { consumer: string; consumerVersion: string } // Resolved config with required fields
  skipOperations: boolean // Skip operations when using fallback values
}): EntenteMock => {
  // Create fixture collector for deduplication
  const fixtureCollector = createFixtureCollector(
    mockConfig.service,
    mockConfig.providerVersion,
    mockConfig.config.serviceUrl,
    mockConfig.config.apiKey
  )

  // Set up recording if enabled
  if (mockConfig.recorder) {
    mockConfig.mockServer.onRequest(async (request, response) => {
      // Get operations from the mock server for spec-based operation extraction
      const operations = mockConfig.mockServer.getOperations()
      const operation = extractOperationFromSpec(request.method, request.path, operations)

      await mockConfig.recorder?.record({
        service: mockConfig.service,
        consumer: mockConfig.config.consumer,
        consumerVersion: mockConfig.config.consumerVersion,
        providerVersion: mockConfig.providerVersion,
        environment: mockConfig.config.environment,
        operation,
        request: {
          method: request.method,
          path: request.path,
          headers: request.headers,
          query: request.query,
          body: request.body,
        },
        response: {
          status: response.status,
          headers: response.headers,
          body: response.body,
        },
        duration: response.duration,
      })
    })
  }

  // Set up fixture collection in CI environment and not skipping operations
  if (process.env.CI && !mockConfig.skipOperations) {
    mockConfig.mockServer.onRequest(async (request, response) => {
      // Only collect fixtures for successful responses
      if (response.status >= 200 && response.status < 300) {
        // Get operations from the mock server for spec-based operation extraction
        const operations = mockConfig.mockServer.getOperations()
        const operation = extractOperationFromSpec(request.method, request.path, operations)

        await fixtureCollector.collect(operation, {
          request: {
            method: request.method,
            path: request.path,
            headers: request.headers,
            query: request.query,
            body: request.body,
          },
          response: {
            status: response.status,
            headers: response.headers,
            body: response.body,
          },
        })
      }
    })
  } else if (process.env.CI && mockConfig.skipOperations) {
    console.log('🚫 Skipping fixture collection - consumer info unavailable')
  }

  return {
    url: mockConfig.mockServer.url,
    port: mockConfig.mockServer.port,
    close: async () => {
      // Upload collected fixtures before closing
      await fixtureCollector.uploadCollected()

      await mockConfig.mockServer.close()

      if (mockConfig.recorder) {
        await mockConfig.recorder.flush()
      }
    },
    getFixtures: () => mockConfig.fixtures,
    proposeFixture: async (operation: string, data: { request?: unknown; response: unknown }) => {
      if (mockConfig.skipOperations) {
        console.log(`🚫 Skipping fixture proposal for ${operation} - consumer info unavailable`)
        return
      }

      await mockConfig.fixtureManager.propose({
        service: mockConfig.service,
        serviceVersion: mockConfig.providerVersion,
        operation,
        source: 'consumer',
        data,
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'manual-proposal',
        },
        notes: 'Manually proposed fixture',
      })
    },
  }
}

const createInteractionRecorder = (
  config: ClientConfig & { consumer: string; consumerVersion: string }
): InteractionRecorder => {
  const pendingInteractions: ClientInteraction[] = []
  const seenInteractionHashes = new Set<string>()
  let cachedGitSha: string | null = null

  const flush = async () => {
    if (pendingInteractions.length === 0) return

    try {
      // Send all interactions in one batch request
      const response = await fetch(`${config.serviceUrl}/api/interactions/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingInteractions),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(
          `✅ Batch uploaded ${pendingInteractions.length} interactions: ${result.results.recorded} recorded, ${result.results.duplicates} duplicates`
        )
      } else {
        console.error(
          `❌ Failed to upload interactions batch: ${response.status} ${response.statusText}`
        )
      }

      pendingInteractions.length = 0 // Clear array
      seenInteractionHashes.clear() // Clear deduplication cache
    } catch (error) {
      console.error(`❌ Error uploading interactions batch: ${error}`)
    }
  }

  return {
    record: async (interaction: Omit<ClientInteraction, 'id' | 'timestamp' | 'clientInfo'>) => {
      // Generate hash for client-side deduplication
      const hash = await generateInteractionHash(
        interaction.service,
        config.consumer,
        config.consumerVersion,
        interaction.operation,
        interaction.request,
        interaction.response
      )

      // Skip if we've already seen this interaction hash in this session
      if (seenInteractionHashes.has(hash)) {
        return
      }

      seenInteractionHashes.add(hash)

      // Get git SHA once and cache it
      if (cachedGitSha === null) {
        cachedGitSha = getGitSha()
      }

      const fullInteraction: ClientInteraction = {
        ...interaction,
        id: generateId(),
        timestamp: new Date(),
        consumer: config.consumer,
        consumerVersion: config.consumerVersion,
        consumerGitSha: cachedGitSha || undefined,
        environment: config.environment,
        clientInfo: {
          library: '@entente/consumer',
          version: '0.1.0',
          buildId: process.env.BUILD_ID,
          commit: cachedGitSha || undefined,
        },
      }

      pendingInteractions.push(fullInteraction)

      // Auto-flush in CI to avoid losing data
      if (process.env.CI && pendingInteractions.length >= 10) {
        await flush()
      }
    },

    flush,
  }
}

const generateId = (): string => {
  return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const injectFixturesIntoSpec = (spec: OpenAPISpec, fixtures: Fixture[]): OpenAPISpec => {
  if (fixtures.length === 0) {
    return spec
  }

  // Create a deep copy of the spec
  const modifiedSpec = JSON.parse(JSON.stringify(spec))

  // Group fixtures by operation
  const fixturesByOperation = new Map<string, Fixture[]>()
  for (const fixture of fixtures) {
    const operation = fixture.operation
    if (!fixturesByOperation.has(operation)) {
      fixturesByOperation.set(operation, [])
    }
    fixturesByOperation.get(operation)?.push(fixture)
  }

  for (const [_path, pathItem] of Object.entries(modifiedSpec.paths)) {
    for (const [_method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation === 'object' && operation && (operation as any).operationId) {
      }
    }
  }

  // Inject fixtures as examples into the spec
  for (const [_path, pathItem] of Object.entries(modifiedSpec.paths)) {
    for (const [_method, operation] of Object.entries(pathItem as any)) {
      if (typeof operation !== 'object' || !operation || !(operation as any).operationId) {
        continue
      }

      const operationId = (operation as any).operationId
      const operationFixtures = fixturesByOperation.get(operationId)
      if (!operationFixtures || operationFixtures.length === 0) {
        continue
      }

      // Group fixtures by status code
      const fixturesByStatus = new Map<number, Fixture[]>()
      for (const fixture of operationFixtures) {
        const response = fixture.data.response as any
        const status = response.status
        if (!fixturesByStatus.has(status)) {
          fixturesByStatus.set(status, [])
        }
        fixturesByStatus.get(status)?.push(fixture)
      }

      // Inject examples into responses
      const operationObj = operation as any
      if (operationObj.responses) {
        for (const [status, statusFixtures] of fixturesByStatus) {
          const statusKey = status.toString()
          if (operationObj.responses[statusKey]) {
            const response = operationObj.responses[statusKey]
            if (response.content?.['application/json']) {
              // Use the first fixture's response body as the primary example
              const exampleBody = (statusFixtures[0].data.response as any).body

              // Set both example and examples for Prism compatibility
              response.content['application/json'].example = exampleBody

              // Also set examples array with named examples for Prism to pick from
              response.content['application/json'].examples = {
                default: {
                  summary: `Default response for ${operationId}`,
                  value: exampleBody,
                },
              }

              // If there are multiple fixtures for this status, add them as additional examples
              for (const [index, fixture] of statusFixtures.entries()) {
                if (index > 0) {
                  const additionalExampleBody = (fixture.data.response as any).body
                  response.content['application/json'].examples[`example_${index}`] = {
                    summary: `Alternative response ${index + 1} for ${operationId}`,
                    value: additionalExampleBody,
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return modifiedSpec
}

const uploadLocalFixtures = async (
  serviceUrl: string,
  apiKey: string,
  fixtures: Fixture[]
): Promise<void> => {
  try {
    for (const fixture of fixtures) {
      const response = await fetch(`${serviceUrl}/api/fixtures`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fixture),
      })

      if (!response.ok) {
      } else {
      }
    }
  } catch (_error) {}
}

const _findMatchingFixture = (fixtures: Fixture[], request: MockRequest): Fixture | undefined => {
  return fixtures.find(fixture => {
    const fixtureRequest = fixture.data.request as any

    // Match method
    if (fixtureRequest.method !== request.method) {
      return false
    }

    // Match path (exact match or pattern match for path parameters)
    if (!pathMatches(fixtureRequest.path, request.path)) {
      return false
    }

    // If request has body, compare it (for POST/PUT requests)
    if (request.body && fixtureRequest.body) {
      try {
        const requestBodyStr = JSON.stringify(request.body)
        const fixtureBodyStr = JSON.stringify(fixtureRequest.body)
        if (requestBodyStr !== fixtureBodyStr) {
          return false
        }
      } catch {
        // If JSON comparison fails, do string comparison
        if (String(request.body) !== String(fixtureRequest.body)) {
          return false
        }
      }
    }

    return true
  })
}

const pathMatches = (fixturePath: string, requestPath: string): boolean => {
  // Exact match
  if (fixturePath === requestPath) {
    return true
  }

  // Pattern match for path parameters (e.g., /castles/{id} matches /castles/123)
  const fixtureSegments = fixturePath.split('/')
  const requestSegments = requestPath.split('/')

  if (fixtureSegments.length !== requestSegments.length) {
    return false
  }

  for (let i = 0; i < fixtureSegments.length; i++) {
    const fixtureSegment = fixtureSegments[i]
    const requestSegment = requestSegments[i]

    // If fixture segment is a parameter (contains alphanumeric chars), it matches any value
    if (fixtureSegment && /^[a-zA-Z0-9-]+$/.test(fixtureSegment) && requestSegment) {
      continue
    }

    // Otherwise, must be exact match
    if (fixtureSegment !== requestSegment) {
      return false
    }
  }

  return true
}

const _generateResponseFromSpec = (
  spec: OpenAPISpec,
  request: MockRequest
): MockResponse | null => {
  const path = findSpecPath(spec, request.path, request.method)
  if (!path) {
    return null
  }

  const operation = path[request.method.toLowerCase() as keyof typeof path]
  if (!operation || typeof operation !== 'object') {
    return null
  }

  // Try to find a 200 response, or the first available response
  const responses = (operation as any).responses
  const responseKey = responses['200'] ? '200' : Object.keys(responses)[0]
  const responseSpec = responses[responseKey]

  if (!responseSpec) {
    return null
  }

  const status = Number.parseInt(responseKey, 10)
  const headers = { 'content-type': 'application/json' }

  // Try to get example from spec
  let body = null
  if (responseSpec.content?.['application/json']) {
    const jsonContent = responseSpec.content['application/json']
    if (jsonContent.example) {
      body = jsonContent.example
    } else if (jsonContent.schema?.example) {
      body = jsonContent.schema.example
    }
  }

  return { status, headers, body, duration: 0 }
}

const findSpecPath = (spec: OpenAPISpec, requestPath: string, _method: string): any => {
  const paths = spec.paths

  // Try exact match first
  if (paths[requestPath]) {
    return paths[requestPath]
  }

  // Try pattern matching for path parameters
  for (const [specPath, pathItem] of Object.entries(paths)) {
    if (pathMatchesSpec(specPath, requestPath)) {
      return pathItem
    }
  }

  return null
}

const pathMatchesSpec = (specPath: string, requestPath: string): boolean => {
  const specSegments = specPath.split('/')
  const requestSegments = requestPath.split('/')

  if (specSegments.length !== requestSegments.length) {
    return false
  }

  for (let i = 0; i < specSegments.length; i++) {
    const specSegment = specSegments[i]
    const requestSegment = requestSegments[i]

    // If spec segment is a parameter (e.g., {id}), it matches any value
    if (specSegment.startsWith('{') && specSegment.endsWith('}')) {
      continue
    }

    // Otherwise, must be exact match
    if (specSegment !== requestSegment) {
      return false
    }
  }

  return true
}

// Export mock server utilities for use by other packages
export type { MockServer, MockRequest, MockResponse }
