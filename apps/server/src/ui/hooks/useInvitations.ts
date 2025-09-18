/**
 * Invitation management hooks with caching and state management
 */

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
import { invitationApi } from '../utils/api'

/**
 * Hook to get invitation details by token
 */
export function useInvitationDetails(
  token: string,
  options?: HookConfig
): HookState<{ invitation: any }> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.invitations.details(token),
    queryFn: () => invitationApi.getDetails(token),
    ...defaultQueryOptions,
    ...mergedOptions,
    retry: false, // Don't retry failed invitation lookups
    enabled: !!token && (mergedOptions.enabled ?? true),
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
 * Hook to accept an invitation
 */
export function useAcceptInvitation(
  options?: MutationOptions<
    { success: boolean; requiresAuth?: boolean; loginUrl?: string; message?: string },
    string
  >
): MutationHookState<
  { success: boolean; requiresAuth?: boolean; loginUrl?: string; message?: string },
  string
> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: invitationApi.accept,
    onSuccess: (data, token) => {
      // Clear the invitation details since it's now accepted
      queryClient.removeQueries({ queryKey: queryKeys.invitations.details(token) })
      // Invalidate related queries
      getInvalidationQueries.invitations.onAccept().forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
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
 * Hook to invalidate invitation-related caches
 */
export function useInvalidateInvitations() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all })
  }, [queryClient])

  const invalidateDetails = useCallback(
    (token: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.details(token) })
    },
    [queryClient]
  )

  const removeDetails = useCallback(
    (token: string) => {
      queryClient.removeQueries({ queryKey: queryKeys.invitations.details(token) })
    },
    [queryClient]
  )

  return {
    invalidateAll,
    invalidateDetails,
    removeDetails,
  }
}
