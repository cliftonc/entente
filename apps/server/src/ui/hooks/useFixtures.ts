/**
 * Fixtures data hooks with approval workflows and optimistic updates
 */

import type { Fixture } from '@entente/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { fixtureApi } from '../utils/api'
import { queryKeys, getInvalidationQueries } from '../lib/queryKeys'
import { defaultQueryOptions } from '../lib/queryClient'
import type {
  FixtureFilters,
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
 * Hook to get all fixtures with filtering
 */
export function useFixtures(
  filters?: FixtureFilters,
  options?: HookConfig
): ListHookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.list(
      filters as Record<string, string | number | boolean | undefined>
    ),
    queryFn: () =>
      fixtureApi.getAll({
        service: filters?.service,
        provider: filters?.provider,
        consumer: filters?.consumer,
        status: filters?.status,
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
 * Hook to get pending fixtures (requiring approval)
 */
export function usePendingFixtures(service?: string, options?: HookConfig): ListHookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.pending(service),
    queryFn: () => fixtureApi.getPending(service),
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
 * Hook to get services fixture summary (counts per status) from API
 */
export function useFixtureServicesSummary(options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)
  const query = useQuery({
    queryKey: queryKeys.fixtures.servicesSummary(),
    queryFn: () => fixtureApi.getServicesSummary(),
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
  }
}

/**
 * Hook to get draft fixtures count (for dashboard/navigation badges)
 */
export function useDraftFixturesCount(options?: HookConfig): HookState<number> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.drafts(),
    queryFn: async () => {
      const fixtures = await fixtureApi.getAll({ status: 'draft' })
      return fixtures.length
    },
    ...defaultQueryOptions,
    ...mergedOptions,
    staleTime: mergedOptions.staleTime ?? 1000 * 30, // 30 seconds for count queries
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
 * Hook to get fixtures by service
 */
export function useFixturesByService(
  service: string,
  status?: string,
  options?: HookConfig
): ListHookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.byService(service, status),
    queryFn: () => fixtureApi.getByService(service, status),
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
 * Hook to get all fixtures for a service (all statuses combined)
 */
export function useAllFixturesByService(
  service: string,
  options?: HookConfig
): ListHookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.byService(service, 'all'),
    queryFn: () => fixtureApi.getAllByService(service),
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
 * Hook to get fixtures by operation
 */
export function useFixturesByOperation(
  operation: string,
  service: string,
  version: string,
  options?: HookConfig
): ListHookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.byOperation(operation, service, version),
    queryFn: () => fixtureApi.getByOperation(operation, service, version),
    ...defaultQueryOptions,
    ...mergedOptions,
    enabled: !!operation && !!service && !!version,
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
 * Hook to get a single fixture by ID
 */
export function useFixture(id: string, options?: HookConfig): HookState<Fixture> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.fixtures.detail(id),
    queryFn: () => fixtureApi.getById(id),
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
 * Hook to approve a fixture
 */
export function useApproveFixture(
  options?: MutationOptions<
    { success: boolean },
    { id: string; approvedBy: string; notes?: string }
  >
): MutationHookState<{ success: boolean }, { id: string; approvedBy: string; notes?: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['fixtures', 'approve'] as const,
    mutationFn: ({ id, approvedBy, notes }) => fixtureApi.approve(id, approvedBy, notes),
    onSuccess: () => {
      // Invalidate all fixture queries after successful approval
      getInvalidationQueries.fixtures.onFixtureChange().forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to reject a fixture
 */
export function useRejectFixture(
  options?: MutationOptions<
    { success: boolean },
    { id: string; rejectedBy: string; notes?: string }
  >
): MutationHookState<{ success: boolean }, { id: string; rejectedBy: string; notes?: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['fixtures', 'reject'] as const,
    mutationFn: ({ id, rejectedBy, notes }) => fixtureApi.reject(id, rejectedBy, notes),
    onSuccess: () => {
      // Invalidate all fixture queries after successful rejection
      getInvalidationQueries.fixtures.onFixtureChange().forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to revoke a fixture (for approved fixtures)
 */
export function useRevokeFixture(
  options?: MutationOptions<{ success: boolean }, { id: string; revokedBy: string; notes?: string }>
): MutationHookState<{ success: boolean }, { id: string; revokedBy: string; notes?: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['fixtures', 'revoke'] as const,
    mutationFn: ({ id, revokedBy, notes }) => fixtureApi.revoke(id, revokedBy, notes),
    onSuccess: () => {
      // Invalidate all fixture queries after successful revocation
      getInvalidationQueries.fixtures.onFixtureChange().forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to approve all pending fixtures for a service
 */
export function useApproveAllFixtures(
  options?: MutationOptions<{ success: boolean }[], { fixtures: Fixture[]; approvedBy: string }>
): MutationHookState<{ success: boolean }[], { fixtures: Fixture[]; approvedBy: string }> {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: ['fixtures', 'approve-all'] as const,
    mutationFn: async ({ fixtures, approvedBy }) => {
      const promises = fixtures.map(fixture => fixtureApi.approve(fixture.id, approvedBy))
      return Promise.all(promises)
    },
    onSuccess: () => {
      // Invalidate all fixture queries after successful approval
      getInvalidationQueries.fixtures.onFixtureChange().forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
    },
    ...options,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    variables: mutation.variables,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error as ApiError | null,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook to prefetch fixture data for performance
 */
export function usePrefetchFixture() {
  const queryClient = useQueryClient()

  const prefetchFixture = useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.fixtures.detail(id),
        queryFn: () => fixtureApi.getById(id),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  const prefetchFixturesByService = useCallback(
    (service: string, status?: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.fixtures.byService(service, status),
        queryFn: () => fixtureApi.getByService(service, status),
        staleTime: defaultQueryOptions.staleTime,
      })
    },
    [queryClient]
  )

  return {
    prefetchFixture,
    prefetchFixturesByService,
  }
}

/**
 * Hook to invalidate fixture-related caches
 */
export function useInvalidateFixtures() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.fixtures.all })
  }, [queryClient])

  const invalidateFixture = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixtures.detail(id) })
    },
    [queryClient]
  )

  const invalidateByService = useCallback(
    (service: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixtures.byService(service) })
    },
    [queryClient]
  )

  const invalidatePending = useCallback(
    (service?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fixtures.pending(service) })
    },
    [queryClient]
  )

  const invalidateDrafts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.fixtures.drafts() })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateFixture,
    invalidateByService,
    invalidatePending,
    invalidateDrafts,
  }
}

