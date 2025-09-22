// Core contract types based on the specification

// Unified Service entity (replaces Provider and Consumer)
export interface Service {
  id: string
  tenantId: string
  name: string
  specType?: SpecType // Optional: Primary spec type for the service
  description?: string
  packageJson: Record<string, unknown>
  gitRepositoryUrl?: string
  // GitHub integration fields
  githubRepositoryOwner?: string
  githubRepositoryName?: string
  githubVerifyWorkflowId?: string
  githubVerifyWorkflowName?: string
  githubVerifyWorkflowPath?: string
  githubAutoLinked?: boolean
  githubConfiguredAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Service Version entity - represents a specific version of a service
export interface ServiceVersion {
  id: string
  tenantId: string
  serviceId: string
  serviceName: string
  version: string
  specType?: SpecType // Optional: Spec type for this version
  spec?: any // Specification (OpenAPI, GraphQL, AsyncAPI, etc.)
  gitSha?: string
  packageJson?: Record<string, unknown>
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// Legacy interfaces for backward compatibility
export interface Provider {
  id: string
  tenantId: string
  name: string
  description?: string
  packageJson: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface Consumer {
  id: string
  tenantId: string
  name: string
  description?: string
  packageJson: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// Contract entity - represents the relationship between a consumer and provider
export interface Contract {
  id: string
  tenantId: string
  // Consumer information
  consumerId: string
  consumerName: string
  consumerVersion: string
  consumerGitSha?: string
  // Provider information
  providerId: string
  providerName: string
  providerVersion: string
  // Environment
  environment: string
  // Specification type for this contract
  specType: SpecType
  // Contract metadata
  status: 'active' | 'archived' | 'deprecated'
  interactionCount: number // Dynamically calculated from interactions table
  // Timestamps
  firstSeen: Date
  lastSeen: Date
  createdAt: Date
  updatedAt: Date
}

// Service dependencies (replaces ConsumerDependency)
export interface ServiceDependency {
  id: string
  tenantId: string
  consumerId: string
  consumerVersion: string
  providerId: string
  providerVersion: string
  environment: string
  deploymentId?: string
  status: 'pending_verification' | 'verified' | 'failed'
  registeredAt: Date
  verifiedAt?: Date
}

// Legacy interface for backward compatibility
export interface ConsumerDependency {
  id: string
  tenantId: string
  consumerId: string
  consumerVersion: string
  providerId: string
  providerVersion: string
  environment: string
  deploymentId?: string
  status: 'pending_verification' | 'verified' | 'failed'
  registeredAt: Date
  verifiedAt?: Date
}

// Service registration (replaces ProviderRegistration and ConsumerRegistration)
export interface ServiceRegistration {
  name: string
  description?: string
  packageJson: Record<string, unknown>
  gitRepositoryUrl?: string
}

// Legacy registration interfaces for backward compatibility
export interface ProviderRegistration {
  name: string
  description?: string
  packageJson: Record<string, unknown>
}

export interface ConsumerRegistration {
  name: string
  description?: string
  packageJson: Record<string, unknown>
}

// Unified service deployment interface
export interface ServiceDeployment {
  name: string
  version: string
  environment: string
  gitSha?: string
  dependencies?: Array<{
    provider: string
    version: string
  }> // Optional dependencies for services that consume other services
  deployedBy?: string
}

// Legacy deployment interfaces for backward compatibility
export interface ConsumerDeployment {
  name: string
  version: string
  environment: string
  deployedBy?: string
  gitSha?: string
}

export interface ProviderDeployment {
  name: string
  version: string
  environment: string
  deployedBy?: string
  gitSha?: string
}

// Deployment status tracking
export type DeploymentStatus = 'attempted' | 'successful' | 'failed' | 'resolved'
export interface SpecMetadata {
  service: string
  version: string
  branch: string
  uploadedBy: string
  uploadedAt: Date
}

export interface InteractionMatchContext {
  selectedOperationId?: string
  candidates?: Array<{ operationId: string; confidence: number; reasons?: string[] }>
  fixtureId?: string
  fixtureReasons?: string[]
}

export interface ClientInteraction {
  id: string
  contractId?: string // Optional link to contract
  service: string
  serviceVersion?: string // Service version information
  provider?: string // Alias for service for backward compatibility
  consumer: string
  consumerVersion: string
  consumerGitSha?: string
  consumerGitRepositoryUrl?: string // Consumer git repository URL
  // Provider information
  providerVersion: string
  environment: string
  specType?: SpecType // Specification type from associated contract

  // Request/response data
  operation: string
  request: HTTPRequest
  response: HTTPResponse

  // Metadata
  timestamp: Date
  duration: number
  clientInfo: ClientInfo
  status?: 'success' | 'failure' // Derived from response status
  matchContext?: InteractionMatchContext
}

export interface HTTPRequest {
  method: string
  path: string
  headers: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown
}

export interface HTTPResponse {
  status: number
  headers: Record<string, string>
  body?: unknown
}

export interface ClientInfo {
  library: string
  version: string
  buildId?: string
  commit?: string
}

export interface DeploymentState {
  id: string
  tenantId: string
  serviceId?: string
  service: string // Service name
  version: string
  gitSha?: string
  gitRepositoryUrl?: string // Git repository URL
  environment: string
  deployedAt: Date
  deployedBy: string
  active: boolean
  status: DeploymentStatus
  failureReason?: string
  failureDetails?: any // Can store CanIDeployResult or other failure information
  specType?: SpecType // Added: spec type associated with the service
}

export interface ActiveVersion {
  service: string
  version: string
  environment: string
  deployedAt: Date
}

export interface VerificationTask {
  id: string
  tenantId: string
  contractId?: string // Optional link to contract
  providerId: string
  consumerId: string
  dependencyId?: string
  provider: string // Keep for backward compatibility
  providerVersion: string
  consumer: string // Keep for backward compatibility
  consumerVersion: string
  consumerGitSha?: string | null
  environment: string
  specType: SpecType // Specification type for this task
  interactions: ClientInteraction[]
  createdAt: Date
}

export interface VerificationErrorDetails {
  type: 'status_mismatch' | 'structure_mismatch' | 'content_mismatch'
  message: string
  expected?: unknown
  actual?: unknown
  field?: string
}

export interface VerificationResult {
  interactionId: string
  success: boolean
  error?: string
  errorDetails?: VerificationErrorDetails
  actualResponse?: HTTPResponse
  interaction?: ClientInteraction
}

export interface VerificationResults {
  taskId: string
  providerVersion: string
  providerGitSha?: string | null
  consumer?: string
  consumerVersion?: string
  consumerGitSha?: string | null
  specType: SpecType // Specification type for this result
  results: VerificationResult[]
}

// Fixture types
export interface Fixture {
  id: string
  service: string
  serviceVersion: string
  serviceVersions: string[] // Array of all versions where this fixture appears
  specType: 'openapi' | 'graphql' | 'asyncapi' | 'grpc' | 'soap' // NEW: Isolate fixtures by spec type
  operation: string
  status: 'draft' | 'approved' | 'rejected'
  source: 'consumer' | 'provider' | 'manual'
  priority: number
  data: FixtureData
  createdFrom: FixtureCreation
  createdAt: Date
  approvedBy?: string
  approvedAt?: Date
  notes?: string
}

export interface FixtureData {
  request?: unknown
  response: unknown
  state?: Record<string, unknown>
}

export interface FixtureCreation {
  type: 'test_output' | 'manual' | 'generated'
  testRun?: string
  timestamp: Date
  generatedBy?: string
  consumer?: string // Consumer service that created this fixture
}

export interface FixtureProposal {
  service: string
  serviceVersion: string
  specType?: SpecType // Optional, defaults to 'openapi' if not provided
  operation: string
  source: 'consumer' | 'provider'
  priority?: number
  data: FixtureData
  createdFrom: Omit<FixtureCreation, 'type'> & {
    type: 'test_output' | 'generated' | 'manual'
  }
  notes?: string
}

export interface FixtureUpdate {
  data?: FixtureData
  priority?: number
  notes?: string
  status?: 'draft' | 'approved' | 'rejected'
}

// Local Mock Data types (simplified format for users)
export interface LocalMockData {
  [operationId: string]: {
    [scenarioName: string]: MockResponse
  }
}

export interface MockResponse {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

// Batch fixture upload types
export interface BatchFixtureUpload {
  fixtures: FixtureProposal[]
}

export interface BatchFixtureResult {
  total: number
  created: number
  duplicates: number
  errors: number
  results: {
    fixtureId?: string
    status: 'created' | 'duplicate' | 'error'
    error?: string
  }[]
}

// Configuration types
export interface ClientConfig {
  serviceUrl: string
  apiKey: string
  consumer?: string // Optional - will fallback to package.json name
  consumerVersion?: string // Optional - will fallback to package.json version
  environment: string
  recordingEnabled?: boolean
}

export interface ProviderConfig {
  serviceUrl: string
  apiKey: string
  provider?: string // Optional - will fallback to package.json name
  providerVersion?: string // Optional - will fallback to package.json version
  useNormalizedFixtures?: boolean // Enable automatic fixture data normalization
  dataSetupCallback?: (fixtures: NormalizedFixtures) => Promise<void> // Callback for database setup
}

export interface MockOptions {
  branch?: string
  port?: number
  validateRequests?: boolean
  validateResponses?: boolean
  useFixtures?: boolean
  localFixtures?: Fixture[] // Deprecated: Use localMockData instead
  localMockData?: LocalMockData // Recommended: Simple mock data format
}

export interface VerifyOptions {
  baseUrl: string
  environment?: string
  stateHandlers?: Record<string, () => Promise<void>>
  cleanup?: () => Promise<void>
}

// OpenAPI related types
export interface OpenAPISpec {
  openapi?: string // OpenAPI 3.x
  swagger?: string // Swagger 2.x
  info: {
    title: string
    version: string
    description?: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, Record<string, unknown>>
  components?: {
    schemas?: Record<string, unknown>
    responses?: Record<string, unknown>
    parameters?: Record<string, unknown>
  }
}

// API Key types
export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  fullKey?: string // Only returned on creation
  createdBy: string
  expiresAt: string | null
  lastUsedAt: string | null
  isActive: boolean
  permissions: string
  createdAt: string
  revokedAt: string | null
  revokedBy: string | null
}

export interface CreateKeyRequest {
  name: string
  expiresAt?: string
  permissions?: string
  createdBy: string
}

export interface RevokeKeyRequest {
  revokedBy: string
}

// CLI types
export interface UploadOptions {
  service: string
  version?: string
  branch?: string
  spec: string
}

export interface DeploymentOptions {
  service: string
  version: string
  environment: string
  deployedBy?: string
}

export interface CanIDeployOptions {
  service?: string // Service name
  consumer?: string // Legacy parameter for backward compatibility
  version: string
  environment: string
  semverCompatibility?: 'none' | 'patch' | 'minor' // Semver compatibility level
}

interface ServiceInfo {
  service: string
  version: string
  verified: boolean
  nearestVerifiedVersion?: string
  semverCompatible: 'none' | 'patch' | 'minor' | null
  interactionCount: number
  activelyDeployed: boolean
}

interface Issue {
  type: 'verification_failed' | 'not_deployed' | 'no_interactions'
  service: string
  version: string
  reason: string
  suggestion?: string
}

export interface CanIDeployResult {
  canDeploy: boolean
  providers: ServiceInfo[] // Services this service depends on
  consumers: ServiceInfo[] // Services that depend on this service
  issues: Issue[] // Structured list of blocking issues
  message: string // Human-readable summary
  serviceType: string
}

// Settings and team management types
export interface Tenant {
  id: string
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
}

export interface TenantUpdate {
  name?: string
  slug?: string
}

export interface TenantSettings {
  id: string
  tenantId: string
  tenantName: string
  autoCleanupEnabled: boolean
  autoCleanupDays: number
  dataRetentionDays: number
  notificationsEnabled: boolean
  updatedAt: Date
  updatedBy: string
}

export interface TenantSettingsUpdate {
  tenantName?: string
  autoCleanupEnabled?: boolean
  autoCleanupDays?: number
  dataRetentionDays?: number
  notificationsEnabled?: boolean
}

export interface TeamMember {
  id: string
  tenantId: string
  userId: string
  username: string
  name: string
  email: string
  avatarUrl?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: Date
  status: 'active' | 'pending'
}

export interface TeamInvitation {
  id: string
  tenantId: string
  email: string
  role: 'admin' | 'member'
  invitedBy: string
  invitedAt: Date
  expiresAt: Date
  acceptedAt?: Date
  status: 'pending' | 'accepted' | 'expired'
}

export interface InviteTeamMemberRequest {
  email: string
  role: 'admin' | 'member'
}

export interface UpdateTeamMemberRoleRequest {
  role: 'admin' | 'member'
}

export interface GitHubAppInstallation {
  id: string
  tenantId: string
  installationId: number
  accountType: 'user' | 'organization'
  accountLogin: string
  targetType: 'User' | 'Organization'
  permissions: Record<string, string>
  repositorySelection: 'all' | 'selected'
  selectedRepositories: Array<{
    id: number
    name: string
    fullName: string
    private: boolean
  }>
  suspendedAt?: Date
  installedAt: Date
  updatedAt: Date
}

export interface GitHubAppInstallationUpdate {
  repositorySelection?: 'all' | 'selected'
  selectedRepositories?: Array<{
    id: number
    name: string
    fullName: string
    private: boolean
  }>
}

// GitHub service integration types
export interface GitHubServiceConfig {
  repositoryOwner?: string
  repositoryName?: string
  verifyWorkflowId?: string
  verifyWorkflowName?: string
  verifyWorkflowPath?: string
  autoLinked?: boolean
  configuredAt?: Date
}

export interface GitHubWorkflow {
  id: number
  name: string
  path: string
  state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually'
  badge_url: string
  html_url: string
}

export interface GitHubWorkflowRun {
  id: number
  name: string | null
  status: 'queued' | 'in_progress' | 'completed'
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null
  html_url: string
  created_at: string
  updated_at: string
}

export interface GitHubServiceConfigRequest {
  repositoryOwner?: string
  repositoryName?: string
  verifyWorkflowId?: string
  verifyWorkflowName?: string
  verifyWorkflowPath?: string
}

export interface GitHubTriggerWorkflowRequest {
  ref?: string
  inputs?: Record<string, any>
}

// Normalized fixtures types
export interface EntityData {
  id: string | number
  type: string
  data: Record<string, unknown>
  operation: 'create' | 'update' | 'delete'
  source: string // operation ID that created this entity
}

export interface EntityRelationship {
  fromEntity: string
  fromId: string | number
  toEntity: string
  toId: string | number
  relationship: string
}

export interface NormalizedFixtures {
  entities: Record<string, EntityData[]>
  relationships: EntityRelationship[]
  metadata: {
    service: string
    version: string
    totalFixtures: number
    extractedAt: Date
  }
}

// Multi-spec support types
export type SpecType = 'openapi' | 'graphql' | 'asyncapi' | 'grpc' | 'soap'

export interface APISpecMetadata {
  title?: string
  description?: string
  tags?: string[]
  contact?: {
    name?: string
    url?: string
    email?: string
  }
  license?: {
    name: string
    url?: string
  }
}

export interface GraphQLSchema {
  schema: string // SDL (Schema Definition Language) string
  introspection?: any // GraphQL introspection result
}

export interface AsyncAPISpec {
  asyncapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  channels: Record<string, any>
  components?: {
    schemas?: Record<string, any>
    messages?: Record<string, any>
  }
}

export interface GRPCProto {
  proto: string // Proto file content
  services: string[] // Service names defined in proto
  package?: string // Package name
}

export interface SOAPWsdl {
  wsdl: string // WSDL XML content
  services: string[] // Service names
  targetNamespace?: string
}

export interface APISpec {
  type: SpecType
  version: string
  spec: OpenAPISpec | GraphQLSchema | AsyncAPISpec | GRPCProto | SOAPWsdl
  metadata?: APISpecMetadata
}

// Operation abstraction across all spec types
export interface APIOperation {
  id: string // Unique operation identifier
  type: 'query' | 'mutation' | 'subscription' | 'rest' | 'event' | 'rpc'
  method?: string // HTTP method for REST APIs
  path?: string // URL path for REST APIs
  channel?: string // Channel name for event-based APIs
  service?: string // Service name for RPC APIs
  request?: OperationSchema
  response?: OperationSchema
  errors?: OperationSchema[]
  deprecated?: boolean
  description?: string
}

export interface OperationSchema {
  type: string
  schema?: any // JSON Schema, GraphQL type, or other schema representation
  example?: any
  required?: boolean
}

// Request/Response types that work across all spec types
export interface UnifiedRequest {
  // HTTP-specific fields
  method?: string
  path?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown

  // GraphQL-specific fields
  operationName?: string
  variables?: Record<string, unknown>

  // Event-specific fields
  channel?: string
  eventType?: string

  // RPC-specific fields
  service?: string
  procedure?: string
}

export interface UnifiedResponse {
  // HTTP-specific fields
  status?: number
  headers?: Record<string, string>
  body?: unknown

  // GraphQL-specific fields
  data?: unknown
  errors?: Array<{
    message: string
    path?: (string | number)[]
    extensions?: Record<string, unknown>
  }>

  // Event-specific fields
  eventId?: string
  timestamp?: Date

  // Common fields
  duration?: number
  success?: boolean
}

// Validation result type
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  path: string
  message: string
  expected?: any
  actual?: any
  code?: string
}

// Functional spec handler interface (replaces class-based approach)
// --- V2 Matching & Fixture Selection Types (additive) ---
// These types introduce a richer matching pipeline without breaking existing handler interface.
export interface OperationMatchContext {
  request: UnifiedRequest
  specType: SpecType
  // Raw parsed spec (already converted through parseSpec)
  spec?: APISpec
  // All candidate operations extracted from spec
  operations: APIOperation[]
  // Optionally populated by handlers (e.g., path params, variables, channel params)
  extractedParameters?: Record<string, unknown>
  // Arbitrary handler-provided metadata helpful for scoring/recording
  metadata?: Record<string, unknown>
}

export interface OperationMatchCandidate {
  operation: APIOperation
  // Confidence 0..1 representing how certain the handler is this op matches
  confidence: number
  // Optional breakdown for debugging/scoring transparency
  reasons?: string[]
  // Additional structured metrics (e.g., pathScore, methodScore)
  metrics?: Record<string, number>
  // Extracted parameters specific to this candidate (e.g., { userId: '123' })
  parameters?: Record<string, unknown>
}

export interface OperationMatchResult {
  // Ordered list best -> worst of candidates above confidence threshold
  candidates: OperationMatchCandidate[]
  // Selected canonical operation (first candidate) or null if none
  selected: OperationMatchCandidate | null
}

export interface FixtureScoreBreakdown {
  fixtureId: string
  base: number
  priority: number
  recency?: number
  specificity?: number
  sourceBias?: number
  total: number
  reasons?: string[]
}

export interface FixtureSelectionResult {
  // Ordered highest score first
  ordered: FixtureScoreBreakdown[]
  selected?: FixtureScoreBreakdown
}

export interface SpecHandler {
  readonly type: SpecType
  readonly name: string
  canHandle: (spec: any) => boolean
  parseSpec: (spec: any) => APISpec
  extractOperations: (spec: APISpec) => APIOperation[]

  // V2 Methods: Rich operation matching with confidence scoring
  matchOperation: (ctx: OperationMatchContext) => OperationMatchResult
  // V2 Methods: Response generation with fixture selection context
  generateResponse: (params: {
    operation: APIOperation
    fixtures: Fixture[]
    request: UnifiedRequest
    match: OperationMatchCandidate
    fixtureSelection?: FixtureSelectionResult
  }) => UnifiedResponse
  // Optional custom fixture scoring (else default applied)
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
  convertMockDataToFixtures?: (
    mockData: LocalMockData,
    service: string,
    version: string
  ) => Fixture[]
  extractEntitiesFromFixture: (fixture: Fixture) => {
    entities: EntityData[]
    relationships: EntityRelationship[]
  }
  inferEntityType: (operation: string) => string | null
}

// Registry functions interface
export interface SpecRegistry {
  register: (handler: SpecHandler) => void
  getHandler: (type: SpecType) => SpecHandler | null
  detectType: (spec: any) => SpecType | null
  getAllHandlers: () => SpecHandler[]
  getSupportedTypes: () => SpecType[]
  parseSpec: (spec: any) => APISpec | null
}

// Type alias for all supported specification formats
export type SupportedSpec = OpenAPISpec | GraphQLSchema | AsyncAPISpec | GRPCProto | SOAPWsdl

// System View types for optimized visualization data
export interface SystemViewFilters {
  environment?: string
  status?: 'active' | 'archived' | 'deprecated' | 'all'
}

export interface SystemViewService {
  id: string
  name: string
  specType: SpecType | null
  description?: string
  deployedVersion?: string
  roles?: {
    isProvider: boolean
    isConsumer: boolean
    contractCount: number
  }
}

export interface SystemViewContract {
  id: string
  providerName: string
  consumerName: string
  environment: string
  status: 'active' | 'archived' | 'deprecated'
  verificationStatus?: 'passed' | 'failed' | 'partial' | null
  interactionCount: number
  specType: SpecType
}

export interface SystemViewOperation {
  id: string
  method: string
  path: string
  count: number
  lastUsed: Date
  interactionIds?: string[]
}

export interface SystemViewData {
  services: SystemViewService[]
  contracts: SystemViewContract[]
  operations: Record<string, SystemViewOperation[]>
}

// Shared debugging utility that respects ENTENTE_DEBUG environment variable
// Works in both Cloudflare Workers and Node.js environments
export function debugLog(...args: unknown[]): void {
  // In Cloudflare Workers, check globalThis for ENTENTE_DEBUG
  // In Node.js, check process.env.ENTENTE_DEBUG
  let isDebug = false

  try {
    // Check globalThis first (works in both environments)
    if (typeof globalThis !== 'undefined' && (globalThis as any).ENTENTE_DEBUG === 'true') {
      isDebug = true
    }
    // Check process.env if available (Node.js)
    else if (typeof globalThis !== 'undefined' && typeof (globalThis as any).process !== 'undefined') {
      const env = (globalThis as any).process.env
      if (env?.ENTENTE_DEBUG === 'true') {
        isDebug = true
      }
    }
  } catch {
    // Ignore errors in environments where these globals don't exist
  }

  if (isDebug) {
    console.log(...args)
  }
}
