/**
 * Verification data hooks with caching and state management
 */

import type { VerificationResults, VerificationResult, VerificationTask } from '@entente/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  ExtendedVerificationResult,
  HookConfig,
  HookState,
  ListHookState,
  VerificationFilters,
} from '../lib/types'
import { verificationApi } from '../utils/api'

/**
 * Hook to get all verification results with pagination
 */
export function useVerificationResults(
  options?: HookConfig & { limit?: number; offset?: number; startDate?: string; endDate?: string }
): ListHookState<ExtendedVerificationResult> {
  const mergedOptions = mergeHookConfig(options)
  const limit = options?.limit || 10
  const offset = options?.offset || 0
  const startDate = options?.startDate
  const endDate = options?.endDate

  const query = useQuery({
    queryKey: queryKeys.verification.list(limit, offset, startDate, endDate),
    queryFn: () => verificationApi.getAll(limit, offset, startDate, endDate),
    ...defaultQueryOptions,
    ...mergedOptions,
    placeholderData: previousData => previousData, // Keep previous data during refetch
  })

  return {
    data: query.data?.results || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data?.results || query.data.results.length === 0,
    totalCount: query.data?.totalCount || 0,
    hasNextPage: query.data ? offset + limit < query.data.totalCount : false,
    hasPreviousPage: offset > 0,
    currentPage: Math.floor(offset / limit) + 1,
    pageSize: limit,
    statistics: query.data?.statistics,
  }
}

/**
 * Hook to get a single verification result by ID
 */
export function useVerificationResult(
  id: string,
  options?: HookConfig
): HookState<VerificationResults> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.detail(id),
    queryFn: () => verificationApi.getById(id),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!id,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  }
}

/**
 * Hook to get verification results by provider
 */
export function useVerificationsByProvider(
  provider: string,
  options?: HookConfig
): ListHookState<ExtendedVerificationResult> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.byProvider(provider),
    queryFn: () => verificationApi.getByProvider(provider),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!provider,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to get verification results by consumer
 */
export function useVerificationsByConsumer(
  consumer: string,
  options?: HookConfig
): ListHookState<ExtendedVerificationResult> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.byConsumer(consumer),
    queryFn: () => verificationApi.getByConsumer(consumer),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!consumer,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to get verification tasks for a provider
 */
export function useVerificationTasks(
  provider: string,
  options?: HookConfig
): ListHookState<VerificationTask> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.tasks(provider),
    queryFn: () => verificationApi.getTasks(provider),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!provider,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to get all pending verification tasks
 */
export function usePendingVerificationTasks(options?: HookConfig): ListHookState<VerificationTask> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.pendingTasks(),
    queryFn: () => verificationApi.getPendingTasks(),
    ...defaultQueryOptions,
    ...mergedOptions,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to get verification results for a specific contract
 */
export function useVerificationsByContract(
  contractId: string,
  options?: HookConfig
): HookState<{
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
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.byContract(contractId),
    queryFn: () => verificationApi.getByContract(contractId),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!contractId,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  }
}

/**
 * Hook to get verification statistics for a provider
 */
export function useVerificationStats(
  provider: string,
  options?: HookConfig
): HookState<{
  totalTasks: number
  passedTasks: number
  failedTasks: number
  pendingTasks: number
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.stats(provider),
    queryFn: () => verificationApi.getStats(provider),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!provider,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  }
}

/**
 * Hook to get overall verification statistics
 */
export function useOverallVerificationStats(options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)

  // This combines data from multiple queries
  const resultsQuery = useVerificationResults(mergedOptions)
  const pendingTasksQuery = usePendingVerificationTasks(mergedOptions)

  const stats = React.useMemo(() => {
    if (!resultsQuery.data || !pendingTasksQuery.data) return undefined

    const results = resultsQuery.data
    const totalResults = results.length
    const passedResults = results.filter(r => r.status === 'passed').length
    const failedResults = results.filter(r => r.status === 'failed').length
    const pendingTasks = pendingTasksQuery.data.length

    // Recent results (last 10)
    const recentResults = results
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 10)

    // Results by provider
    const resultsByProvider = Object.entries(
      results.reduce(
        (acc, result) => {
          const provider = result.provider
          if (!acc[provider]) {
            acc[provider] = { passed: 0, failed: 0, total: 0 }
          }
          acc[provider].total += 1
          if (result.status === 'passed') {
            acc[provider].passed += 1
          } else if (result.status === 'failed') {
            acc[provider].failed += 1
          }
          return acc
        },
        {} as Record<string, { passed: number; failed: number; total: number }>
      )
    ).map(([provider, stats]) => ({ provider, ...stats }))

    // Results by status
    const resultsByStatus = Object.entries(
      results.reduce(
        (acc, result) => {
          acc[result.status] = (acc[result.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([status, count]) => ({ status, count }))

    return {
      totalResults,
      passedResults,
      failedResults,
      pendingTasks,
      recentResults,
      resultsByProvider,
      resultsByStatus,
    }
  }, [resultsQuery.data, pendingTasksQuery.data])

  return {
    data: stats,
    isLoading: resultsQuery.isLoading || pendingTasksQuery.isLoading,
    isError: resultsQuery.isError || pendingTasksQuery.isError,
    error: (resultsQuery.error || pendingTasksQuery.error) as ApiError | null,
    isFetching: resultsQuery.isFetching || pendingTasksQuery.isFetching,
    isSuccess: resultsQuery.isSuccess && pendingTasksQuery.isSuccess,
    refetch: () => {
      resultsQuery.refetch()
      pendingTasksQuery.refetch()
    },
  }
}

/**
 * Hook to get latest verification status for all contracts
 */
export function useVerificationLatest(
  detail?: boolean,
  options?: HookConfig
): ListHookState<{
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
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.verification.latest(detail),
    queryFn: () => verificationApi.getLatest(detail),
    ...defaultQueryOptions,
    ...mergedOptions,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length || 0,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to invalidate verification-related caches
 */
export function useInvalidateVerifications() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.verification.all })
  }, [queryClient])

  const invalidateResult = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.detail(id) })
    },
    [queryClient]
  )

  const invalidateByProvider = useCallback(
    (provider: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byProvider(provider) })
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.tasks(provider) })
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.stats(provider) })
    },
    [queryClient]
  )

  const invalidateByConsumer = useCallback(
    (consumer: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byConsumer(consumer) })
    },
    [queryClient]
  )

  const invalidateByContract = useCallback(
    (contractId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byContract(contractId) })
    },
    [queryClient]
  )

  const invalidatePendingTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.verification.pendingTasks() })
  }, [queryClient])

  const invalidateLatest = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.verification.latest() })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateResult,
    invalidateByProvider,
    invalidateByConsumer,
    invalidateByContract,
    invalidatePendingTasks,
    invalidateLatest,
  }
}
