import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Application store for client-side state management
 *
 * Note: Server state (services, fixtures, interactions, etc.) is now managed
 * by TanStack Query through custom hooks. This store only contains UI state
 * and application-level client state.
 */

interface AppState {
  // Navigation and selection state
  selectedService: string | null
  selectedContract: string | null
  selectedEnvironment: string | null

  // Global UI preferences
  globalFilters: {
    environment?: string
    timeRange?: {
      start: string
      end: string
    }
  }

  // Feature flags and settings
  features: {
    enableRealTimeUpdates: boolean
    enableAdvancedFiltering: boolean
    enableBulkOperations: boolean
  }

  // Application state
  isOnline: boolean
  lastSyncTime: string | null
}

interface AppActions {
  // Selection actions
  setSelectedService: (serviceId: string | null) => void
  setSelectedContract: (contractId: string | null) => void
  setSelectedEnvironment: (environment: string | null) => void

  // Global filter actions
  setGlobalEnvironment: (environment: string | undefined) => void
  setGlobalTimeRange: (start: string, end: string) => void
  clearGlobalTimeRange: () => void

  // Feature flag actions
  toggleFeature: (feature: keyof AppState['features']) => void
  setFeature: (feature: keyof AppState['features'], enabled: boolean) => void

  // Application state actions
  setOnlineStatus: (isOnline: boolean) => void
  updateLastSyncTime: () => void

  // Utility actions
  resetState: () => void
}

type AppStore = AppState & AppActions

const initialState: AppState = {
  selectedService: null,
  selectedContract: null,
  selectedEnvironment: null,
  globalFilters: {},
  features: {
    enableRealTimeUpdates: false, // Will be enabled when WebSocket is implemented
    enableAdvancedFiltering: true,
    enableBulkOperations: true,
  },
  isOnline: navigator.onLine,
  lastSyncTime: null,
}

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Selection actions
      setSelectedService: serviceId =>
        set({ selectedService: serviceId }, false, 'setSelectedService'),

      setSelectedContract: contractId =>
        set({ selectedContract: contractId }, false, 'setSelectedContract'),

      setSelectedEnvironment: environment =>
        set({ selectedEnvironment: environment }, false, 'setSelectedEnvironment'),

      // Global filter actions
      setGlobalEnvironment: environment =>
        set(
          state => ({
            globalFilters: { ...state.globalFilters, environment },
          }),
          false,
          'setGlobalEnvironment'
        ),

      setGlobalTimeRange: (start, end) =>
        set(
          state => ({
            globalFilters: { ...state.globalFilters, timeRange: { start, end } },
          }),
          false,
          'setGlobalTimeRange'
        ),

      clearGlobalTimeRange: () =>
        set(
          state => {
            const { timeRange, ...restFilters } = state.globalFilters
            return { globalFilters: restFilters }
          },
          false,
          'clearGlobalTimeRange'
        ),

      // Feature flag actions
      toggleFeature: feature =>
        set(
          state => ({
            features: { ...state.features, [feature]: !state.features[feature] },
          }),
          false,
          `toggleFeature.${feature}`
        ),

      setFeature: (feature, enabled) =>
        set(
          state => ({
            features: { ...state.features, [feature]: enabled },
          }),
          false,
          `setFeature.${feature}`
        ),

      // Application state actions
      setOnlineStatus: isOnline => set({ isOnline }, false, 'setOnlineStatus'),

      updateLastSyncTime: () =>
        set({ lastSyncTime: new Date().toISOString() }, false, 'updateLastSyncTime'),

      // Utility actions
      resetState: () => set(initialState, false, 'resetState'),
    }),
    { name: 'app-store' }
  )
)

// Subscribe to online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnlineStatus(true)
  })

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnlineStatus(false)
  })
}
