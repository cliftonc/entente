// Core contract types based on the specification
export interface SpecMetadata {
  service: string;
  version: string;
  branch: string;
  environment: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ClientInteraction {
  id: string;
  service: string;
  serviceVersion: string;
  consumer: string;
  consumerVersion: string;
  environment: string;

  // Request/response data
  operation: string;
  request: HTTPRequest;
  response: HTTPResponse;

  // Metadata
  timestamp: Date;
  duration: number;
  clientInfo: ClientInfo;
}

export interface HTTPRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface HTTPResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ClientInfo {
  library: string;
  version: string;
  buildId?: string;
  commit?: string;
}

export interface DeploymentState {
  service: string;
  version: string;
  environment: string;
  deployedAt: Date;
  deployedBy: string;
  active: boolean;
}

export interface ActiveVersion {
  service: string;
  version: string;
  environment: string;
  deployedAt: Date;
}

export interface VerificationTask {
  id: string;
  provider: string;
  providerVersion: string;
  consumer: string;
  consumerVersion: string;
  interactions: ClientInteraction[];
  environment: string;
}

export interface VerificationResult {
  interactionId: string;
  success: boolean;
  error?: string;
  actualResponse?: HTTPResponse;
}

export interface VerificationResults {
  taskId: string;
  providerVersion: string;
  results: VerificationResult[];
}

// Fixture types
export interface Fixture {
  id: string;
  service: string;
  serviceVersion: string;
  operation: string;
  status: "draft" | "approved" | "deprecated";
  source: "consumer" | "provider" | "manual";
  priority: number;
  data: FixtureData;
  createdFrom: FixtureCreation;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface FixtureData {
  request?: unknown;
  response: unknown;
  state?: Record<string, unknown>;
}

export interface FixtureCreation {
  type: "test_output" | "manual" | "generated";
  testRun?: string;
  timestamp: Date;
  generatedBy?: string;
}

export interface FixtureProposal {
  service: string;
  serviceVersion: string;
  operation: string;
  source: "consumer" | "provider";
  priority?: number;
  data: FixtureData;
  createdFrom: Omit<FixtureCreation, "type"> & {
    type: "test_output" | "generated" | "manual";
  };
  notes?: string;
}

export interface FixtureUpdate {
  data?: FixtureData;
  priority?: number;
  notes?: string;
  status?: "draft" | "approved" | "deprecated";
}

// Configuration types
export interface ClientConfig {
  serviceUrl: string;
  apiKey: string;
  consumer: string;
  consumerVersion: string;
  environment: string;
  recordingEnabled?: boolean;
}

export interface ProviderConfig {
  serviceUrl: string;
  apiKey: string;
  provider: string;
  providerVersion: string;
}

export interface MockOptions {
  branch?: string;
  port?: number;
  validateRequests?: boolean;
  validateResponses?: boolean;
  useFixtures?: boolean;
}

export interface VerifyOptions {
  baseUrl: string;
  environment?: string;
  stateHandlers?: Record<string, () => Promise<void>>;
  fixtureBasedSetup?: boolean;
  proposeFixtures?: boolean;
  cleanup?: () => Promise<void>;
}

// OpenAPI related types
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey?: string; // Only returned on creation
  createdBy: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
  permissions: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface CreateKeyRequest {
  name: string;
  expiresAt?: string;
  permissions?: string;
  createdBy: string;
}

export interface RevokeKeyRequest {
  revokedBy: string;
}

// CLI types
export interface UploadOptions {
  service: string;
  version: string;
  branch?: string;
  environment: string;
  spec: string;
}

export interface DeploymentOptions {
  service: string;
  version: string;
  environment: string;
  deployedBy?: string;
}

export interface CanIDeployOptions {
  consumer: string;
  version: string;
  environment: string;
}

export interface CanIDeployResult {
  canDeploy: boolean;
  compatibleProviders: Array<{
    service: string;
    version: string;
    verified: boolean;
    interactionCount: number;
  }>;
  message: string;
}
