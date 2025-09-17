/**
 * Utility functions and helpers for data hooks
 */

import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  BaseFilters,
  OptimisticContext,
  URLParamConfig,
  SortConfig,
  HookConfig,
  InvalidationStrategy,
} from './types'
import { DEFAULT_HOOK_CONFIG } from './types'

/**
 * Hook for managing URL search parameters with type safety
 */
export function useURLParams<T extends Record<string, unknown>>(
  configs: Record<keyof T, URLParamConfig<T[keyof T]>>
): [T, (updates: Partial<T>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => {
    const result = {} as T

    for (const [key, config] of Object.entries(configs)) {
      const paramValue = searchParams.get(config.key)

      if (paramValue !== null) {
        const deserializedValue = config.deserializer
          ? config.deserializer(paramValue)
          : paramValue

        if (!config.validate || config.validate(deserializedValue as T[keyof T])) {
          result[key as keyof T] = deserializedValue as T[keyof T]
        } else {
          result[key as keyof T] = config.defaultValue as T[keyof T]
        }
      } else {
        result[key as keyof T] = config.defaultValue as T[keyof T]
      }
    }

    return result
  }, [searchParams, configs])

  const updateParams = useCallback((updates: Partial<T>) => {
    const newParams = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(updates)) {
      const config = configs[key as keyof T]

      if (value === undefined || value === config.defaultValue) {
        newParams.delete(config.key)
      } else {
        const serializedValue = config.serializer
          ? config.serializer(value)
          : String(value)
        newParams.set(config.key, serializedValue)
      }
    }

    setSearchParams(newParams)
  }, [searchParams, setSearchParams, configs])

  const clearParams = useCallback(() => {
    setSearchParams({})
  }, [setSearchParams])

  return [params, updateParams, clearParams]
}

/**
 * Hook for managing filters with URL synchronization
 */
export function useFilters<T extends BaseFilters>(
  initialFilters: T,
  urlConfig?: Record<keyof T, URLParamConfig<T[keyof T]>>
): [T, (updates: Partial<T>) => void, () => void] {
  const hasUrlConfig = !!urlConfig

  // Use URL params if config is provided
  const [urlParams, updateUrlParams, clearUrlParams] = useURLParams(
    urlConfig || {} as Record<keyof T, URLParamConfig<T[keyof T]>>
  )

  const filters = hasUrlConfig ? urlParams : initialFilters
  const updateFilters = hasUrlConfig ? updateUrlParams : () => {}
  const clearFilters = hasUrlConfig ? clearUrlParams : () => {}

  return [filters, updateFilters, clearFilters]
}

/**
 * Hook for managing sorting state
 */