/**
 * Hook to get fixture statistics
 */
export function useFixtureStats(filters?: FixtureFilters, options?: HookConfig) {
  const mergedOptions = mergeHookConfig(options)

  // This is a derived query that calculates stats from the fixtures list
  const fixturesQuery = useFixtures(filters, mergedOptions)

  const stats = useMemo(() => {
    if (!fixturesQuery.data) return undefined

    const fixtures = fixturesQuery.data
    const totalFixtures = fixtures.length
    const draftFixtures = fixtures.filter(f => f.status === 'draft').length
    const approvedFixtures = fixtures.filter(f => f.status === 'approved').length
    const rejectedFixtures = fixtures.filter(f => f.status === 'rejected').length

    const fixturesByStatus = Object.entries(
      fixtures.reduce(
        (acc, fixture) => {
          acc[fixture.status] = (acc[fixture.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([status, count]) => ({ status, count }))

    const fixturesByService = Object.entries(
      fixtures.reduce(
        (acc, fixture) => {
          const service = fixture.service || 'Unknown'
          acc[service] = (acc[service] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([service, count]) => ({ service, count }))

    return {
      totalFixtures,
      draftFixtures,
      approvedFixtures,
      rejectedFixtures,
      fixturesByStatus,
      fixturesByService,
    }
  }, [fixturesQuery.data])

  return {
    data: stats,
    isLoading: fixturesQuery.isLoading,
    isError: fixturesQuery.isError,
    error: fixturesQuery.error as ApiError | null,
    isFetching: fixturesQuery.isFetching,
    isSuccess: fixturesQuery.isSuccess,
    refetch: fixturesQuery.refetch,
  }
}
