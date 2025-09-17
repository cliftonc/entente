/**
 * API Keys data hooks with optimistic updates and caching
 */

import type { ApiKey, CreateKeyRequest } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { keysApi } from '../utils/api'
import { queryKeys, getInvalidationQueries } from '../lib/queryKeys'
import { defaultQueryOptions } from '../lib/queryClient'
import type {
  QueryOptions,
  MutationOptions,
  HookState,
  ListHookState,
  MutationHookState,
  HookConfig,
  ApiError,
} from '../lib/types'
import { mergeHookConfig } from '../lib/hookUtils'

/**
 * Hook to get all API keys
 */
export function useApiKeys(includeRevoked?: boolean, options?: HookConfig): ListHookState<ApiKey> {
  const mergedOptions = mergeHookConfig(options)
  const { staleTime: _defaultStaleTime, ...baseQueryOptions } = defaultQueryOptions
  const { staleTime: _ignoredStaleTime, ...safeMerged } = mergedOptions || {}

  const query = useQuery({
    queryKey: queryKeys.apiKeys.list(includeRevoked),
    queryFn: () => keysApi.getAll(includeRevoked),
    ...baseQueryOptions,
    staleTime: 1000 * 10,
    ...safeMerged,
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
 * Hook to get a single API key by ID
 */
export function useApiKey(id: string, options?: HookConfig): HookState<ApiKey> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.apiKeys.detail(id),
    queryFn: () => keysApi.getById(id),
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
 * Hook to create a new API key
 */
export function useCreateApiKey(
  options?: MutationOptions<ApiKey, CreateKeyRequest>
): MutationHookState<ApiKey, CreateKeyRequest> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['apiKeys', 'create'] as const,
    mutationFn: keysApi.create,
    onSuccess: () => {
      // Invalidate and refetch all API key queries after successful creation
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.lists(),
        refetchType: 'active',
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
    isPending: mutation.isPending,
    variables: mutation.variables,
  }
}

/**
 * Hook to rotate an API key
 */
export function useRotateApiKey(
  options?: MutationOptions<ApiKey, string>
): MutationHookState<ApiKey, string> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['apiKeys', 'rotate'] as const,
    mutationFn: keysApi.rotate,
    onSuccess: () => {
      // Invalidate and refetch all API key queries after successful rotation
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.lists(),
        refetchType: 'active',
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
    isPending: mutation.isPending,
    variables: mutation.variables,
  }
}

/**
 * Hook to revoke an API key
 */
export function useRevokeApiKey(
  options?: MutationOptions<{ success: boolean }, { id: string; revokedBy: string }>
): MutationHookState<{ success: boolean }, { id: string; revokedBy: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['apiKeys', 'revoke'] as const,
    mutationFn: ({ id, revokedBy }) => keysApi.revoke(id, revokedBy),
    onSuccess: () => {
      // Invalidate and refetch all API key queries after successful revocation
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.lists(),
        refetchType: 'active',
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
    isPending: mutation.isPending,
    variables: mutation.variables,
  }
}

/**
 * Hook to prefetch API key data for performance
 */
export function usePrefetchApiKey() {
  const queryClient = useQueryClient()

  const prefetchApiKey = useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.apiKeys.detail(id),
        queryFn: () => keysApi.getById(id),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  return {
    prefetchApiKey,
  }
}

/**
 * Hook to invalidate API key-related caches
 */
export function useInvalidateApiKeys() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all })
  }, [queryClient])

  const invalidateApiKey = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.detail(id) })
    },
    [queryClient]
  )

  return {
    invalidateAll,
    invalidateApiKey,
  }
}