export function useSort<T extends string>(
  defaultSort?: SortConfig,
  allowedFields?: readonly T[]
): [SortConfig | undefined, (field: T) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const sort = useMemo(() => {
    const sortField = searchParams.get('sort')
    const sortDirection = searchParams.get('direction') as 'asc' | 'desc' | null

    if (sortField && (!allowedFields || allowedFields.includes(sortField as T))) {
      return {
        field: sortField,
        direction: sortDirection || 'asc',
      } as SortConfig
    }

    return defaultSort
  }, [searchParams, defaultSort, allowedFields])

  const updateSort = useCallback((field: T) => {
    const newParams = new URLSearchParams(searchParams)
    const currentField = searchParams.get('sort')
    const currentDirection = searchParams.get('direction')

    if (currentField === field) {
      // Toggle direction if same field
      const newDirection = currentDirection === 'asc' ? 'desc' : 'asc'
      newParams.set('direction', newDirection)
    } else {
      // New field, default to asc
      newParams.set('sort', field)
      newParams.set('direction', 'asc')
    }

    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  const clearSort = useCallback(() => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('sort')
    newParams.delete('direction')
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  return [sort, updateSort, clearSort]
}

/**
 * Hook for managing pagination state
 */
export function usePagination(defaultPageSize = 50): [
  { page: number; pageSize: number },
  (page: number) => void,
  (pageSize: number) => void,
  () => void
] {
  const [searchParams, setSearchParams] = useSearchParams()

  const pagination = useMemo(() => {
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10)

    return {
      page: Math.max(1, page),
      pageSize: Math.max(1, pageSize),
    }
  }, [searchParams, defaultPageSize])

  const setPage = useCallback((page: number) => {
    const newParams = new URLSearchParams(searchParams)
    if (page > 1) {
      newParams.set('page', String(page))
    } else {
      newParams.delete('page')
    }
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  const setPageSize = useCallback((pageSize: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('pageSize', String(pageSize))
    newParams.delete('page') // Reset to first page when changing page size
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  const resetPagination = useCallback(() => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('page')
    newParams.delete('pageSize')
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  return [pagination, setPage, setPageSize, resetPagination]
}

/**
 * Utility to merge hook configurations with defaults
 */
export function mergeHookConfig(config?: HookConfig): Required<HookConfig> {
  return {
    ...DEFAULT_HOOK_CONFIG,
    enabled: true,
    suspense: false,
    useErrorBoundary: false,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...config,
  }
}

/**
 * Optimistic update helper for lists
 */
export function createOptimisticListUpdater<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  operation: 'add' | 'update' | 'remove'
) {
  return {
    onMutate: async (variables: T | { id: string } | string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<T[]>(queryKey)

      // Optimistically update to the new value
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        if (!old) return []

        switch (operation) {
          case 'add':
            return [variables as T, ...old]

          case 'update':
            return old.map(item =>
              item.id === (variables as T).id ? { ...item, ...(variables as T) } : item
            )

          case 'remove':
            const idToRemove = typeof variables === 'string' ? variables : (variables as { id: string }).id
            return old.filter(item => item.id !== idToRemove)

          default:
            return old
        }
      })

      return { previousData }
    },

    onError: (_error: unknown, _variables: unknown, context: OptimisticContext<T[]> | undefined) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey })
    },
  }
}

/**
 * Cache invalidation helper
 */
export function createInvalidationHelper(queryClient: QueryClient) {
  return {
    invalidateQueries: (strategy: InvalidationStrategy) => {
      // Invalidate specified queries
      if (strategy.invalidateQueries) {
        strategy.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }

      // Update specified queries
      if (strategy.updateQueries) {
        strategy.updateQueries.forEach(({ queryKey, updater }) => {
          queryClient.setQueryData(queryKey, updater)
        })
      }

      // Remove specified queries
      if (strategy.removeQueries) {
        strategy.removeQueries.forEach(queryKey => {
          queryClient.removeQueries({ queryKey })
        })
      }
    },

    prefetchQuery: async <T>(
      queryKey: readonly unknown[],
      queryFn: () => Promise<T>,
      staleTime = 1000 * 60 * 5 // 5 minutes
    ) => {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime,
      })
    },
  }
}

/**
 * Hook to get cache invalidation helper
 */
export function useInvalidation() {
  const queryClient = useQueryClient()
  return useMemo(() => createInvalidationHelper(queryClient), [queryClient])
}

/**
 * Debounce utility for search filters
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Helper to create consistent error messages
 */
export function createErrorMessage(
  operation: string,
  entity: string,
  error: unknown
): string {
  const baseMessage = `Failed to ${operation} ${entity}`

  if (error instanceof Error) {
    return `${baseMessage}: ${error.message}`
  }

  if (typeof error === 'string') {
    return `${baseMessage}: ${error}`
  }

  return `${baseMessage}: An unexpected error occurred`
}

/**
 * Helper to create success messages
 */
export function createSuccessMessage(operation: string, entity: string): string {
  const entityName = entity.charAt(0).toUpperCase() + entity.slice(1)

  switch (operation) {
    case 'create':
      return `${entityName} created successfully`
    case 'update':
      return `${entityName} updated successfully`
    case 'delete':
      return `${entityName} deleted successfully`
    case 'approve':
      return `${entityName} approved successfully`
    case 'reject':
      return `${entityName} rejected successfully`
    default:
      return `${entityName} ${operation} completed successfully`
  }
}

/**
 * Transform filters to query string parameters
 */
export function filtersToQueryParams<T extends BaseFilters>(filters: T): URLSearchParams {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })

  return params
}

/**
 * Check if data is stale based on timestamp
 */
export function isStale(timestamp: number, staleTime: number): boolean {
  return Date.now() - timestamp > staleTime
}

/**
 * Format query key for debugging
 */
export function formatQueryKey(queryKey: readonly unknown[]): string {
  return queryKey
    .map(key => typeof key === 'object' ? JSON.stringify(key) : String(key))
    .join(' > ')
}