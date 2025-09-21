/**
 * System view data hooks for optimized visualization data
 */

import type {
  SystemViewFilters,
  SystemViewService,
  SystemViewContract,
  SystemViewOperation,
  SystemViewData
} from '@entente/types'

// Re-export for convenience
export type { SystemViewFilters }
import { useQuery } from '@tanstack/react-query'
import { mergeHookConfig } from '../lib/hookUtils'
import { defaultQueryOptions } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import type { ApiError, HookConfig, HookState } from '../lib/types'
import { systemViewApi } from '../utils/api'

/**
 * Hook to get optimized system view data for visualization
 */
export function useSystemView(
  filters?: SystemViewFilters,
  options?: HookConfig
): HookState<SystemViewData> {
  const mergedOptions = mergeHookConfig(options)

  const query = useQuery({
    queryKey: queryKeys.systemView.data(filters as Record<string, string | number | boolean | undefined>),
    queryFn: () => systemViewApi.getData(filters),
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