/**
 * Deployments data hooks with caching and state management
 */

import type { DeploymentState } from '@entente/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  DeploymentEnvironmentBreakdown,
  DeploymentFilters,
  DeploymentStatistics,
  HookConfig,
  HookState,
  ListHookState,
  QueryOptions,
} from '../lib/types'
import { deploymentApi } from '../utils/api'

/**
 * Hook to get active deployments for an environment
 */
export function useActiveDeployments(
  environment?: string,
  options?: HookConfig
): ListHookState<DeploymentState> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.deployments.active(environment),
    queryFn: () => deploymentApi.getActive(environment),
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
 * Hook to get deployment summary statistics
 */
export function useDeploymentSummary(options?: HookConfig): HookState<{
  totalDeployments: number
  activeDeployments: number
  environments: string[]
  environmentBreakdown?: Array<{
    environment: string
    count: number
  }>
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.deployments.summary(),
    queryFn: () => deploymentApi.getSummary(),
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
  }
}

/**
 * Hook to get deployment history for a service
 */
export function useDeploymentHistory(
  service: string,
  environment?: string,
  options?: HookConfig
): ListHookState<DeploymentState> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.deployments.history(service, environment),
    queryFn: () => deploymentApi.getHistory(service, environment),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!service,
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
 * Hook to get available environments
 */
export function useEnvironments(options?: HookConfig): ListHookState<string> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.deployments.environments(),
    queryFn: () => deploymentApi.getEnvironments(),
    ...defaultQueryOptions,
    ...mergedOptions,
    staleTime: mergedOptions?.staleTime ?? 1000 * 60 * 10, // 10 minutes - environments change less frequently
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
 * Hook to get active deployments for all environments
 */
export function useActiveDeploymentsAllEnvs(options?: HookConfig): ListHookState<DeploymentState> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.deployments.activeForAllEnvs(),
    queryFn: () => deploymentApi.getActiveForAllEnvs(),
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
 * Hook to get deployment statistics grouped by environment
 */
export function useDeploymentStatsByEnvironment(options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)

  // This combines data from multiple queries to provide comprehensive stats
  const deploymentsQuery = useActiveDeploymentsAllEnvs(mergedOptions)
  const environmentsQuery = useEnvironments(mergedOptions)

  const stats = React.useMemo(() => {
    if (!deploymentsQuery.data || !environmentsQuery.data) return undefined

    const deploymentsByEnv = deploymentsQuery.data.reduce(
      (acc, deployment) => {
        const env = deployment.environment
        if (!acc[env]) {
          acc[env] = []
        }
        acc[env].push(deployment)
        return acc
      },
      {} as Record<string, DeploymentState[]>
    )

    const environments = environmentsQuery.data.map(envName => {
      const envDeployments = deploymentsByEnv[envName] || []
      const activeDeployments = envDeployments.filter(d => d.status === 'successful').length
      const services = [...new Set(envDeployments.map(d => d.service))]
      const lastDeployment = envDeployments.sort(
        (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
      )[0]?.deployedAt

      return {
        name: envName,
        totalDeployments: envDeployments.length,
        activeDeployments,
        services,
        lastDeployment,
      }
    })

    return { environments }
  }, [deploymentsQuery.data, environmentsQuery.data])

  return {
    data: stats,
    isLoading: deploymentsQuery.isLoading || environmentsQuery.isLoading,
    isError: deploymentsQuery.isError || environmentsQuery.isError,
    error: deploymentsQuery.error || environmentsQuery.error,
    isFetching: deploymentsQuery.isFetching || environmentsQuery.isFetching,
    isSuccess: deploymentsQuery.isSuccess && environmentsQuery.isSuccess,
    refetch: () => {
      deploymentsQuery.refetch()
      environmentsQuery.refetch()
    },
  }
}

/**
 * Hook to invalidate deployment-related caches
 */
export function useInvalidateDeployments() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deployments.all })
  }, [queryClient])

  const invalidateActive = useCallback(
    (environment?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deployments.active(environment) })
    },
    [queryClient]
  )

  const invalidateHistory = useCallback(
    (service: string, environment?: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deployments.history(service, environment),
      })
    },
    [queryClient]
  )

  const invalidateSummary = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deployments.summary() })
  }, [queryClient])

  const invalidateEnvironments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deployments.environments() })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateActive,
    invalidateHistory,
    invalidateSummary,
    invalidateEnvironments,
  }
}

/**
 * Hook to get paginated deployments with filters
 */
export function usePaginatedDeployments(
  options?: HookConfig & {
    limit?: number
    offset?: number
    status?: string
    provider?: string
    consumer?: string
    environment?: string
  }
): ListHookState<DeploymentState, DeploymentStatistics, DeploymentEnvironmentBreakdown> {
  const mergedOptions = mergeHookConfig(options)
  const limit = options?.limit || 10
  const offset = options?.offset || 0
  const status = options?.status
  const provider = options?.provider
  const consumer = options?.consumer
  const environment = options?.environment

  const query = useQuery({
    queryKey: queryKeys.deployments.paginated(limit, offset, {
      status,
      provider,
      consumer,
      environment,
    }),
    queryFn: () =>
      deploymentApi.getPaginated({
        limit,
        offset,
        status,
        provider,
        consumer,
        environment,
      }),
    ...defaultQueryOptions,
    ...mergedOptions,
    // Remove placeholderData to prevent stale data during filter changes
    // placeholderData: (previousData) => previousData,
    refetchOnMount: true, // Always refetch when component mounts
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
    environmentBreakdown: query.data?.environmentBreakdown,
  }
}
