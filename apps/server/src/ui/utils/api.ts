// API utility functions for UI components
import type {
  ClientInteraction,
  DeploymentState,
  Fixture,
  OpenAPISpec,
  Service,
  ServiceDependency,
  VerificationResults,
  VerificationTask,
} from '@entente/types'
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

// Services API functions (unified)
export const serviceApi = {
  getAll: (type?: 'consumer' | 'provider') =>
    fetchApi<Service[]>(`/services${type ? `?type=${type}` : ''}`),
  getOne: (name: string, type: 'consumer' | 'provider') =>
    fetchApi<Service>(`/services/${name}/${type}`),
  create: (service: {
    name: string
    type: 'consumer' | 'provider'
    description?: string
    packageJson: Record<string, unknown>
  }) => fetchApi<Service>('/services', { method: 'POST', body: JSON.stringify(service) }),
  update: (
    name: string,
    type: 'consumer' | 'provider',
    updates: { description?: string; packageJson?: Record<string, unknown> }
  ) =>
    fetchApi<Service>(`/services/${name}/${type}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (name: string, type: 'consumer' | 'provider') =>
    fetchApi<{ success: boolean }>(`/services/${name}/${type}`, { method: 'DELETE' }),
}

// Consumer API functions (legacy - now wraps services API)
export const consumerApi = {
  getAll: () => serviceApi.getAll('consumer'),
  getOne: (name: string) => serviceApi.getOne(name, 'consumer'),
}

// Provider API functions (legacy - now wraps services API)
export const providerApi = {
  getAll: () => serviceApi.getAll('provider'),
  getOne: (name: string) => serviceApi.getOne(name, 'provider'),
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
    ]).then(([approved, draft]) => [...approved, ...draft]),
  getByOperation: (operation: string, service: string, version: string) =>
    fetchApi<Fixture[]>(`/fixtures/${operation}?service=${service}&version=${version}`),
  getById: (id: string) => fetchApi<Fixture>(`/fixtures/by-id/${id}`),
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
}

// Verification API functions
export const verificationApi = {
  getAll: () => fetchApi<VerificationResults[]>('/verification'),
  getById: (id: string) => fetchApi<VerificationResults>(`/verification/result/${id}`),
  getByProvider: (provider: string) =>
    fetchApi<VerificationResults[]>(`/verification/${provider}/history`),
  getByConsumer: (consumer: string) =>
    fetchApi<VerificationResults[]>(`/verification/consumer/${consumer}/history`),
  getTasks: (provider: string) => fetchApi<VerificationTask[]>(`/verification/${provider}`),
  getStats: (provider: string) =>
    fetchApi<{
      totalTasks: number
      passedTasks: number
      failedTasks: number
      pendingTasks: number
    }>(`/verification/${provider}/stats`),
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
        status: 'healthy' | 'warning' | 'critical'
        lastDeployment?: string
        errorRate?: number
      }>
    }>('/stats/dashboard'),
}
