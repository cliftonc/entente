/**
 * Services data hooks with optimistic updates and caching
 */

import type { Service, ServiceVersion } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createOptimisticListUpdater, mergeHookConfig } from '../lib/hookUtils'
import { createOptimisticMutationOptions, defaultQueryOptions } from '../lib/queryClient'
import { getInvalidationQueries, queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  HookConfig,
  HookState,
  ListHookState,
  MutationHookState,
  MutationOptions,
  QueryOptions,
  ServiceFilters,
} from '../lib/types'
import { serviceApi, serviceVersionApi } from '../utils/api'

/**
 * Hook to get all services with filtering
 */
export function useServices(
  filters?: ServiceFilters,
  options?: HookConfig
): ListHookState<Service> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: () => serviceApi.getAll(filters?.type),
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
    hasNextPage: false, // Simple pagination for now
    hasPreviousPage: false,
    currentPage: 1,
    pageSize: query.data?.length || 0,
  }
}

/**
 * Hook to get consumer services
 */
export function useConsumers(options?: HookConfig): ListHookState<Service> {
  return useServices({ type: 'consumer' }, options)
}

/**
 * Hook to get provider services
 */
export function useProviders(options?: HookConfig): ListHookState<Service> {
  return useServices({ type: 'provider' }, options)
}

/**
 * Hook to get a single service by name and type
 */
export function useService(
  name: string,
  type: 'consumer' | 'provider',
  options?: HookConfig
): HookState<Service> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.services.detail(name, type),
    queryFn: () => serviceApi.getOne(name, type),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!name && !!type,
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
 * Hook to get service versions
 */
export function useServiceVersions(
  serviceName: string,
  options?: HookConfig
): ListHookState<ServiceVersion> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.serviceVersions.byService(serviceName),
    queryFn: () => serviceVersionApi.getByService(serviceName),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!serviceName,
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
 * Hook to get a specific service version
 */
export function useServiceVersion(id: string, options?: HookConfig): HookState<ServiceVersion> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.serviceVersions.detail(id),
    queryFn: () => serviceVersionApi.getById(id),
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

// Services are read-only - created via background tasks

// Services are read-only - updated via background tasks

// Services are read-only - deleted via background tasks

/**
 * Hook to prefetch service data for performance
 */
export function usePrefetchService() {
  const queryClient = useQueryClient()

  const prefetchService = useCallback(
    (name: string, type: 'consumer' | 'provider') => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.services.detail(name, type),
        queryFn: () => serviceApi.getOne(name, type),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchServiceVersions = useCallback(
    (serviceName: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.serviceVersions.byService(serviceName),
        queryFn: () => serviceVersionApi.getByService(serviceName),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  return {
    prefetchService,
    prefetchServiceVersions,
  }
}

/**
 * Hook to invalidate service-related caches
 */
export function useInvalidateServices() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
  }, [queryClient])

  const invalidateService = useCallback(
    (name: string, type: 'consumer' | 'provider') => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.detail(name, type) })
    },
    [queryClient]
  )

  const invalidateServiceVersions = useCallback(
    (serviceName: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceVersions.byService(serviceName) })
    },
    [queryClient]
  )

  return {
    invalidateAll,
    invalidateService,
    invalidateServiceVersions,
  }
}
