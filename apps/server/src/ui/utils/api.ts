// API utility functions for UI components
import type {
  ApiKey,
  ClientInteraction,
  Contract,
  CreateKeyRequest,
  DeploymentState,
  Fixture,
  GitHubAppInstallation,
  GitHubAppInstallationUpdate,
  GitHubServiceConfig,
  GitHubServiceConfigRequest,
  GitHubTriggerWorkflowRequest,
  GitHubWorkflow,
  InviteTeamMemberRequest,
  OpenAPISpec,
  RevokeKeyRequest,
  Service,
  ServiceDependency,
  ServiceVersion,
  SpecType,
  TeamMember,
  TenantSettings,
  TenantSettingsUpdate,
  VerificationResult,
  VerificationResults,
  VerificationTask,
} from '@entente/types'
import type { ExtendedVerificationResult } from '../lib/types'
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Base fetch wrapper with authentication
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(
      errorText || `Request failed: ${response.status}`,
      response.status,
      response.statusText
    )
  }

  return response.json()
}

// Auth fetch wrapper (for auth endpoints)
async function fetchAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/auth${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(
      errorText || `Request failed: ${response.status}`,
      response.status,
      response.statusText
    )
  }

  return response.json()
}

// Services API functions (unified)
export const serviceApi = {
  getAll: (type?: 'consumer' | 'provider') =>
    fetchApi<Service[]>(`/services${type ? `?type=${type}` : ''}`),
  getOne: (name: string) =>
    fetchApi<Service>(`/services/${name}`),
  create: (service: {
    name: string
    description?: string
    packageJson: Record<string, unknown>
  }) => fetchApi<Service>('/services', { method: 'POST', body: JSON.stringify(service) }),
  update: (
    name: string,
    updates: { description?: string; packageJson?: Record<string, unknown> }
  ) =>
    fetchApi<Service>(`/services/${name}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (name: string) =>
    fetchApi<{ success: boolean }>(`/services/${name}`, { method: 'DELETE' }),
}

// Consumer API functions (legacy - now wraps services API)
export const consumerApi = {
  getAll: () => serviceApi.getAll('consumer'),
  getOne: (name: string) => serviceApi.getOne(name),
}

// Provider API functions (legacy - now wraps services API)
export const providerApi = {
  getAll: () => serviceApi.getAll('provider'),
  getOne: (name: string) => serviceApi.getOne(name),
}

// Interaction API functions
export const interactionApi = {
  getAll: (params?: {
    provider?: string
    consumer?: string
    environment?: string
    limit?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.provider) searchParams.set('provider', params.provider)
    if (params?.consumer) searchParams.set('consumer', params.consumer)
    if (params?.environment) searchParams.set('environment', params.environment)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    const queryString = searchParams.toString()
    return fetchApi<ClientInteraction[]>(`/interactions${queryString ? `?${queryString}` : ''}`)
  },
  getByService: (service: string, version: string) =>
    fetchApi<ClientInteraction[]>(`/interactions/${service}?version=${version}`),
  getByConsumer: (consumer: string, version = 'latest') =>
    fetchApi<ClientInteraction[]>(`/interactions/consumer/${consumer}?version=${version}`),
  getById: (id: string) => fetchApi<ClientInteraction>(`/interactions/by-id/${id}`),
  getStats: (service: string, version: string) =>
    fetchApi<{
      totalInteractions: number
      uniqueConsumers: number
      averageDuration: number
      operationBreakdown: Array<{ operation: string; count: number }>
      consumerBreakdown: Array<{ consumer: string; count: number }>
    }>(`/interactions/${service}/stats?version=${version}`),
}

// Fixture API functions
export const fixtureApi = {
  getAll: (params?: {
    service?: string
    provider?: string
    consumer?: string
    status?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.service) searchParams.set('service', params.service)
    if (params?.provider) searchParams.set('provider', params.provider)
    if (params?.consumer) searchParams.set('consumer', params.consumer)
    if (params?.status) searchParams.set('status', params.status)
    const queryString = searchParams.toString()
    return fetchApi<Fixture[]>(`/fixtures${queryString ? `?${queryString}` : ''}`)
  },
  getPending: (service?: string) =>
    fetchApi<Fixture[]>(`/fixtures/pending${service ? `?service=${service}` : ''}`),
  getByService: (service: string, status?: string) =>
    fetchApi<Fixture[]>(`/fixtures/service/${service}${status ? `?status=${status}` : ''}`),
  getAllByService: (service: string) =>
    Promise.all([
      fetchApi<Fixture[]>(`/fixtures/service/${service}?status=approved`),
      fetchApi<Fixture[]>(`/fixtures/service/${service}?status=draft`),
      fetchApi<Fixture[]>(`/fixtures/service/${service}?status=rejected`),
    ]).then(([approved, draft, rejected]) => [...approved, ...draft, ...rejected]),
  getByOperation: (operation: string, service: string, version: string) =>
    fetchApi<Fixture[]>(`/fixtures/${operation}?service=${service}&version=${version}`),
  getById: (id: string) => fetchApi<Fixture>(`/fixtures/by-id/${id}`),
  getServicesSummary: () =>
    fetchApi<
      Array<{ service: string; total: number; draft: number; approved: number; rejected: number }>
    >('/fixtures/services/summary'),
  approve: (id: string, approvedBy: string, notes?: string) =>
    fetchApi<{ success: boolean }>(`/fixtures/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy, notes }),
    }),
  reject: (id: string, rejectedBy: string, notes?: string) =>
    fetchApi<{ success: boolean }>(`/fixtures/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectedBy, notes }),
    }),
  revoke: (id: string, revokedBy: string, notes?: string) =>
    fetchApi<{ success: boolean }>(`/fixtures/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ revokedBy, notes }),
    }),
}

