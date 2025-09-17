import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import type { OptimisticContext } from './types'

/**
 * DaisyUI toast notification helper
 */
const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  const toast = document.createElement('div')
  toast.className = 'toast toast-end'

  const alertClass = `alert alert-${type}`
  const iconPath = getIconPath(type)

  toast.innerHTML = `
    <div class="${alertClass}">
      <svg class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        ${iconPath}
      </svg>
      <span>${message}</span>
    </div>
  `

  document.body.appendChild(toast)

  // Remove toast after 5 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast)
    }
  }, 5000)
}

const getIconPath = (type: string): string => {
  switch (type) {
    case 'success':
      return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
    case 'error':
      return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
    case 'warning':
      return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"></path>'
    default:
      return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
  }
}

/**
 * Enhanced error handling for queries
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    // Only show toast for foreground errors to avoid spam
    if (query.state.fetchStatus === 'fetching') return

    const errorMessage = error instanceof Error ? error.message : 'An error occurred'

    // Show user-friendly error messages
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      showToast('Your session has expired. Please log in again.', 'error')
      // Redirect to login or refresh auth
      window.location.href = '/auth/github'
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      showToast('You do not have permission to perform this action.', 'error')
    } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      showToast('The requested resource was not found.', 'error')
    } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
      showToast('A server error occurred. Please try again later.', 'error')
    } else if (errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch')) {
      showToast('Network error. Please check your connection and try again.', 'error')
    } else {
      // Generic error for other cases
      showToast('An unexpected error occurred. Please try again.', 'error')
    }

    // Log detailed error information for debugging
    console.error('Query error:', {
      queryKey: query.queryKey,
      error: error,
      meta: query.meta,
    })
  },
})

/**
 * Enhanced error handling and success notifications for mutations
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'

    // Show appropriate error message based on mutation type
    const mutationKey = mutation.options.mutationKey?.[0] as string

    if (mutationKey?.includes('create')) {
      showToast(`Failed to create ${getMutationEntityName(mutationKey)}: ${errorMessage}`, 'error')
    } else if (mutationKey?.includes('update')) {
      showToast(`Failed to update ${getMutationEntityName(mutationKey)}: ${errorMessage}`, 'error')
    } else if (mutationKey?.includes('delete')) {
      showToast(`Failed to delete ${getMutationEntityName(mutationKey)}: ${errorMessage}`, 'error')
    } else {
      showToast(`Operation failed: ${errorMessage}`, 'error')
    }

    // Log detailed mutation error
    console.error('Mutation error:', {
      mutationKey: mutation.options.mutationKey,
      error: error,
      variables: _variables,
    })
  },

  onSuccess: (_data, _variables, _context, mutation) => {
    const mutationKey = mutation.options.mutationKey?.[0] as string

    // Show success messages for certain operations
    if (mutationKey?.includes('create')) {
      showToast(`${getMutationEntityName(mutationKey)} created successfully`, 'success')
    } else if (mutationKey?.includes('update')) {
      showToast(`${getMutationEntityName(mutationKey)} updated successfully`, 'success')
    } else if (mutationKey?.includes('delete')) {
      showToast(`${getMutationEntityName(mutationKey)} deleted successfully`, 'success')
    } else if (mutationKey?.includes('approve')) {
      showToast('Fixture approved successfully', 'success')
    } else if (mutationKey?.includes('reject')) {
      showToast('Fixture rejected successfully', 'success')
    }
  },
})

/**
 * Helper function to extract entity name from mutation key
 */
function getMutationEntityName(mutationKey: string): string {
  if (mutationKey.includes('service')) return 'Service'
  if (mutationKey.includes('contract')) return 'Contract'
  if (mutationKey.includes('fixture')) return 'Fixture'
  if (mutationKey.includes('deployment')) return 'Deployment'
  if (mutationKey.includes('verification')) return 'Verification'
  if (mutationKey.includes('interaction')) return 'Interaction'
  if (mutationKey.includes('key')) return 'API Key'
  return 'Item'
}

/**
 * Enhanced query client with better defaults and error handling
 */
