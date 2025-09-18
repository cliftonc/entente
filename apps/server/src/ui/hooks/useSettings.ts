/**
 * Settings data hooks with optimistic updates and caching
 */

import type { TenantSettings, TenantSettingsUpdate } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
import { createOptimisticMutationOptions, defaultQueryOptions } from '../lib/queryClient'
import { getInvalidationQueries, queryKeys } from '../lib/queryKeys'
import type {
  ApiError,
  HookConfig,
  HookState,
  MutationHookState,
  MutationOptions,
  QueryOptions,
} from '../lib/types'
import { settingsApi, tenantApi } from '../utils/api'

/**
 * Hook to get tenant settings
 */
export function useSettings(options?: HookConfig): HookState<TenantSettings> {
  const mergedOptions = mergeHookConfig(options)
  const { staleTime: _defaultStaleTime, ...baseQueryOptions } = defaultQueryOptions
  const { staleTime: _ignoredStaleTime, ...safeMerged } = mergedOptions || {}

  const query = useQuery({
    queryKey: queryKeys.settings.detail(),
    queryFn: settingsApi.get,
    ...baseQueryOptions,
    staleTime: 1000 * 10,
    ...safeMerged,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as unknown as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  }
}

/**
 * Hook to update tenant settings
 */
export function useUpdateSettings(
  options?: MutationOptions<TenantSettings, TenantSettingsUpdate>
): MutationHookState<TenantSettings, TenantSettingsUpdate> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      // Invalidate and refetch settings queries on success
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.detail(),
        refetchType: 'active',
      })

      // If tenant name was updated, we need to refresh the auth context
      // to pick up the updated tenant information without a page reload
      if (mutation.variables?.tenantName) {
        // Refresh the auth session to get updated tenant info
        fetch('/auth/session', {
          credentials: 'include',
        })
          .then(response => response.json())
          .then(data => {
            if (data.authenticated) {
              // Trigger a custom event that the auth context can listen to
              window.dispatchEvent(new CustomEvent('auth-refresh', { detail: data }))
            }
          })
          .catch(error => {
            console.error('Failed to refresh auth session:', error)
          })
      }
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to create a new tenant
 */
export function useCreateTenant(
  options?: MutationOptions<{ success: boolean }, { name: string }>
): MutationHookState<{ success: boolean }, { name: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: tenantApi.create,
    onSuccess: () => {
      // Clear all queries since we're switching to a new tenant
      queryClient.clear()
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as unknown as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to delete a tenant
 */
export function useDeleteTenant(
  options?: MutationOptions<
    { success: boolean; logout?: boolean },
    { slug: string; confirm: string }
  >
): MutationHookState<{ success: boolean; logout?: boolean }, { slug: string; confirm: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: tenantApi.delete,
    onSuccess: () => {
      // Clear all queries since tenant context has changed
      queryClient.clear()
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as unknown as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to invalidate settings-related caches
 */
export function useInvalidateSettings() {
  const queryClient = useQueryClient()

  const invalidateSettings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
  }, [queryClient])

  return {
    invalidateSettings,
  }
}
