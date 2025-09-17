/**
 * GitHub Integration hooks with caching and state management
 */

import type { GitHubAppInstallation, GitHubAppInstallationUpdate } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { githubSettingsApi } from '../utils/api'
import { queryKeys, getInvalidationQueries } from '../lib/queryKeys'
import { createOptimisticMutationOptions, defaultQueryOptions } from '../lib/queryClient'
import type { QueryOptions, MutationOptions, HookState, MutationHookState, HookConfig, ApiError, OptimisticContext } from '../lib/types'
import { mergeHookConfig } from '../lib/hookUtils'

/**
 * Hook to get GitHub app name
 */
export function useGitHubAppName(
  options?: HookConfig
): HookState<{ appName: string }> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.github.appName(),
    queryFn: githubSettingsApi.getAppName,
    ...defaultQueryOptions,
    ...mergedOptions,
    staleTime: 1000 * 60 * 60, // 1 hour - app name rarely changes
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
 * Hook to get GitHub app installation
 */
export function useGitHubInstallation(
  options?: HookConfig
): HookState<GitHubAppInstallation | null> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.github.installation(),
    queryFn: githubSettingsApi.getInstallation,
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
 * Hook to get GitHub manage URL
 */
export function useGitHubManageUrl(
  options?: HookConfig
): HookState<{ manageUrl: string }> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.github.manageUrl(),
    queryFn: githubSettingsApi.getManageUrl,
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
 * Hook to update GitHub installation settings
 */
export function useUpdateGitHubInstallation(
  options?: MutationOptions<GitHubAppInstallation, GitHubAppInstallationUpdate>
): MutationHookState<GitHubAppInstallation, GitHubAppInstallationUpdate> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: githubSettingsApi.updateInstallation,
    onSuccess: () => {
      // Invalidate installation data on success
      queryClient.invalidateQueries({ queryKey: queryKeys.github.installation() })
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
 * Hook to uninstall GitHub app
 */
export function useUninstallGitHubApp(
  options?: MutationOptions<{ success: boolean }, void>
): MutationHookState<{ success: boolean }, void> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: githubSettingsApi.uninstallApp,
    onSuccess: () => {
      // Clear installation data immediately on successful uninstall
      queryClient.setQueryData(queryKeys.github.installation(), null)
      // Invalidate GitHub queries
      queryClient.invalidateQueries({ queryKey: queryKeys.github.all })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as unknown as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
    isPending: mutation.isPending,
    variables: mutation.variables,
  }
}

/**
 * Hook to invalidate GitHub-related caches
 */
export function useInvalidateGitHub() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.github.all })
  }, [queryClient])

  const invalidateInstallation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.github.installation() })
  }, [queryClient])

  const invalidateAppName = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.github.appName() })
  }, [queryClient])

  const invalidateManageUrl = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.github.manageUrl() })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateInstallation,
    invalidateAppName,
    invalidateManageUrl,
  }
}