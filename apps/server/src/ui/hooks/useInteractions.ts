/**
 * Interactions data hooks with caching and state management
 */

import type { ClientInteraction } from '@entente/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  HookConfig,
  HookState,
  InteractionFilters,
  ListHookState,
  QueryOptions,
} from '../lib/types'
import { interactionApi } from '../utils/api'

/**
 * Hook to get all interactions with filtering
 */
export function useInteractions(
  filters?: InteractionFilters,
  options?: HookConfig
): ListHookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.list(filters),
    queryFn: () =>
      interactionApi.getAll({
        provider: filters?.provider,
        consumer: filters?.consumer,
        environment: filters?.environment,
        limit: filters?.limit,
      }),
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
 * Hook to get a single interaction by ID
 */
export function useInteraction(id: string, options?: HookConfig): HookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.detail(id),
    queryFn: () => interactionApi.getById(id),
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
 * Hook to get interactions by service
 */
export function useInteractionsByService(
  service: string,
  version?: string,
  options?: HookConfig
): ListHookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.byService(service, version),
    queryFn: () => interactionApi.getByService(service, version || 'latest'),
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
 * Hook to get interactions by consumer
 */
export function useInteractionsByConsumer(
  consumer: string,
  version?: string,
  options?: HookConfig
): ListHookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.byConsumer(consumer, version),
    queryFn: () => interactionApi.getByConsumer(consumer, version),
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
 * Hook to get interactions by provider
 */
export function useInteractionsByProvider(
  provider: string,
  filters?: InteractionFilters,
  options?: HookConfig
): ListHookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.byProvider(provider, filters),
    queryFn: () =>
      interactionApi.getAll({
        provider,
        consumer: filters?.consumer,
        environment: filters?.environment,
        limit: filters?.limit,
      }),
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
 * Hook to get interaction statistics for a service
 */
export function useInteractionStats(
  service: string,
  version?: string,
  options?: HookConfig
): HookState<{
  totalInteractions: number
  uniqueConsumers: number
  averageDuration: number
  operationBreakdown: Array<{ operation: string; count: number }>
  consumerBreakdown: Array<{ consumer: string; count: number }>
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.interactions.stats(service, version),
    queryFn: () => interactionApi.getStats(service, version || 'latest'),
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
  }
}

/**
 * Hook to get overall interaction statistics
 */
export function useOverallInteractionStats(filters?: InteractionFilters, options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)

  // This is a derived query that calculates stats from the interactions list
  const interactionsQuery = useInteractions(filters, mergedOptions)

  const stats = React.useMemo(() => {
    if (!interactionsQuery.data) return undefined

    const interactions = interactionsQuery.data
    const totalInteractions = interactions.length
    const uniqueProviders = new Set(interactions.map(i => i.provider || i.service).filter(Boolean))
      .size
    const uniqueConsumers = new Set(interactions.map(i => i.consumer)).size

    // Recent interactions (last 20)
    const recentInteractions = interactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)

    // Interactions by status
    const interactionsByStatus = Object.entries(
      interactions.reduce(
        (acc, interaction) => {
          const status = interaction.status || 'unknown'
          acc[status] = (acc[status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([status, count]) => ({ status, count }))

    // Interactions by provider
    const interactionsByProvider = Object.entries(
      interactions.reduce(
        (acc, interaction) => {
          const provider = interaction.provider || interaction.service
          if (provider) {
            acc[provider] = (acc[provider] || 0) + 1
          }
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([provider, count]) => ({ provider, count }))

    // Interactions by consumer
    const interactionsByConsumer = Object.entries(
      interactions.reduce(
        (acc, interaction) => {
          acc[interaction.consumer] = (acc[interaction.consumer] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([consumer, count]) => ({ consumer, count }))

    // Interactions by environment
    const interactionsByEnvironment = Object.entries(
      interactions.reduce(
        (acc, interaction) => {
          const env = interaction.environment || 'unknown'
          acc[env] = (acc[env] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([environment, count]) => ({ environment, count }))

    // Interaction trends (last 7 days)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const interactionTrends = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]

      const dayInteractions = interactions.filter(interaction => {
        const interactionDate = new Date(interaction.timestamp).toISOString().split('T')[0]
        return interactionDate === dateStr
      })

      const count = dayInteractions.length
      const successCount = dayInteractions.filter(i => i.status === 'success').length
      const successRate = count > 0 ? (successCount / count) * 100 : 0

      return { date: dateStr, count, successRate }
    })

    return {
      totalInteractions,
      uniqueProviders,
      uniqueConsumers,
      recentInteractions,
      interactionsByStatus,
      interactionsByProvider,
      interactionsByConsumer,
      interactionsByEnvironment,
      interactionTrends,
    }
  }, [interactionsQuery.data])

  return {
    data: stats,
    isLoading: interactionsQuery.isLoading,
    isError: interactionsQuery.isError,
    error: interactionsQuery.error as ApiError | null,
    isFetching: interactionsQuery.isFetching,
    isSuccess: interactionsQuery.isSuccess,
    refetch: interactionsQuery.refetch,
  }
}

/**
 * Hook to invalidate interaction-related caches
 */
export function useInvalidateInteractions() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.interactions.all })
  }, [queryClient])

  const invalidateInteraction = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.detail(id) })
    },
    [queryClient]
  )

  const invalidateByService = useCallback(
    (service: string, version?: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interactions.byService(service, version),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.stats(service, version) })
    },
    [queryClient]
  )

  const invalidateByConsumer = useCallback(
    (consumer: string, version?: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interactions.byConsumer(consumer, version),
      })
    },
    [queryClient]
  )

  const invalidateByProvider = useCallback(
    (provider: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interactions.byProvider(provider) })
    },
    [queryClient]
  )

  return {
    invalidateAll,
    invalidateInteraction,
    invalidateByService,
    invalidateByConsumer,
    invalidateByProvider,
  }
}

/**
 * Hook to prefetch interaction data for performance
 */
export function usePrefetchInteraction() {
  const queryClient = useQueryClient()

  const prefetchInteraction = useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.interactions.detail(id),
        queryFn: () => interactionApi.getById(id),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchInteractionsByService = useCallback(
    (service: string, version?: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.interactions.byService(service, version),
        queryFn: () => interactionApi.getByService(service, version || 'latest'),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchInteractionStats = useCallback(
    (service: string, version?: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.interactions.stats(service, version),
        queryFn: () => interactionApi.getStats(service, version || 'latest'),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  return {
    prefetchInteraction,
    prefetchInteractionsByService,
    prefetchInteractionStats,
  }
}