// Deployment API functions
export const deploymentApi = {
  getActive: (environment?: string) =>
    fetchApi<DeploymentState[]>(
      `/deployments/active${environment ? `?environment=${environment}` : '?environment=production'}`
    ),
  getSummary: () =>
    fetchApi<{
      totalDeployments: number
      activeDeployments: number
      environments: string[]
    }>('/deployments/summary'),
  getHistory: (service: string, environment?: string) =>
    fetchApi<DeploymentState[]>(
      `/deployments/${service}/history${environment ? `?environment=${environment}` : ''}`
    ),
  getEnvironments: () => fetchApi<string[]>('/deployments/environments'),
  getActiveForAllEnvs: async () => {
    const environments = await fetchApi<string[]>('/deployments/environments')
    const deploymentPromises = environments.map(env =>
      fetchApi<DeploymentState[]>(`/deployments/active?environment=${env}&include_inactive=true`)
    )
    const results = await Promise.all(deploymentPromises)
    return results.flat()
  },
  getPaginated: (filters?: {
    limit?: number
    offset?: number
    status?: string
    provider?: string
    consumer?: string
    environment?: string
  }) => {
    const params = new URLSearchParams()
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString())
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString())
    if (filters?.status) params.append('status', filters.status)
    if (filters?.provider) params.append('provider', filters.provider)
    if (filters?.consumer) params.append('consumer', filters.consumer)
    if (filters?.environment) params.append('environment', filters.environment)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return fetchApi<{
      results: DeploymentState[]
      totalCount: number
      statistics: {
        totalDeployments: number
        activeDeployments: number
        blockedDeployments: number
      }
      environmentBreakdown: Record<
        string,
        {
          total: number
          active: number
          blocked: number
        }
      >
    }>(`/deployments/paginated${queryString}`)
  },
}

