/**
 * Centralized query key factory for TanStack Query
 *
 * This provides type-safe, hierarchical query keys for consistent caching
 * and cache invalidation across the application.
 *
 * Structure:
 * - Root level: Entity type (services, contracts, etc.)
 * - Second level: Operation type (list, detail, etc.)
 * - Third level: Parameters (filters, IDs, etc.)
 */

export type QueryKeyFilters = Record<string, string | number | boolean | undefined>

export const queryKeys = {
  // Services
  services: {
    all: ['services'] as const,
    lists: () => ['services', 'list'] as const,
    list: (filters?: QueryKeyFilters) => ['services', 'list', filters] as const,
    details: () => ['services', 'detail'] as const,
    detail: (name: string, type: 'consumer' | 'provider') =>
      ['services', 'detail', name, type] as const,
    versions: (serviceName: string) => ['services', serviceName, 'versions'] as const,
    interactions: (serviceName: string, filters?: QueryKeyFilters) =>
      ['services', serviceName, 'interactions', filters] as const,
    stats: (serviceName: string, version?: string) =>
      ['services', serviceName, 'stats', version] as const,
  },

  // Contracts
  contracts: {
    all: ['contracts'] as const,
    lists: () => ['contracts', 'list'] as const,
    list: (filters?: QueryKeyFilters) => ['contracts', 'list', filters] as const,
    details: () => ['contracts', 'detail'] as const,
    detail: (id: string) => ['contracts', 'detail', id] as const,
    byProvider: (provider: string) => ['contracts', 'provider', provider] as const,
    byConsumer: (consumer: string) => ['contracts', 'consumer', consumer] as const,
    interactions: (contractId: string, filters?: QueryKeyFilters) =>
      ['contracts', contractId, 'interactions', filters] as const,
    verification: (contractId: string) => ['contracts', contractId, 'verification'] as const,
  },

  // Fixtures
  fixtures: {
    all: ['fixtures'] as const,
    lists: () => ['fixtures', 'list'] as const,
    list: (filters?: QueryKeyFilters) => ['fixtures', 'list', filters] as const,
    details: () => ['fixtures', 'detail'] as const,
    detail: (id: string) => ['fixtures', 'detail', id] as const,
    pending: (service?: string) => ['fixtures', 'pending', service] as const,
    byService: (service: string, status?: string) =>
      ['fixtures', 'service', service, status] as const,
    byOperation: (operation: string, service: string, version: string) =>
      ['fixtures', 'operation', operation, service, version] as const,
    drafts: () => ['fixtures', 'status', 'draft'] as const,
    servicesSummary: () => ['fixtures', 'services', 'summary'] as const,
  },

  // Interactions
  interactions: {
    all: ['interactions'] as const,
    lists: () => ['interactions', 'list'] as const,
    list: (filters?: QueryKeyFilters) => ['interactions', 'list', filters] as const,
    details: () => ['interactions', 'detail'] as const,
    detail: (id: string) => ['interactions', 'detail', id] as const,
    byService: (service: string, version?: string) =>
      ['interactions', 'service', service, version] as const,
    byConsumer: (consumer: string, version?: string) =>
      ['interactions', 'consumer', consumer, version] as const,
    byProvider: (provider: string, filters?: QueryKeyFilters) =>
      ['interactions', 'provider', provider, filters] as const,
    stats: (service: string, version?: string) =>
      ['interactions', service, 'stats', version] as const,
  },

  // Deployments
  deployments: {
    all: ['deployments'] as const,
    lists: () => ['deployments', 'list'] as const,
    active: (environment?: string) => ['deployments', 'active', environment] as const,
    history: (service: string, environment?: string) =>
      ['deployments', 'history', service, environment] as const,
    summary: () => ['deployments', 'summary'] as const,
    environments: () => ['deployments', 'environments'] as const,
    activeForAllEnvs: () => ['deployments', 'active', 'all-environments'] as const,
  },

  // Verification
  verification: {
    all: ['verification'] as const,
    lists: () => ['verification', 'list'] as const,
    list: () => ['verification', 'list'] as const,
    details: () => ['verification', 'detail'] as const,
    detail: (id: string) => ['verification', 'detail', id] as const,
    byProvider: (provider: string) => ['verification', 'provider', provider] as const,
    byConsumer: (consumer: string) => ['verification', 'consumer', consumer] as const,
    tasks: (provider: string) => ['verification', 'tasks', provider] as const,
    pendingTasks: () => ['verification', 'tasks', 'pending'] as const,
    byContract: (contractId: string) => ['verification', 'contract', contractId] as const,
    stats: (provider: string) => ['verification', 'stats', provider] as const,
  },

  // Specs (OpenAPI specifications)
  specs: {
    all: ['specs'] as const,
    lists: () => ['specs', 'list'] as const,
    detail: (service: string, version?: string) => ['specs', 'detail', service, version] as const,
    versions: (service: string) => ['specs', service, 'versions'] as const,
  },

  // Dependencies
  dependencies: {
    all: ['dependencies'] as const,
    lists: () => ['dependencies', 'list'] as const,
    list: (filters?: QueryKeyFilters) => ['dependencies', 'list', filters] as const,
    byConsumer: (consumer: string, environment?: string) =>
      ['dependencies', 'consumer', consumer, environment] as const,
    byProvider: (provider: string, environment?: string) =>
      ['dependencies', 'provider', provider, environment] as const,
  },

  // Stats and Dashboard
  stats: {
    all: ['stats'] as const,
    dashboard: () => ['stats', 'dashboard'] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    detail: () => ['settings', 'detail'] as const,
  },

  // API Keys
  apiKeys: {
    all: ['apiKeys'] as const,
    lists: () => ['apiKeys', 'list'] as const,
    list: (includeRevoked?: boolean) => ['apiKeys', 'list', includeRevoked] as const,
    details: () => ['apiKeys', 'detail'] as const,
    detail: (id: string) => ['apiKeys', 'detail', id] as const,
  },

  // GitHub Integration
  github: {
    all: ['github'] as const,
    appName: () => ['github', 'app-name'] as const,
    installation: () => ['github', 'installation'] as const,
    manageUrl: () => ['github', 'manage-url'] as const,
    serviceConfig: (serviceName: string, serviceType: 'consumer' | 'provider') =>
      ['github', 'service-config', serviceName, serviceType] as const,
    workflows: (serviceName: string, serviceType: 'consumer' | 'provider') =>
      ['github', 'workflows', serviceName, serviceType] as const,
  },

  // Team Management
  team: {
    all: ['team'] as const,
    members: () => ['team', 'members'] as const,
  },

  // Invitations
  invitations: {
    all: ['invitations'] as const,
    details: (token: string) => ['invitations', 'details', token] as const,
  },

  // Service Versions
  serviceVersions: {
    all: ['service-versions'] as const,
    byService: (serviceName: string) => ['service-versions', 'service', serviceName] as const,
    detail: (id: string) => ['service-versions', 'detail', id] as const,
  },
} as const

