// Core contract types based on the specification

// Unified Service entity (replaces Provider and Consumer)
export interface Service {
  id: string
  tenantId: string
  name: string
  type: 'consumer' | 'provider'
  description?: string
  packageJson: Record<string, unknown>
  gitRepositoryUrl?: string
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
  type: 'consumer' | 'provider'
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
  type: 'consumer' | 'provider'
  version: string
  environment: string
  dependencies?: Array<{
    provider: string
    version: string
  }> // Only for consumer deployments
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
export interface SpecMetadata {
  service: string
  version: string
  branch: string
  environment: string
  uploadedBy: string
  uploadedAt: Date
}

export interface ClientInteraction {
  id: string
  service: string
  consumer: string
  consumerVersion: string
  consumerGitSha?: string
  environment: string

  // Request/response data
  operation: string
  request: HTTPRequest
  response: HTTPResponse

  // Metadata
  timestamp: Date
  duration: number
  clientInfo: ClientInfo
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
  type: 'provider' | 'consumer'
  providerId?: string
  consumerId?: string
  service: string // Keep for backward compatibility
  version: string
  gitSha?: string
  environment: string
  deployedAt: Date
  deployedBy: string
  active: boolean
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
  providerId: string
  consumerId: string
  dependencyId?: string
  provider: string // Keep for backward compatibility
  providerVersion: string
  consumer: string // Keep for backward compatibility
  consumerVersion: string
  consumerGitSha?: string | null
  interactions: ClientInteraction[]
  environment: string
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
}

export interface VerificationResults {
  taskId: string
  providerVersion: string
  providerGitSha?: string | null
  consumer?: string
  consumerVersion?: string
  consumerGitSha?: string | null
  results: VerificationResult[]
}

// Fixture types
export interface Fixture {
  id: string
  service: string
  serviceVersion: string
  operation: string
  status: 'draft' | 'approved' | 'deprecated'
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
}

export interface FixtureProposal {
  service: string
  serviceVersion: string
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
  status?: 'draft' | 'approved' | 'deprecated'
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
}

export interface MockOptions {
  branch?: string
  port?: number
  validateRequests?: boolean
  validateResponses?: boolean
  useFixtures?: boolean
  localFixtures?: Fixture[]
}

export interface VerifyOptions {
  baseUrl: string
  environment?: string
  stateHandlers?: Record<string, () => Promise<void>>
  cleanup?: () => Promise<void>
}

// OpenAPI related types
export interface OpenAPISpec {
  openapi: string
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
  version: string
  branch?: string
  environment: string
  spec: string
}

export interface DeploymentOptions {
  service: string
  version: string
  environment: string
  deployedBy?: string
}

export interface CanIDeployOptions {
  service?: string // New flexible parameter
  consumer?: string // Legacy parameter for backward compatibility
  version: string
  environment: string
  type?: 'consumer' | 'provider' // Service type for unified services table
}

export interface CanIDeployResult {
  canDeploy: boolean
  compatibleServices?: Array<{
    service: string
    version: string
    verified: boolean
    interactionCount: number
    type: 'consumer' | 'provider'
    activelyDeployed?: boolean
  }>
  // Legacy field for backward compatibility
  compatibleProviders?: Array<{
    service: string
    version: string
    verified: boolean
    interactionCount: number
  }>
  message: string
  serviceType?: 'consumer' | 'provider' | 'consumer/provider' | 'unknown'
}
