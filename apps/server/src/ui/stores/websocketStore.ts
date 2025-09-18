import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { websocketHelpers } from '../lib/queryClient'
import { getInvalidationQueries, queryKeys } from '../lib/queryKeys'
import type { WebSocketEvent } from '../lib/types'

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
  subscribeToEntity: (
    entityType: keyof WebSocketState['subscribedEntities'],
    entityId: string
  ) => void
  unsubscribeFromEntity: (
    entityType: keyof WebSocketState['subscribedEntities'],
    entityId: string
  ) => void
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

const websocketInstance: WebSocket | null = null
const isConnecting = false
const connectionId: string | null = null

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

      // Connection management - delegate to singleton (tenant ID provided by WebSocketProvider)
      connect: async () => {
        console.log(
          'WebSocket Store: This should not be called directly, use WebSocketProvider instead'
        )
        set({ connectionError: 'Connect called without tenant ID' }, false, 'connect.noTenant')
      },

      disconnect: async () => {
        console.log('WebSocket Store: Delegating disconnect to singleton')
        const { websocketClient } = await import('../lib/websocketClient')
        websocketClient.disconnect()
      },

      reconnect: async () => {
        console.log('WebSocket Store: Delegating reconnect to singleton')
        const { websocketClient } = await import('../lib/websocketClient')
        websocketClient.disconnect()
        setTimeout(() => get().connect(), 100)
      },

      setConnectionState: state => {
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

      setConnectionError: error => {
        set({ connectionError: error }, false, 'setConnectionError')
      },

      incrementReconnectAttempts: () => {
        set(
          state => ({ reconnectAttempts: state.reconnectAttempts + 1 }),
          false,
          'incrementReconnectAttempts'
        )
      },

      resetReconnectAttempts: () => {
        set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts')
      },

      // Subscription management
      subscribe: async channel => {
        set(
          state => ({
            subscriptions: new Set([...state.subscriptions, channel]),
          }),
          false,
          'subscribe'
        )

        const { websocketClient } = await import('../lib/websocketClient')
        websocketClient.send({
          type: 'subscribe',
          channel,
        })
      },

      unsubscribe: async channel => {
        set(
          state => {
            const newSubscriptions = new Set(state.subscriptions)
            newSubscriptions.delete(channel)
            return { subscriptions: newSubscriptions }
          },
          false,
          'unsubscribe'
        )

        const { websocketClient } = await import('../lib/websocketClient')
        websocketClient.send({
          type: 'unsubscribe',
          channel,
        })
      },

      subscribeToEntity: (entityType, entityId) => {
        set(
          state => ({
            subscribedEntities: {
              ...state.subscribedEntities,
              [entityType]: new Set([...state.subscribedEntities[entityType], entityId]),
            },
          }),
          false,
          `subscribeToEntity.${entityType}`
        )

        get().subscribe(`${entityType}:${entityId}`)
      },

      unsubscribeFromEntity: (entityType, entityId) => {
        set(
          state => {
            const newEntitySet = new Set(state.subscribedEntities[entityType])
            newEntitySet.delete(entityId)
            return {
              subscribedEntities: {
                ...state.subscribedEntities,
                [entityType]: newEntitySet,
              },
            }
          },
          false,
          `unsubscribeFromEntity.${entityType}`
        )

        get().unsubscribe(`${entityType}:${entityId}`)
      },

      clearSubscriptions: () => {
        const { subscriptions } = get()
        subscriptions.forEach(channel => {
          get().unsubscribe(channel)
        })
        set(
          {
            subscriptions: new Set(),
            subscribedEntities: {
              services: new Set(),
              contracts: new Set(),
              fixtures: new Set(),
              deployments: new Set(),
              verifications: new Set(),
            },
          },
          false,
          'clearSubscriptions'
        )
      },

      // Event handling
      handleEvent: event => {
        // Handle system messages (welcome, ping, pong, etc.) - don't update lastEvent for these
        if (event.type === 'welcome' || event.type === 'ping' || event.type === 'pong') {
          console.log('WebSocket: Received system message:', event.type)
          // Still add to history for debugging, but don't update lastEvent
          get().addEventToHistory(event)
          return
        }

        // Only update lastEvent for non-system messages
        console.log('WebSocket: Received business event:', event.type)
        set({ lastEvent: event }, false, 'handleEvent')
        get().addEventToHistory(event)

        // Update TanStack Query cache based on event
        if (!event.entity) {
          console.warn('WebSocket: Received event without entity:', event)
          return
        }

        try {
          switch (event.entity) {
            case 'service':
              if (event.action === 'create' || event.action === 'update') {
                websocketHelpers.updateItemInList(
                  queryKeys.services.lists(),
                  event.data as { id: string }
                )
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(
                  queryKeys.services.lists(),
                  (event.data as { id: string }).id
                )
              }
              websocketHelpers.invalidateFromWebSocket(
                getInvalidationQueries.services.onServiceChange(
                  (event.data as { name: string }).name
                ) as readonly (readonly string[])[]
              )
              break

            case 'contract':
              if (event.action === 'create' || event.action === 'update') {
                websocketHelpers.updateItemInList(
                  queryKeys.contracts.lists(),
                  event.data as { id: string }
                )
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(
                  queryKeys.contracts.lists(),
                  (event.data as { id: string }).id
                )
              }
              websocketHelpers.invalidateFromWebSocket(
                getInvalidationQueries.contracts.onContractChange(
                  (event.data as { id: string; provider: string; consumer: string }).id,
                  (event.data as { id: string; provider: string; consumer: string }).provider,
                  (event.data as { id: string; provider: string; consumer: string }).consumer
                ) as readonly (readonly string[])[]
              )
              break

            case 'fixture':
              if (
                event.action === 'create' ||
                event.action === 'update' ||
                event.action === 'status_change'
              ) {
                websocketHelpers.updateItemInList(
                  queryKeys.fixtures.lists(),
                  event.data as { id: string }
                )
              } else if (event.action === 'delete') {
                websocketHelpers.removeItemFromList(
                  queryKeys.fixtures.lists(),
                  (event.data as { id: string }).id
                )
              }
              websocketHelpers.invalidateFromWebSocket(
                getInvalidationQueries.fixtures.onFixtureChange(
                  (event.data as { id: string; service: string }).id,
                  (event.data as { id: string; service: string }).service
                ) as readonly (readonly string[])[]
              )
              break

            case 'deployment':
              const deploymentData = event.data as { service: string; environment: string }
              console.log(
                'WebSocket: Processing deployment event - service:',
                deploymentData.service,
                'environment:',
                deploymentData.environment
              )

              // Use standard query invalidation now that Deployments page uses proper hooks
              const queriesToInvalidate = getInvalidationQueries.deployments.onDeploymentChange(
                deploymentData.service,
                deploymentData.environment
              )
              console.log('WebSocket: Invalidating deployment queries:', queriesToInvalidate)

              websocketHelpers.invalidateFromWebSocket(
                queriesToInvalidate as readonly (readonly string[])[]
              )
              break

            case 'verification':
              websocketHelpers.invalidateFromWebSocket(
                getInvalidationQueries.verification.onVerificationChange(
                  (event.data as { provider: string; consumer: string; contractId: string })
                    .provider,
                  (event.data as { provider: string; consumer: string; contractId: string })
                    .consumer,
                  (event.data as { provider: string; consumer: string; contractId: string })
                    .contractId
                ) as readonly (readonly string[])[]
              )
              break

            default:
              console.log('Unknown WebSocket event entity:', event.entity)
          }
        } catch (error) {
          console.error('Error handling WebSocket event:', error)
        }
      },

      addEventToHistory: event => {
        set(
          state => {
            const newHistory = [event, ...state.eventHistory].slice(0, state.config.maxEventHistory)
            return { eventHistory: newHistory }
          },
          false,
          'addEventToHistory'
        )
      },

      clearEventHistory: () => {
        set({ eventHistory: [] }, false, 'clearEventHistory')
      },

      updateLastPingTime: () => {
        set({ lastPingTime: new Date().toISOString() }, false, 'updateLastPingTime')
      },

      // Configuration
      updateConfig: config => {
        set(
          state => ({
            config: { ...state.config, ...config },
          }),
          false,
          'updateConfig'
        )
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

  const subscribeToDeployment = (deploymentId: string) => {
    store.subscribeToEntity('deployments', deploymentId)
  }

  return {
    ...store,
    subscribeToService,
    subscribeToContract,
    subscribeToFixture,
    subscribeToDeployment,
  }
}
