/**
 * Common types and interfaces for data hooks
 */

import type {
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query'
import type { VerificationResults } from '@entente/types'

/**
 * Base filter interface that all entity filters extend
 */
export interface BaseFilters {
  limit?: number
  offset?: number
  search?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Service-specific filters
 */
export interface ServiceFilters extends BaseFilters {
  type?: 'consumer' | 'provider'
  status?: 'active' | 'inactive'
  environment?: string
}

/**
 * Contract-specific filters
 */
export interface ContractFilters extends BaseFilters {
  provider?: string
  consumer?: string
  environment?: string
  status?: 'active' | 'archived' | 'deprecated'
}

/**
 * Fixture-specific filters
 */
export interface FixtureFilters extends BaseFilters {
  service?: string
  provider?: string
  consumer?: string
  status?: 'draft' | 'approved' | 'rejected'
  operation?: string
}

/**
 * Interaction-specific filters
 */
export interface InteractionFilters extends BaseFilters {
  provider?: string
  consumer?: string
  environment?: string
  service?: string
  status?: 'success' | 'failure'
  startDate?: string
  endDate?: string
}

/**
 * Deployment-specific filters
 */
export interface DeploymentFilters extends BaseFilters {
  environment?: string
  service?: string
  status?: 'active' | 'inactive'
  includeInactive?: boolean
}

/**
 * Verification-specific filters
 */
export interface VerificationFilters extends BaseFilters {
  provider?: string
  consumer?: string
  status?: 'passed' | 'failed' | 'pending'
  contractId?: string
}

/**
 * Common list response wrapper
 */
export interface ListResponse<T> {
  data: T[]
  total: number
  page?: number
  pageSize?: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
}

/**
 * Common API error type
 */
export interface ApiError {
  message: string
  status: number
  statusText: string
  details?: Record<string, unknown>
}

/**
 * Optimistic update context type
 */
export interface OptimisticContext<T = unknown> {
  previousData?: T
  rollbackOperations?: Array<() => void>
  [key: string]: unknown // Allow additional properties for specific contexts
}

/**
 * Custom query options type with defaults
 */
export type QueryOptions<TData, TError = ApiError> = Omit<
  UseQueryOptions<TData, TError>,
  'queryKey' | 'queryFn'
>

/**
 * Custom mutation options type with defaults
 */
export type MutationOptions<TData, TVariables, TContext = OptimisticContext> = Omit<
  UseMutationOptions<TData, ApiError, TVariables, TContext>,
  'mutationFn'
>

/**
 * Custom infinite query options type
 */
export type InfiniteQueryOptions<TData, TError = ApiError> = Omit<
  UseInfiniteQueryOptions<TData, TError>,
  'queryKey' | 'queryFn' | 'getNextPageParam'
>

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  pageSize: number
  maxPages?: number
  prefetchNextPage?: boolean
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION: PaginationConfig = {
  pageSize: 50,
  maxPages: 10,
  prefetchNextPage: true,
}

/**
 * Hook state type for loading states
 */
export interface HookState<TData, TError = ApiError> {
  data: TData | undefined
  isLoading: boolean
  isError: boolean
  error: TError | null
  isFetching: boolean
  isSuccess: boolean
  refetch: () => void
}

/**
 * Hook state for lists with additional metadata
 */
export interface ListHookState<TData, TError = ApiError> extends HookState<TData[], TError> {
  isEmpty: boolean
  totalCount?: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  currentPage?: number
  pageSize?: number
}

/**
 * Mutation hook state
 */
export interface MutationHookState<TData, TVariables, TError = ApiError> {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  error: TError | null
  data: TData | undefined
  reset: () => void
  isPending: boolean
  variables: TVariables | undefined
}

/**
 * WebSocket event types
 */
export type WebSocketEventType =
  | 'deployment:created'
  | 'deployment:updated'
  | 'deployment:deleted'
  | 'service:created'
  | 'service:updated'
  | 'service:deleted'
  | 'contract:created'
  | 'contract:updated'
  | 'contract:deleted'
  | 'fixture:created'
  | 'fixture:updated'
  | 'fixture:status_change'
  | 'fixture:deleted'
  | 'verification:created'
  | 'verification:updated'
  | 'verification:completed'

/**
 * WebSocket event structure
 */
export interface WebSocketEventBase {
  type: WebSocketEventType | 'welcome' | 'ping' | 'pong'
  entity?: 'deployment' | 'service' | 'contract' | 'fixture' | 'verification'
  action?: 'create' | 'update' | 'delete' | 'status_change'
  data?: Record<string, any>
  timestamp?: string
  tenantId?: string
  userId?: string
}

/**
 * Real-time subscription options
 */
export interface SubscriptionOptions {
  enabled?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

/**
 * WebSocket event types
 */
export type WebSocketEvent = WebSocketEventBase

/**
 * Cache invalidation strategy
 */
export interface InvalidationStrategy {
  invalidateQueries?: readonly (readonly string[])[]
  updateQueries?: Array<{
    queryKey: readonly string[]
    updater: (oldData: unknown) => unknown
  }>
  removeQueries?: readonly (readonly string[])[]
}

/**
 * Hook configuration for consistent behavior
 */
export interface HookConfig {
  staleTime?: number
  gcTime?: number
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  retry?: number | boolean | ((failureCount: number, error: unknown) => boolean)
  retryDelay?: number | ((attemptIndex: number) => number)
  enabled?: boolean
  suspense?: boolean
  useErrorBoundary?: boolean
}

/**
 * Default hook configuration
 */
export const DEFAULT_HOOK_CONFIG: Required<
  Pick<HookConfig, 'staleTime' | 'gcTime' | 'refetchOnWindowFocus' | 'refetchOnReconnect' | 'retry'>
> = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 30, // 30 minutes
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  retry: 2,
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * Common sort fields for different entities
 */
export const SORT_FIELDS = {
  services: ['name', 'type', 'createdAt', 'updatedAt'] as const,
  contracts: ['consumer', 'provider', 'status', 'createdAt', 'lastActivity'] as const,
  fixtures: ['status', 'createdAt', 'service', 'operation'] as const,
  interactions: ['timestamp', 'consumer', 'provider', 'status', 'duration'] as const,
  deployments: ['service', 'environment', 'deployedAt', 'status'] as const,
  verification: ['status', 'submittedAt', 'provider', 'consumer'] as const,
} as const

/**
 * URL parameter handling helpers
 */
export interface URLParamConfig<T> {
  key: string
  defaultValue?: T
  serializer?: (value: T) => string
  deserializer?: (value: string) => T
  validate?: (value: T) => boolean
}

/**
 * Batch operation types
 */
export interface BatchOperation<T> {
  items: T[]
  operation: 'create' | 'update' | 'delete'
  confirmationRequired?: boolean
}

/**
 * Export configuration for data export functionality
 */
export interface ExportConfig {
  format: 'json' | 'csv' | 'xlsx'
  fields?: string[]
  filters?: Record<string, unknown>
  filename?: string
}

/**
 * Extended verification result type for UI components
 * Includes computed fields and metadata returned by API but not in core VerificationResults type
 */
export interface ExtendedVerificationResult extends VerificationResults {
  id: string
  provider: string
  version?: string // Provider version
  submittedAt: string
  status: 'passed' | 'failed'
  total: number
  passed: number
  failed: number
  createdAt?: string
  lastRun?: string
  providerGitSha?: string | null
  providerGitRepositoryUrl?: string | null
  consumerGitSha?: string | null
  consumerGitRepositoryUrl?: string | null
  contractId?: string | null
}