/**
 * Helper function to invalidate related queries when an entity changes
 */
export const getInvalidationQueries = {
  services: {
    onServiceChange: (serviceName?: string) => [
      queryKeys.services.all,
      queryKeys.stats.dashboard(),
      ...(serviceName
        ? [
            queryKeys.services.detail(serviceName, 'consumer'),
            queryKeys.services.detail(serviceName, 'provider'),
            queryKeys.contracts.byProvider(serviceName),
            queryKeys.contracts.byConsumer(serviceName),
            queryKeys.fixtures.byService(serviceName),
            queryKeys.interactions.byService(serviceName),
            queryKeys.verification.byProvider(serviceName),
            queryKeys.verification.byConsumer(serviceName),
          ]
        : []),
    ],
  },

  contracts: {
    onContractChange: (contractId?: string, provider?: string, consumer?: string) => [
      queryKeys.contracts.all,
      queryKeys.stats.dashboard(),
      ...(contractId ? [queryKeys.contracts.detail(contractId)] : []),
      ...(provider ? [queryKeys.contracts.byProvider(provider)] : []),
      ...(consumer ? [queryKeys.contracts.byConsumer(consumer)] : []),
    ],
  },

  fixtures: {
    onFixtureChange: (fixtureId?: string, service?: string) => [
      queryKeys.fixtures.all,
      queryKeys.fixtures.pending(),
      queryKeys.fixtures.drafts(),
      queryKeys.fixtures.servicesSummary(),
      queryKeys.stats.dashboard(),
      ...(fixtureId ? [queryKeys.fixtures.detail(fixtureId)] : []),
      ...(service ? [queryKeys.fixtures.byService(service)] : []),
    ],
  },

  interactions: {
    onInteractionChange: (service?: string, consumer?: string, provider?: string) => [
      queryKeys.interactions.all,
      queryKeys.stats.dashboard(),
      ...(service ? [queryKeys.interactions.byService(service)] : []),
      ...(consumer ? [queryKeys.interactions.byConsumer(consumer)] : []),
      ...(provider ? [queryKeys.interactions.byProvider(provider)] : []),
    ],
  },

  deployments: {
    onDeploymentChange: (service?: string, environment?: string) => [
      queryKeys.deployments.all,
      queryKeys.deployments.summary(),
      queryKeys.deployments.activeForAllEnvs(),
      queryKeys.stats.dashboard(),
      ...(environment ? [queryKeys.deployments.active(environment)] : []),
      ...(service && environment ? [queryKeys.deployments.history(service, environment)] : []),
    ],
  },

  verification: {
    onVerificationChange: (provider?: string, consumer?: string, contractId?: string) => [
      queryKeys.verification.all,
      queryKeys.verification.pendingTasks(),
      queryKeys.stats.dashboard(),
      ...(provider
        ? [
            queryKeys.verification.byProvider(provider),
            queryKeys.verification.tasks(provider),
            queryKeys.verification.stats(provider),
          ]
        : []),
      ...(consumer ? [queryKeys.verification.byConsumer(consumer)] : []),
      ...(contractId ? [queryKeys.verification.byContract(contractId)] : []),
    ],
  },

  apiKeys: {
    onCreate: () => [queryKeys.apiKeys.all],
    onUpdate: () => [queryKeys.apiKeys.all],
    onDelete: () => [queryKeys.apiKeys.all],
  },

  settings: {
    onUpdate: () => [queryKeys.settings.all],
    onTenantChange: () => [
      // Invalidate everything when tenant context changes
      'ALL',
    ],
  },

  github: {
    onUpdate: () => [queryKeys.github.all],
    onUninstall: () => [queryKeys.github.all],
  },

  team: {
    onMemberChange: () => [queryKeys.team.all],
    onInviteChange: () => [queryKeys.team.all],
  },

  invitations: {
    onAccept: () => [queryKeys.invitations.all, queryKeys.team.all],
  },
}
