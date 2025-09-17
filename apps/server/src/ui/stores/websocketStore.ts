import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { WebSocketEvent } from '../lib/types'
import { websocketHelpers } from '../lib/queryClient'
import { queryKeys, getInvalidationQueries } from '../lib/queryKeys'

/**
 * WebSocket store for real-time features
 *
 * This store manages WebSocket connections and real-time updates.
 * It integrates with TanStack Query to automatically update cached data
 * when real-time events are received.
 */

interface WebSocketState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  lastPingTime: string | null
  reconnectAttempts: number
  maxReconnectAttempts: number

  // Subscriptions
  subscriptions: Set<string>
  subscribedEntities: {
    services: Set<string>
    contracts: Set<string>
    fixtures: Set<string>
    deployments: Set<string>
    verifications: Set<string>
  }

  // Events
  lastEvent: WebSocketEvent | null
  eventHistory: WebSocketEvent[]
  maxHistorySize: number

  // Configuration
  config: {
    autoReconnect: boolean
    reconnectDelay: number
    heartbeatInterval: number
    maxEventHistory: number
  }
}

interface WebSocketActions {
  // Connection management
  connect: () => Promise<void>
  disconnect: () => void
  reconnect: () => Promise<void>
  setConnectionState: (state: 'connected' | 'connecting' | 'disconnected') => void
  setConnectionError: (error: string | null) => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void

  // Subscription management
  subscribe: (channel: string) => void
  unsubscribe: (channel: string) => void
  subscribeToEntity: (entityType: keyof WebSocketState['subscribedEntities'], entityId: string) => void
  unsubscribeFromEntity: (entityType: keyof WebSocketState['subscribedEntities'], entityId: string) => void
  clearSubscriptions: () => void

  // Event handling
  handleEvent: (event: WebSocketEvent) => void
  addEventToHistory: (event: WebSocketEvent) => void
  clearEventHistory: () => void
  updateLastPingTime: () => void

  // Configuration
  updateConfig: (config: Partial<WebSocketState['config']>) => void
}

type WebSocketStore = WebSocketState & WebSocketActions

let websocketInstance: WebSocket | null = null

const initialState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  lastPingTime: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  subscriptions: new Set(),
  subscribedEntities: {
    services: new Set(),
    contracts: new Set(),
    fixtures: new Set(),
    deployments: new Set(),
    verifications: new Set(),
  },
  lastEvent: null,
  eventHistory: [],
  maxHistorySize: 100,
  config: {
    autoReconnect: true,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    maxEventHistory: 100,
  },
}

