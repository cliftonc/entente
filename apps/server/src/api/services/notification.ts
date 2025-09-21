import { devWebSocketBroadcaster } from './websocket-dev'
import { createWorkerWebSocketBroadcaster } from './websocket-worker'
import { debugLog } from '../utils/logger'

// Broadcaster interface (sync or async implementations supported)
export interface Broadcaster {
  broadcastToTenant: (tenantId: string, message: any) => Promise<number> | number
  broadcastToChannel: (tenantId: string, channel: string, message: any) => Promise<number> | number
  getStats: () => any
}

// No-op broadcaster (used when no env/bindings available)
const noopBroadcaster: Broadcaster = {
  broadcastToTenant: async () => 0,
  broadcastToChannel: async () => 0,
  getStats: () => ({ totalConnections: 0, tenantCounts: {}, connections: [] }),
}

// Normalize sync return to Promise for awaiting
function toPromise(result: Promise<number> | number): Promise<number> {
  return result instanceof Promise ? result : Promise.resolve(result)
}

// Resolve broadcaster based on runtime environment
function resolveBroadcaster(env?: any): Broadcaster {
  // Prefer Durable Object broadcaster whenever binding exists
  if (env?.NOTIFICATIONS_HUB) return createWorkerWebSocketBroadcaster(env) as Broadcaster
  // Fall back to in-memory dev broadcaster in local dev without DO binding
  if (process.env.NODE_ENV === 'development')
    return devWebSocketBroadcaster as unknown as Broadcaster
  return noopBroadcaster
}

// Helper requiring explicit env (no more global fallback)
function getResolvedBroadcaster(explicitEnv?: any): Broadcaster {
  return resolveBroadcaster(explicitEnv)
}

// WebSocket event types for different entities
export type WebSocketEventType =
  | 'deployment:created'
  | 'deployment:updated'
  | 'deployment:deleted'
  | 'service:created'
  | 'service:updated'
  | 'service:deleted'
  | 'contract:created'
  | 'contract:updated'
  | 'contract:deleted'
  | 'fixture:created'
  | 'fixture:updated'
  | 'fixture:status_change'
  | 'fixture:deleted'
  | 'verification:created'
  | 'verification:updated'
  | 'verification:completed'

// Event payload structure
export interface WebSocketEvent {
  type: WebSocketEventType
  entity: 'deployment' | 'service' | 'contract' | 'fixture' | 'verification'
  action: 'create' | 'update' | 'delete' | 'status_change'
  data: Record<string, any>
  timestamp: string
  tenantId: string
}

export class NotificationService {
  static async broadcastDeploymentEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    deploymentData: {
      id: string
      service: string
      version: string
      environment: string
      status: string
      deployedAt: Date
      deployedBy: string
      gitSha?: string
      specType?: string
    },
    options?: { env?: any }
  ) {
    const event: WebSocketEvent = {
      type: `deployment:${action}` as WebSocketEventType,
      entity: 'deployment',
      action,
      data: deploymentData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getResolvedBroadcaster(options?.env)
    await toPromise(broadcaster.broadcastToTenant(tenantId, event))
    const channelName = `deployments:${deploymentData.environment}`
    await toPromise(broadcaster.broadcastToChannel(tenantId, channelName, event))

    debugLog(`📡 Broadcasted deployment ${action} event`, {
      service: deploymentData.service,
      version: deploymentData.version,
      environment: deploymentData.environment,
      specType: deploymentData.specType,
      tenantId,
    })
  }

  static async broadcastServiceEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    serviceData: {
      id: string
      name: string
      type: 'consumer' | 'provider'
      description?: string
    },
    options?: { env?: any }
  ) {
    const event: WebSocketEvent = {
      type: `service:${action}` as WebSocketEventType,
      entity: 'service',
      action,
      data: serviceData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getResolvedBroadcaster(options?.env)
    await toPromise(broadcaster.broadcastToTenant(tenantId, event))

    debugLog(`📡 Broadcasted service ${action} event`, {
      name: serviceData.name,
      type: serviceData.type,
      tenantId,
    })
  }

  static async broadcastContractEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    contractData: {
      id: string
      provider: string
      consumer: string
      name?: string
    },
    options?: { env?: any }
  ) {
    const event: WebSocketEvent = {
      type: `contract:${action}` as WebSocketEventType,
      entity: 'contract',
      action,
      data: contractData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getResolvedBroadcaster(options?.env)
    await toPromise(broadcaster.broadcastToTenant(tenantId, event))

    debugLog(`📡 Broadcasted contract ${action} event`, {
      id: contractData.id,
      provider: contractData.provider,
      consumer: contractData.consumer,
      tenantId,
    })
  }

  static async broadcastFixtureEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete' | 'status_change',
    fixtureData: {
      id: string
      service: string
      operation: string
      status: string
      version?: string
    },
    options?: { env?: any }
  ) {
    const event: WebSocketEvent = {
      type:
        action === 'status_change'
          ? 'fixture:status_change'
          : (`fixture:${action}` as WebSocketEventType),
      entity: 'fixture',
      action,
      data: fixtureData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getResolvedBroadcaster(options?.env)
    await toPromise(broadcaster.broadcastToTenant(tenantId, event))

    debugLog(`📡 Broadcasted fixture ${action} event`, {
      id: fixtureData.id,
      service: fixtureData.service,
      operation: fixtureData.operation,
      status: fixtureData.status,
      tenantId,
    })
  }

  static async broadcastVerificationEvent(
    tenantId: string,
    action: 'create' | 'update' | 'completed',
    verificationData: {
      id: string
      provider: string
      consumer: string
      contractId: string
      status: string
      providerVersion?: string
      consumerVersion?: string
    },
    options?: { env?: any }
  ) {
    const event: WebSocketEvent = {
      type: `verification:${action}` as WebSocketEventType,
      entity: 'verification',
      action: action === 'completed' ? 'update' : action,
      data: verificationData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getResolvedBroadcaster(options?.env)
    await toPromise(broadcaster.broadcastToTenant(tenantId, event))

    debugLog(`📡 Broadcasted verification ${action} event`, {
      id: verificationData.id,
      provider: verificationData.provider,
      consumer: verificationData.consumer,
      status: verificationData.status,
      tenantId,
    })
  }

  static getConnectionStats(options?: { env?: any }) {
    const broadcaster = getResolvedBroadcaster(options?.env)
    return broadcaster.getStats()
  }

  static async sendTestEvent(
    tenantId: string,
    message = 'Hello from Entente!',
    options?: { env?: any }
  ) {
    const event = {
      type: 'test',
      message,
      timestamp: new Date().toISOString(),
    }
    const broadcaster = getResolvedBroadcaster(options?.env)
    return toPromise(broadcaster.broadcastToTenant(tenantId, event))
  }
}