// Verification API functions
export const verificationApi = {
  getAll: (limit?: number, offset?: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (limit !== undefined) params.append('limit', limit.toString())
    if (offset !== undefined) params.append('offset', offset.toString())
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return fetchApi<{
      results: ExtendedVerificationResult[]
      totalCount: number
      statistics: {
        totalVerifications: number
        passedVerifications: number
        failedVerifications: number
        overallPassRate: number
      }
    }>(`/verification${queryString}`)
  },
  getById: (id: string) => fetchApi<ExtendedVerificationResult>(`/verification/result/${id}`),
  getByProvider: (provider: string) =>
    fetchApi<ExtendedVerificationResult[]>(`/verification/${provider}/history`),
  getByConsumer: (consumer: string) =>
    fetchApi<ExtendedVerificationResult[]>(`/verification/consumer/${consumer}/history`),
  getTasks: (provider: string) => fetchApi<VerificationTask[]>(`/verification/${provider}`),
  getPendingTasks: () => fetchApi<VerificationTask[]>('/verification/pending'),
  getByContract: (contractId: string) =>
    fetchApi<{
      pendingTasks: VerificationTask[]
      completedResults: Array<{
        id: string
        provider: string
        providerVersion: string
        providerGitSha?: string
        consumer?: string
        consumerVersion?: string
        consumerGitSha?: string
        taskId: string
        submittedAt: Date
        status: 'passed' | 'failed'
        total: number
        passed: number
        failed: number
      }>
    }>(`/verification/contract/${contractId}`),
  getStats: (provider: string) =>
    fetchApi<{
      totalTasks: number
      passedTasks: number
      failedTasks: number
      pendingTasks: number
    }>(`/verification/${provider}/stats`),
  getRecent: (days?: number, limit?: number) => {
    const params = new URLSearchParams()
    if (days !== undefined) params.append('days', days.toString())
    if (limit !== undefined) params.append('limit', limit.toString())
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return fetchApi<
      Array<{
        id: string
        submittedAt: Date
        status: 'passed' | 'failed'
        provider: string
        consumer?: string
        passed: number
        failed: number
        total: number
      }>
    >(`/verification/recent${queryString}`)
  },
  getLatest: (detail?: boolean) =>
    fetchApi<{
      id: string
      provider: string
      consumer: string
      contractId: string
      status: 'passed' | 'failed' | 'partial'
      submittedAt: string
      providerVersion: string | null
      consumerVersion: string | null
      total: number
      passed: number
      failed: number
      interactions?: VerificationResult[]
    }[]>(`/verification/latest${detail ? '?detail=true' : ''}`),
}

// Spec API functions
export const specApi = {
  getByService: (service: string, version: string) =>
    fetchApi<OpenAPISpec>(`/specs/${service}?version=${version}`),
  getVersions: (service: string) =>
    fetchApi<
      Array<{
        version: string
        uploadedAt: string
        branch?: string
      }>
    >(`/specs/${service}/versions`),
}

// Dependencies API functions
export const dependenciesApi = {
  getByConsumer: (consumer: string, environment?: string) => {
    const params = environment ? `?environment=${environment}` : ''
    return fetchApi<ServiceDependency[]>(`/dependencies/consumer/${consumer}${params}`)
  },
  getByProvider: (provider: string, environment?: string) => {
    const params = environment ? `?environment=${environment}` : ''
    return fetchApi<ServiceDependency[]>(`/dependencies/provider/${provider}${params}`)
  },
  getAll: (environment?: string, status?: string) => {
    const params = new URLSearchParams()
    if (environment) params.set('environment', environment)
    if (status) params.set('status', status)
    const queryString = params.toString()
    return fetchApi<ServiceDependency[]>(`/dependencies${queryString ? `?${queryString}` : ''}`)
  },
}

// Stats API functions (we'll need to create this endpoint)
export const statsApi = {
  getDashboard: () =>
    fetchApi<{
      totalServices: number
      totalInteractions: number
      pendingFixtures: number
      verificationRate: number
      recentDeployments: DeploymentState[]
      serviceHealth: Array<{
        service: string
        name: string
        type?: 'consumer' | 'provider'
        status: 'healthy' | 'warning' | 'critical'
        lastDeployment?: string
        errorRate?: number
        interactions?: number
        passRate?: number
      }>
    }>('/stats/dashboard'),
}

