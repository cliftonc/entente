/**
 * Hook for fetching and managing recent verification data for dashboard visualization
 */

import { useQuery } from '@tanstack/react-query'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type { ApiError, HookConfig, HookState } from '../lib/types'
import { verificationApi } from '../utils/api'

export interface RecentVerification {
  id: string
  submittedAt: Date
  status: 'passed' | 'failed'
  provider: string
  consumer?: string
  passed: number
  failed: number
  total: number
}

/**
 * Hook to get recent verification results for the dashboard verification bar
 */
export function useRecentVerifications(
  options?: HookConfig & { days?: number; limit?: number }
): HookState<RecentVerification[]> {
  const mergedOptions = mergeHookConfig(options)
  const days = options?.days || 30
  const limit = options?.limit || 1000

  const query = useQuery({
    queryKey: queryKeys.verification.recent(days, limit),
    queryFn: () => verificationApi.getRecent(days, limit),
    ...defaultQueryOptions,
    ...mergedOptions,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  }
}