export const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Connection management
      connect: async () => {
        const state = get()
        if (state.isConnected || state.isConnecting) return

        set({ isConnecting: true, connectionError: null }, false, 'connect')

        try {
          // Determine WebSocket URL based on environment
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const host = window.location.host
          const wsUrl = `${protocol}//${host}/ws`

          websocketInstance = new WebSocket(wsUrl)

          websocketInstance.onopen = () => {
            const { resetReconnectAttempts, setConnectionState, updateLastPingTime } = get()
            setConnectionState('connected')
            resetReconnectAttempts()
            updateLastPingTime()

            // Resubscribe to all previous subscriptions
            const { subscriptions } = get()
            subscriptions.forEach(channel => {
              websocketInstance?.send(JSON.stringify({
                type: 'subscribe',
                channel,
              }))
            })

            console.log('WebSocket connected')
          }

          websocketInstance.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data) as WebSocketEvent
              get().handleEvent(data)
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error)
            }
          }

          websocketInstance.onclose = () => {
            const { config, reconnectAttempts, maxReconnectAttempts, incrementReconnectAttempts } = get()
            set({ isConnected: false, isConnecting: false }, false, 'disconnect')

            console.log('WebSocket disconnected')

            // Auto-reconnect if enabled and under retry limit
            if (config.autoReconnect && reconnectAttempts < maxReconnectAttempts) {
              incrementReconnectAttempts()
              setTimeout(() => {
                get().reconnect()
              }, config.reconnectDelay * Math.pow(2, reconnectAttempts)) // Exponential backoff
            }
          }

          websocketInstance.onerror = (error) => {
            console.error('WebSocket error:', error)
            set({ connectionError: 'WebSocket connection failed' }, false, 'connectionError')
          }

        } catch (error) {
          set({
            isConnecting: false,
            connectionError: error instanceof Error ? error.message : 'Connection failed'
          }, false, 'connectError')
        }
      },

      disconnect: () => {
        if (websocketInstance) {
          websocketInstance.close()
          websocketInstance = null
        }
        set({
          isConnected: false,
          isConnecting: false,
          connectionError: null,
        }, false, 'disconnect')
      },

      reconnect: async () => {
        get().disconnect()
        await get().connect()
      },

      setConnectionState: (state) => {
        const updates: Partial<WebSocketState> = { isConnecting: false }

        if (state === 'connected') {
          updates.isConnected = true
        } else if (state === 'connecting') {
          updates.isConnecting = true
          updates.isConnected = false
        } else {
          updates.isConnected = false
        }

        set(updates, false, `setConnectionState.${state}`)
      },

      setConnectionError: (error) => {
        set({ connectionError: error }, false, 'setConnectionError')
      },

      incrementReconnectAttempts: () => {
        set(state => ({ reconnectAttempts: state.reconnectAttempts + 1 }), false, 'incrementReconnectAttempts')
      },

      resetReconnectAttempts: () => {
        set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts')
      },

      // Subscription management
      subscribe: (channel) => {
        set(state => ({
          subscriptions: new Set([...state.subscriptions, channel])
        }), false, 'subscribe')

        if (websocketInstance?.readyState === WebSocket.OPEN) {
          websocketInstance.send(JSON.stringify({
            type: 'subscribe',
            channel,
          }))
        }
      },

      unsubscribe: (channel) => {
        set(state => {
          const newSubscriptions = new Set(state.subscriptions)
          newSubscriptions.delete(channel)
          return { subscriptions: newSubscriptions }
        }, false, 'unsubscribe')

        if (websocketInstance?.readyState === WebSocket.OPEN) {
          websocketInstance.send(JSON.stringify({
            type: 'unsubscribe',
            channel,
          }))
        }
      },

      subscribeToEntity: (entityType, entityId) => {
        set(state => ({
          subscribedEntities: {
            ...state.subscribedEntities,
            [entityType]: new Set([...state.subscribedEntities[entityType], entityId])
          }
        }), false, `subscribeToEntity.${entityType}`)

        get().subscribe(`${entityType}:${entityId}`)
      },

      unsubscribeFromEntity: (entityType, entityId) => {
        set(state => {
          const newEntitySet = new Set(state.subscribedEntities[entityType])
          newEntitySet.delete(entityId)
          return {
            subscribedEntities: {
              ...state.subscribedEntities,
              [entityType]: newEntitySet
            }
          }
        }, false, `unsubscribeFromEntity.${entityType}`)

        get().unsubscribe(`${entityType}:${entityId}`)
      },

      clearSubscriptions: () => {
        const { subscriptions } = get()
        subscriptions.forEach(channel => {
          get().unsubscribe(channel)
        })
        set({
          subscriptions: new Set(),
          subscribedEntities: {
            services: new Set(),
            contracts: new Set(),
            fixtures: new Set(),
            deployments: new Set(),
            verifications: new Set(),
          }
        }, false, 'clearSubscriptions')
      },

      // Event handling
      handleEvent: (event) => {
        set({ lastEvent: event }, false, 'handleEvent')
        get().addEventToHistory(event)

        // Update TanStack Query cache based on event
        try {
          switch (event.entity) {
            case 'service':
              if (event.action === 'create' || event.action === 'update') {
                websocketHelpers.updateItemInList(queryKeys.services.lists(), event.data as { id: string })
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(queryKeys.services.lists(), (event.data as { id: string }).id)
              }
              websocketHelpers.invalidateFromWebSocket(getInvalidationQueries.services.onServiceChange((event.data as { name: string }).name) as readonly (readonly string[])[])
              break

            case 'contract':
              if (event.action === 'create' || event.action === 'update') {
                websocketHelpers.updateItemInList(queryKeys.contracts.lists(), event.data as { id: string })
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(queryKeys.contracts.lists(), (event.data as { id: string }).id)
              }
              websocketHelpers.invalidateFromWebSocket(getInvalidationQueries.contracts.onContractChange((event.data as { id: string; provider: string; consumer: string }).id, (event.data as { id: string; provider: string; consumer: string }).provider, (event.data as { id: string; provider: string; consumer: string }).consumer) as readonly (readonly string[])[])
              break

            case 'fixture':
              if (event.action === 'create' || event.action === 'update' || event.action === 'status_change') {
                websocketHelpers.updateItemInList(queryKeys.fixtures.lists(), event.data as { id: string })
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(queryKeys.fixtures.lists(), (event.data as { id: string }).id)
              }
              websocketHelpers.invalidateFromWebSocket(getInvalidationQueries.fixtures.onFixtureChange((event.data as { id: string; service: string }).id, (event.data as { id: string; service: string }).service) as readonly (readonly string[])[])
              break

            case 'deployment':
              websocketHelpers.invalidateFromWebSocket(getInvalidationQueries.deployments.onDeploymentChange((event.data as { service: string; environment: string }).service, (event.data as { service: string; environment: string }).environment) as readonly (readonly string[])[])
              break

            case 'verification':
              websocketHelpers.invalidateFromWebSocket(getInvalidationQueries.verification.onVerificationChange((event.data as { provider: string; consumer: string; contractId: string }).provider, (event.data as { provider: string; consumer: string; contractId: string }).consumer, (event.data as { provider: string; consumer: string; contractId: string }).contractId) as readonly (readonly string[])[])
              break

            default:
              console.log('Unknown WebSocket event entity:', event.entity)
          }
        } catch (error) {
          console.error('Error handling WebSocket event:', error)
        }
      },

      addEventToHistory: (event) => {
        set(state => {
          const newHistory = [event, ...state.eventHistory].slice(0, state.config.maxEventHistory)
          return { eventHistory: newHistory }
        }, false, 'addEventToHistory')
      },

      clearEventHistory: () => {
        set({ eventHistory: [] }, false, 'clearEventHistory')
      },

      updateLastPingTime: () => {
        set({ lastPingTime: new Date().toISOString() }, false, 'updateLastPingTime')
      },

      // Configuration
      updateConfig: (config) => {
        set(state => ({
          config: { ...state.config, ...config }
        }), false, 'updateConfig')
      },
    }),
    { name: 'websocket-store' }
  )
)

// Helper hook for easy WebSocket integration
export function useWebSocket() {
  const store = useWebSocketStore()

  const subscribeToService = (serviceId: string) => {
    store.subscribeToEntity('services', serviceId)
  }

  const subscribeToContract = (contractId: string) => {
    store.subscribeToEntity('contracts', contractId)
  }

  const subscribeToFixture = (fixtureId: string) => {
    store.subscribeToEntity('fixtures', fixtureId)
  }

  return {
    ...store,
    subscribeToService,
    subscribeToContract,
    subscribeToFixture,
  }
}