// System View API functions
export const systemViewApi = {
  getData: (filters?: {
    environment?: string
    serviceType?: 'consumer' | 'provider' | 'all'
    status?: 'active' | 'archived' | 'deprecated' | 'all'
  }) => {
    const params = new URLSearchParams()
    if (filters?.environment) params.set('environment', filters.environment)
    if (filters?.serviceType) params.set('serviceType', filters.serviceType)
    if (filters?.status) params.set('status', filters.status)
    const queryString = params.toString()
    return fetchApi<{
      services: Array<{
        id: string
        name: string
        type: 'consumer' | 'provider'
        specType: SpecType
        description?: string
        deployedVersion?: string
      }>
      contracts: Array<{
        id: string
        providerName: string
        consumerName: string
        environment: string
        status: 'active' | 'archived' | 'deprecated'
        verificationStatus?: 'passed' | 'failed' | 'partial' | null
        interactionCount: number
        specType: SpecType
      }>
      operations: Record<string, Array<{
        id: string
        method: string
        path: string
        count: number
        lastUsed: Date
      }>>
    }>(`/system-view${queryString ? `?${queryString}` : ''}`)
  }
}

// Contracts API functions
export const contractApi = {
  getAll: (filters?: {
    provider?: string
    consumer?: string
    environment?: string
    status?: string
    limit?: number
    offset?: number
  }) => {
    const params = new URLSearchParams()
    if (filters?.provider) params.set('provider', filters.provider)
    if (filters?.consumer) params.set('consumer', filters.consumer)
    if (filters?.environment) params.set('environment', filters.environment)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.limit) params.set('limit', filters.limit.toString())
    if (filters?.offset) params.set('offset', filters.offset.toString())
    const queryString = params.toString()
    return fetchApi<{
      results: Contract[]
      totalCount: number
      statistics: {
        totalContracts: number
        activeContracts: number
        archivedContracts: number
        deprecatedContracts: number
      }
    }>(`/contracts${queryString ? `?${queryString}` : ''}`)
  },
  getById: (id: string) => fetchApi<Contract>(`/contracts/${id}`),
  getByProvider: (provider: string) =>
    fetchApi<{
      results: Contract[]
      totalCount: number
      statistics: {
        totalContracts: number
        activeContracts: number
        archivedContracts: number
        deprecatedContracts: number
      }
    }>(`/contracts?provider=${provider}`),
  getByConsumer: (consumer: string) =>
    fetchApi<{
      results: Contract[]
      totalCount: number
      statistics: {
        totalContracts: number
        activeContracts: number
        archivedContracts: number
        deprecatedContracts: number
      }
    }>(`/contracts?consumer=${consumer}`),
  getInteractions: (id: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : ''
    return fetchApi<ClientInteraction[]>(`/contracts/${id}/interactions${params}`)
  },
  updateStatus: (id: string, status: 'active' | 'archived' | 'deprecated') =>
    fetchApi<Contract>(`/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

// Settings API functions
export const settingsApi = {
  get: () => fetchApi<TenantSettings>('/settings'),
  update: (updates: TenantSettingsUpdate) =>
    fetchApi<TenantSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
}

// Tenant API functions
export const tenantApi = {
  create: (data: { name: string }) =>
    fetchAuth<{ success: boolean }>('/create-tenant', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (data: { slug: string; confirm: string }) =>
    fetchAuth<{ success: boolean; logout?: boolean }>('/delete-tenant', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Keys API functions
export const keysApi = {
  getAll: (includeRevoked?: boolean) => {
    const params = includeRevoked ? '?includeRevoked=true' : ''
    return fetchApi<ApiKey[]>(`/keys${params}`)
  },
  getById: (id: string) => fetchApi<ApiKey>(`/keys/${id}`),
  create: (data: CreateKeyRequest) =>
    fetchApi<ApiKey>('/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rotate: (id: string) =>
    fetchApi<ApiKey>(`/keys/${id}/rotate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  revoke: (id: string, revokedBy: string) =>
    fetchApi<{ success: boolean }>(`/keys/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ revokedBy }),
    }),
}

// Generic API object for convenience
export const api = {
  get: <T>(url: string) => fetchApi<T>(url),
  post: <T>(url: string, data?: unknown) =>
    fetchApi<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(url: string, data?: unknown) =>
    fetchApi<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(url: string, data?: unknown) =>
    fetchApi<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(url: string, data?: unknown) =>
    fetchApi<T>(url, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    }),
}

// GitHub integration API functions
export const githubApi = {
  // Get GitHub configuration for a service
  getServiceConfig: (
    serviceName: string
  ): Promise<GitHubServiceConfig> =>
    fetchApi(`/services/${serviceName}/github/config`),

  // Update GitHub configuration for a service
  updateServiceConfig: (
    serviceName: string,
    config: GitHubServiceConfigRequest
  ): Promise<GitHubServiceConfig> =>
    api.put(`/services/${serviceName}/github/config`, config),

  // Clear GitHub configuration for a service
  clearServiceConfig: (
    serviceName: string
  ): Promise<{ message: string }> =>
    api.delete(`/services/${serviceName}/github/config`),

  // Get available workflows for a service's GitHub repository
  getWorkflows: (
    serviceName: string
  ): Promise<GitHubWorkflow[]> =>
    fetchApi(`/services/${serviceName}/github/workflows`),

  // Trigger verification workflow for a service
  triggerWorkflow: (
    serviceName: string,
    request: GitHubTriggerWorkflowRequest
  ): Promise<{ message: string }> =>
    api.post(`/services/${serviceName}/github/trigger-workflow`, request),
}

// GitHub Integration Settings API functions
export const githubSettingsApi = {
  // Get GitHub app name
  getAppName: (): Promise<{ appName: string }> => fetchApi('/github/app-name'),

  // Get GitHub app installation
  getInstallation: (): Promise<GitHubAppInstallation | null> => fetchApi('/settings/github'),

  // Get GitHub manage URL
  getManageUrl: (): Promise<{ manageUrl: string }> => fetchApi('/settings/github/manage-url'),

  // Update GitHub installation settings
  updateInstallation: (updates: GitHubAppInstallationUpdate): Promise<GitHubAppInstallation> =>
    fetchApi('/settings/github', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Uninstall GitHub app
  uninstallApp: (): Promise<{ success: boolean }> =>
    fetchApi('/settings/github', {
      method: 'DELETE',
    }),
}

// Team Management API functions
export const teamApi = {
  // Get team members
  getMembers: (): Promise<TeamMember[]> => fetchApi('/settings/team'),

  // Invite team member
  inviteMember: (invitation: InviteTeamMemberRequest): Promise<{ success: boolean }> =>
    fetchApi('/settings/team/invite', {
      method: 'POST',
      body: JSON.stringify(invitation),
    }),

  // Update team member role
  updateMemberRole: (userId: string, role: 'admin' | 'member'): Promise<{ success: boolean }> =>
    fetchApi(`/settings/team/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  // Remove team member
  removeMember: (userId: string): Promise<{ success: boolean }> =>
    fetchApi(`/settings/team/${userId}`, {
      method: 'DELETE',
    }),

  // Resend invitation
  resendInvite: (email: string): Promise<{ success: boolean }> =>
    fetchApi(`/settings/team/resend/${encodeURIComponent(email)}`, {
      method: 'POST',
    }),
}

// Invitation API functions
export const invitationApi = {
  // Get invitation details
  getDetails: (token: string): Promise<{ invitation: any }> =>
    fetchAuth(`/invite/details?token=${encodeURIComponent(token)}`),

  // Accept invitation
  accept: (
    token: string
  ): Promise<{ success: boolean; requiresAuth?: boolean; loginUrl?: string; message?: string }> =>
    fetchAuth('/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
}

// Service Version API functions
export const serviceVersionApi = {
  getByService: (serviceName: string): Promise<ServiceVersion[]> =>
    fetchApi<ServiceVersion[]>(`/services/${serviceName}/versions`),

  getById: (serviceVersionId: string): Promise<ServiceVersion> =>
    fetchApi<ServiceVersion>(`/service-versions/${serviceVersionId}`),

  getByServiceAndVersion: (serviceName: string, version: string): Promise<ServiceVersion> =>
    fetchApi<ServiceVersion>(`/services/${serviceName}/versions/${version}`),
}
