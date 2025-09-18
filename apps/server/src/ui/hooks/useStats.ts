/**
 * Statistics and dashboard data hooks
 */

import type { DeploymentState } from '@entente/types'
import { useQuery } from '@tanstack/react-query'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type { ApiError, HookConfig, HookState } from '../lib/types'
import { statsApi } from '../utils/api'

/**
 * Hook to get dashboard statistics
 */
export function useDashboardStats(options?: HookConfig): HookState<{
  totalServices: number
  totalInteractions: number
  pendingFixtures: number
  verificationRate: number
  recentDeployments: DeploymentState[]
  serviceHealth: Array<{
    service: string
    name: string // Service name (alias for service for backward compatibility)
    type?: 'consumer' | 'provider' // Service type
    status: 'healthy' | 'warning' | 'critical'
    lastDeployment?: string
    errorRate?: number
    interactions?: number // Number of interactions for this service
    passRate?: number // Pass rate percentage for this service
  }>
}> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: () => statsApi.getDashboard(),
    ...defaultQueryOptions,
    ...mergedOptions,
    staleTime: mergedOptions.staleTime ?? 1000 * 60 * 2, // 2 minutes for dashboard stats
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
