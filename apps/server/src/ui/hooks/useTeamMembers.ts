/**
 * Team management hooks with caching and state management
 */

import type { InviteTeamMemberRequest, TeamMember } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { mergeHookConfig } from '../lib/hookUtils'
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
} from '../lib/types'
import { teamApi } from '../utils/api'

/**
 * Hook to get team members
 */
export function useTeamMembers(options?: HookConfig): ListHookState<TeamMember> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.team.members(),
    queryFn: teamApi.getMembers,
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
 * Hook to invite a team member
 */
export function useInviteTeamMember(
  options?: MutationOptions<{ success: boolean }, InviteTeamMemberRequest>
): MutationHookState<{ success: boolean }, InviteTeamMemberRequest> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: teamApi.inviteMember,
    onSuccess: () => {
      // Refetch team members to show pending invitations immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(), refetchType: 'active' })
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
 * Hook to update team member role
 */
export function useUpdateTeamMemberRole(
  options?: MutationOptions<{ success: boolean }, { userId: string; role: 'admin' | 'member' }>
): MutationHookState<{ success: boolean }, { userId: string; role: 'admin' | 'member' }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ userId, role }) => teamApi.updateMemberRole(userId, role),
    onSuccess: () => {
      // Invalidate and refetch team members on success
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(), refetchType: 'active' })
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
 * Hook to remove team member
 */
export function useRemoveTeamMember(
  options?: MutationOptions<{ success: boolean }, string>
): MutationHookState<{ success: boolean }, string> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: teamApi.removeMember,
    onSuccess: () => {
      // Invalidate and refetch team members on success
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(), refetchType: 'active' })
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
 * Hook to resend team member invitation
 */
export function useResendTeamInvite(
  options?: MutationOptions<{ success: boolean }, string>
): MutationHookState<{ success: boolean }, string> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: teamApi.resendInvite,
    onSuccess: () => {
      // Invalidate and refetch team members on success
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(), refetchType: 'active' })
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
 * Hook to invalidate team-related caches
 */
export function useInvalidateTeam() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.team.all })
  }, [queryClient])

  const invalidateMembers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.team.members() })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateMembers,
  }
}
