/**
 * Contracts data hooks with optimistic updates and caching
 */

import type { ClientInteraction, Contract } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
import { createOptimisticMutationOptions, defaultQueryOptions } from '../lib/queryClient'
import { getInvalidationQueries, queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  ContractFilters,
  ContractStatistics,
  HookConfig,
  HookState,
  ListHookState,
  MutationHookState,
  MutationOptions,
  QueryOptions,
} from '../lib/types'
import { contractApi } from '../utils/api'

/**
 * Hook to get all contracts with filtering and pagination
 */
export function useContracts(
  filters?: ContractFilters & { offset?: number },
  options?: HookConfig
): ListHookState<Contract, ContractStatistics> {
  const mergedOptions = mergeHookConfig(options)
  const limit = filters?.limit || 10
  const offset = filters?.offset || 0

  const query = useQuery({
    queryKey: queryKeys.contracts.list({ ...filters, limit, offset }),
    queryFn: () =>
      contractApi.getAll({
        provider: filters?.provider,
        consumer: filters?.consumer,
        environment: filters?.environment,
        status: filters?.status,
        limit,
        offset,
      }),
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
 * Hook to get contracts by provider
 */
export function useContractsByProvider(
  provider: string,
  options?: HookConfig
): ListHookState<Contract, ContractStatistics> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.contracts.byProvider(provider),
    queryFn: () => contractApi.getByProvider(provider),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!provider,
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
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.results?.length || 0,
    statistics: query.data?.statistics,
  }
}

/**
 * Hook to get contracts by consumer
 */
export function useContractsByConsumer(
  consumer: string,
  options?: HookConfig
): ListHookState<Contract> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.contracts.byConsumer(consumer),
    queryFn: () => contractApi.getByConsumer(consumer),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!consumer,
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
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.results?.length || 0,
  }
}

/**
 * Hook to get a single contract by ID
 */
export function useContract(id: string, options?: HookConfig): HookState<Contract> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => contractApi.getById(id),
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
 * Hook to get interactions for a specific contract
 */
export function useContractInteractions(
  contractId: string,
  limit?: number,
  options?: HookConfig
): ListHookState<ClientInteraction> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.contracts.interactions(contractId, { limit }),
    queryFn: () => contractApi.getInteractions(contractId, limit),
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
    isEmpty: !query.data || query.data.length === 0,
    totalCount: query.data?.length,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

// Contracts are read-only - updated via background tasks

/**
 * Hook to prefetch contract data for performance
 */
export function usePrefetchContract() {
  const queryClient = useQueryClient()

  const prefetchContract = useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.contracts.detail(id),
        queryFn: () => contractApi.getById(id),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchContractInteractions = useCallback(
    (contractId: string, limit?: number) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.contracts.interactions(contractId, { limit }),
        queryFn: () => contractApi.getInteractions(contractId, limit),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchContractsByProvider = useCallback(
    (provider: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.contracts.byProvider(provider),
        queryFn: () => contractApi.getByProvider(provider),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchContractsByConsumer = useCallback(
    (consumer: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.contracts.byConsumer(consumer),
        queryFn: () => contractApi.getByConsumer(consumer),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  return {
    prefetchContract,
    prefetchContractInteractions,
    prefetchContractsByProvider,
    prefetchContractsByConsumer,
  }
}

/**
 * Hook to invalidate contract-related caches
 */
export function useInvalidateContracts() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
  }, [queryClient])

  const invalidateContract = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) })
    },
    [queryClient]
  )

  const invalidateByProvider = useCallback(
    (provider: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.byProvider(provider) })
    },
    [queryClient]
  )

  const invalidateByConsumer = useCallback(
    (consumer: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.byConsumer(consumer) })
    },
    [queryClient]
  )

  const invalidateContractInteractions = useCallback(
    (contractId: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.interactions(contractId),
      })
    },
    [queryClient]
  )

  return {
    invalidateAll,
    invalidateContract,
    invalidateByProvider,
    invalidateByConsumer,
    invalidateContractInteractions,
  }
}

/**
 * Hook for real-time contract updates (WebSocket integration)
 * This will be implemented when WebSocket functionality is added
 */
export function useContractSubscription(contractId?: string) {
  // Placeholder for future WebSocket implementation
  const subscribeToContract = useCallback((id: string) => {
    // Will implement WebSocket subscription
    console.log('Contract subscription not yet implemented for:', id)
  }, [])

  const unsubscribeFromContract = useCallback((id: string) => {
    // Will implement WebSocket unsubscription
    console.log('Contract unsubscription not yet implemented for:', id)
  }, [])

  return {
    subscribeToContract,
    unsubscribeFromContract,
    isConnected: false, // Will be real state when WebSocket is implemented
  }
}

/**
 * Hook to get contract summary statistics
 */
export function useContractStats(filters?: ContractFilters, options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)

  // This is a derived query that calculates stats from the contracts list
  const contractsQuery = useContracts(filters, mergedOptions)

  const stats = React.useMemo(() => {
    if (!contractsQuery.data) return undefined

    const contracts = contractsQuery.data
    const totalContracts = contracts.length
    const activeContracts = contracts.filter(c => c.status === 'active').length
    const archivedContracts = contracts.filter(c => c.status === 'archived').length
    const deprecatedContracts = contracts.filter(c => c.status === 'deprecated').length

    const contractsByStatus = Object.entries(
      contracts.reduce(
        (acc, contract) => {
          acc[contract.status] = (acc[contract.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([status, count]) => ({ status, count }))

    const contractsByProvider = Object.entries(
      contracts.reduce(
        (acc, contract) => {
          acc[contract.providerName] = (acc[contract.providerName] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([provider, count]) => ({ provider, count }))

    const contractsByConsumer = Object.entries(
      contracts.reduce(
        (acc, contract) => {
          acc[contract.consumerName] = (acc[contract.consumerName] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([consumer, count]) => ({ consumer, count }))

    return {
      totalContracts,
      activeContracts,
      archivedContracts,
      deprecatedContracts,
      contractsByStatus,
      contractsByProvider,
      contractsByConsumer,
    }
  }, [contractsQuery.data])

  return {
    data: stats,
    isLoading: contractsQuery.isLoading,
    isError: contractsQuery.isError,
    error: contractsQuery.error,
    isFetching: contractsQuery.isFetching,
    isSuccess: contractsQuery.isSuccess,
    refetch: contractsQuery.refetch,
  }
}