export const createQueryClient = () => {
  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        // Cache configuration
        staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh for 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache for 30 minutes

        // Error handling
        retry: (failureCount, error) => {
          // Don't retry on certain errors
          if (error instanceof Error) {
            const status = (error as any).status
            if (status === 401 || status === 403 || status === 404) {
              return false
            }
          }
          // Retry up to 2 times for other errors
          return failureCount < 2
        },
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

        // Performance optimizations
        refetchOnWindowFocus: false, // Disable refetch on window focus
        refetchOnReconnect: true, // Refetch when network reconnects
        refetchOnMount: true, // Refetch when component mounts

        // Network mode - ensure queries work offline when possible
        networkMode: 'online',
      },
      mutations: {
        // Global mutation defaults
        retry: (failureCount, error) => {
          // Don't retry mutations by default, except for network errors
          if (error instanceof Error && error.message.includes('Network Error')) {
            return failureCount < 1
          }
          return false
        },

        // Network mode for mutations
        networkMode: 'online',

        // Add mutation keys for better debugging and error handling
        mutationKey: ['mutation'],
      },
    },
  })
}

/**
 * Query client instance - will be created in App.tsx
 */
export let queryClient: QueryClient

/**
 * Initialize the query client (called from App.tsx)
 */
export const initializeQueryClient = () => {
  if (!queryClient) {
    queryClient = createQueryClient()
  }
  return queryClient
}

/**
 * Default query options for entity-specific hooks
 */
export const defaultQueryOptions = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 30, // 30 minutes
  retry: 2,
  refetchOnWindowFocus: false,
} as const

/**
 * Default mutation options with optimistic updates support
 */
export const createOptimisticMutationOptions = <TData, TVariables, TContext = OptimisticContext>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (variables: TVariables) => Promise<TContext | undefined>
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void
  invalidateQueries?: readonly (readonly string[])[]
}) => {
  const { invalidateQueries: invalidationQueries, onSettled, ...rest } = options

  return {
    ...rest,
    onSettled: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => {
      // Always invalidate specified queries after mutation
      if (invalidationQueries) {
        invalidationQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }

      // Call custom onSettled if provided
      onSettled?.(data, error, variables, context)
    },
  }
}

/**
 * WebSocket integration helpers (for future implementation)
 */
export const websocketHelpers = {
  /**
   * Update query data from WebSocket events
   */
  updateQueryFromWebSocket: <TData>(queryKey: readonly string[], updater: (old: TData | undefined) => TData) => {
    queryClient.setQueryData(queryKey, updater)
  },

  /**
   * Invalidate queries from WebSocket events
   */
  invalidateFromWebSocket: (queryKeys: readonly (readonly string[])[]) => {
    queryKeys.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey })
    })
  },

  /**
   * Add new item to list from WebSocket
   */
  addItemToList: <TItem>(queryKey: readonly string[], newItem: TItem) => {
    queryClient.setQueryData<TItem[]>(queryKey, old =>
      old ? [newItem, ...old] : [newItem]
    )
  },

  /**
   * Update item in list from WebSocket
   */
  updateItemInList: <TItem extends { id: string }>(queryKey: readonly string[], updatedItem: TItem) => {
    queryClient.setQueryData<TItem[]>(queryKey, old =>
      old?.map(item => item.id === updatedItem.id ? updatedItem : item) || []
    )
  },

  /**
   * Remove item from list from WebSocket
   */
  removeItemFromList: <TItem extends { id: string }>(queryKey: readonly string[], itemId: string) => {
    queryClient.setQueryData<TItem[]>(queryKey, old =>
      old?.filter(item => item.id !== itemId) || []
    )
  },
}

/**
 * Utility for prefetching related data
 */
export const prefetchHelpers = {
  /**
   * Prefetch service details when hovering over service links
   */
  prefetchServiceDetail: (serviceName: string, serviceType: 'consumer' | 'provider') => {
    // Implementation will be added when we create the service hooks
  },

  /**
   * Prefetch contract details when hovering over contract links
   */
  prefetchContractDetail: (contractId: string) => {
    // Implementation will be added when we create the contract hooks
  },
}