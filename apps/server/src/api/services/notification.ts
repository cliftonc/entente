import { websocketBroadcaster } from '../routes/websocket'
import { devWebSocketBroadcaster } from './websocket-dev'

// Helper to get the appropriate broadcaster based on environment
function getBroadcaster() {
  // In development, use the Node.js WebSocket broadcaster
  // In production, use the Cloudflare Workers WebSocket broadcaster
  return process.env.NODE_ENV === 'development' ? devWebSocketBroadcaster : websocketBroadcaster
}

/**
 * WebSocket event types for different entities
 */
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

/**
 * WebSocket event structure
 */
export interface WebSocketEvent {
  type: WebSocketEventType
  entity: 'deployment' | 'service' | 'contract' | 'fixture' | 'verification'
  action: 'create' | 'update' | 'delete' | 'status_change'
  data: Record<string, any>
  timestamp: string
  tenantId: string
}

/**
 * Notification service for broadcasting real-time events
 */
export class NotificationService {
  /**
   * Broadcast a deployment event
   */
  static broadcastDeploymentEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    deploymentData: {
      id: string
      service: string
      version: string
      environment: string
      type: 'consumer' | 'provider'
      status: string
      deployedAt: Date
      deployedBy: string
      gitSha?: string
    }
  ) {
    const event: WebSocketEvent = {
      type: `deployment:${action}` as WebSocketEventType,
      entity: 'deployment',
      action,
      data: deploymentData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    const broadcaster = getBroadcaster()

    // Broadcast to all tenant connections
    broadcaster.broadcastToTenant(tenantId, event)

    // Also broadcast to specific deployment channel subscribers
    const channelName = `deployments:${deploymentData.environment}`
    broadcaster.broadcastToChannel(tenantId, channelName, event)

    console.log(`📡 Broadcasted deployment ${action} event:`, {
      service: deploymentData.service,
      version: deploymentData.version,
      environment: deploymentData.environment,
      tenantId,
    })
  }

  /**
   * Broadcast a service event
   */
  static broadcastServiceEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    serviceData: {
      id: string
      name: string
      type: 'consumer' | 'provider'
      description?: string
    }
  ) {
    const event: WebSocketEvent = {
      type: `service:${action}` as WebSocketEventType,
      entity: 'service',
      action,
      data: serviceData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    getBroadcaster().broadcastToTenant(tenantId, event)

    console.log(`📡 Broadcasted service ${action} event:`, {
      name: serviceData.name,
      type: serviceData.type,
      tenantId,
    })
  }

  /**
   * Broadcast a contract event
   */
  static broadcastContractEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete',
    contractData: {
      id: string
      provider: string
      consumer: string
      name?: string
    }
  ) {
    const event: WebSocketEvent = {
      type: `contract:${action}` as WebSocketEventType,
      entity: 'contract',
      action,
      data: contractData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    getBroadcaster().broadcastToTenant(tenantId, event)

    console.log(`📡 Broadcasted contract ${action} event:`, {
      id: contractData.id,
      provider: contractData.provider,
      consumer: contractData.consumer,
      tenantId,
    })
  }

  /**
   * Broadcast a fixture event
   */
  static broadcastFixtureEvent(
    tenantId: string,
    action: 'create' | 'update' | 'delete' | 'status_change',
    fixtureData: {
      id: string
      service: string
      operation: string
      status: string
      version?: string
    }
  ) {
    const event: WebSocketEvent = {
      type: action === 'status_change' ? 'fixture:status_change' : `fixture:${action}` as WebSocketEventType,
      entity: 'fixture',
      action,
      data: fixtureData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    getBroadcaster().broadcastToTenant(tenantId, event)

    console.log(`📡 Broadcasted fixture ${action} event:`, {
      id: fixtureData.id,
      service: fixtureData.service,
      operation: fixtureData.operation,
      status: fixtureData.status,
      tenantId,
    })
  }

  /**
   * Broadcast a verification event
   */
  static broadcastVerificationEvent(
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
    }
  ) {
    const event: WebSocketEvent = {
      type: `verification:${action}` as WebSocketEventType,
      entity: 'verification',
      action: action === 'completed' ? 'update' : action,
      data: verificationData,
      timestamp: new Date().toISOString(),
      tenantId,
    }

    getBroadcaster().broadcastToTenant(tenantId, event)

    console.log(`📡 Broadcasted verification ${action} event:`, {
      id: verificationData.id,
      provider: verificationData.provider,
      consumer: verificationData.consumer,
      status: verificationData.status,
      tenantId,
    })
  }

  /**
   * Get WebSocket connection statistics
   */
  static getConnectionStats() {
    return getBroadcaster().getStats()
  }

  /**
   * Send a test event (for debugging)
   */
  static sendTestEvent(tenantId: string, message: string = 'Hello from Entente!') {
    const event = {
      type: 'test',
      message,
      timestamp: new Date().toISOString(),
    }

    return getBroadcaster().broadcastToTenant(tenantId, event)
  }
}