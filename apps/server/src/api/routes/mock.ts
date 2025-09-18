import type { Fixture, OpenAPISpec, HTTPRequest } from '@entente/types'
import {
  createOpenAPIMockHandler,
  handleMockRequest,
  type MockRequest,
  type MockResponse,
  type MockHandler
} from '@entente/fixtures'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { serviceVersions, services } from '../../db/schema'
import { getServiceVersions } from '../utils/service-versions'

export const mockRouter = new Hono()

// Cache for mock handlers to avoid recreating them for each request
const mockHandlerCache = new Map<string, MockHandler[]>()

// Mock API for service by name (latest version)
mockRouter.all('/service/:serviceName/*', async c => {
  const serviceName = c.req.param('serviceName')
  const requestPath = c.req.path.replace(`/api/mock/service/${serviceName}`, '')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  try {
    // Get latest service version
    const allVersions = await getServiceVersions(db, tenantId, serviceName)

    if (allVersions.length === 0) {
      return c.json({ error: 'Service not found' }, 404)
    }

    // Get the latest version that has a spec (most recent by creation date)
    const latestVersionWithSpec = allVersions
      .filter(version => version.spec && Object.keys(version.spec).length > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    if (!latestVersionWithSpec) {
      return c.json({ error: 'No OpenAPI spec available for this service' }, 404)
    }

    // Get fixtures for this service and version
    const fixtures = await fetchFixturesForVersion(db, tenantId, serviceName, latestVersionWithSpec.version)

    // Create or get cached mock handlers
    const cacheKey = `${serviceName}:${latestVersionWithSpec.version}`
    let mockHandlers = mockHandlerCache.get(cacheKey)

    if (!mockHandlers) {
      mockHandlers = createOpenAPIMockHandler(latestVersionWithSpec.spec as OpenAPISpec, fixtures)
      mockHandlerCache.set(cacheKey, mockHandlers)
    }

    // Handle the request directly
    return await handleMockRequestInWorker(c, mockHandlers, requestPath)

  } catch (error) {
    console.error('Mock API error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mock API for specific service version by ID
mockRouter.all('/version/:serviceVersionId/*', async c => {
  const serviceVersionId = c.req.param('serviceVersionId')
  const requestPath = c.req.path.replace(`/api/mock/version/${serviceVersionId}`, '')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  try {
    // Get specific service version
    const serviceVersion = await db.query.serviceVersions.findFirst({
      where: and(
        eq(serviceVersions.tenantId, tenantId),
        eq(serviceVersions.id, serviceVersionId)
      ),
      with: {
        service: true
      }
    })

    if (!serviceVersion) {
      return c.json({ error: 'Service version not found' }, 404)
    }

    if (!serviceVersion.spec) {
      return c.json({ error: 'No OpenAPI spec available for this service version' }, 404)
    }

    // Get fixtures for this service and version
    const fixtures = await fetchFixturesForVersion(
      db,
      tenantId,
      (serviceVersion as any).service.name,
      serviceVersion.version
    )

    // Create or get cached mock handlers
    const cacheKey = `${(serviceVersion as any).service.name}:${serviceVersion.version}`
    let mockHandlers = mockHandlerCache.get(cacheKey)

    if (!mockHandlers) {
      mockHandlers = createOpenAPIMockHandler(serviceVersion.spec as OpenAPISpec, fixtures)
      mockHandlerCache.set(cacheKey, mockHandlers)
    }

    // Handle the request directly
    return await handleMockRequestInWorker(c, mockHandlers, requestPath)

  } catch (error) {
    console.error('Mock API error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Helper function to fetch fixtures for a service version
async function fetchFixturesForVersion(
  db: any,
  tenantId: string,
  serviceName: string,
  version: string
): Promise<Fixture[]> {
  try {
    // Query database directly - no HTTP requests needed since we're on the server
    const { fixtures } = await import('../../db/schema')
    const { sql } = await import('drizzle-orm')

    const dbFixtures = await db.query.fixtures.findMany({
      where: and(
        eq(fixtures.tenantId, tenantId),
        eq(fixtures.service, serviceName),
        eq(fixtures.status, 'approved'),
        sql`EXISTS (
          SELECT 1 FROM fixture_service_versions fsv
          JOIN service_versions sv ON fsv.service_version_id = sv.id
          JOIN services s ON sv.service_id = s.id
          WHERE fsv.fixture_id = ${fixtures.id}
          AND s.name = ${serviceName}
          AND sv.version = ${version}
          AND sv.tenant_id = ${tenantId}
        )`
      ),
    })

    return dbFixtures.map((f: any) => ({
      id: f.id,
      service: f.service,
      serviceVersion: f.serviceVersion,
      serviceVersions: f.serviceVersions as string[],
      operation: f.operation,
      status: f.status as 'draft' | 'approved' | 'rejected',
      source: f.source as 'consumer' | 'provider' | 'manual',
      priority: f.priority,
      data: f.data as any,
      createdFrom: f.createdFrom as any,
      createdAt: f.createdAt,
      approvedBy: f.approvedBy || undefined,
      approvedAt: f.approvedAt || undefined,
      notes: f.notes || undefined,
    }))
  } catch (error) {
    console.warn('Failed to fetch fixtures:', error)
    return []
  }
}

// Helper function to handle mock requests in the Cloudflare Worker
async function handleMockRequestInWorker(c: any, mockHandlers: MockHandler[], requestPath: string) {
  try {
    // Get request details
    const method = c.req.method
    const headers: Record<string, string> = {}

    // Copy headers from original request
    for (const [key, value] of Object.entries(c.req.header())) {
      if (typeof value === 'string') {
        headers[key] = value
      }
    }

    // Parse query parameters
    const url = new URL(c.req.url)
    const query: Record<string, unknown> = {}
    for (const [key, value] of url.searchParams.entries()) {
      query[key] = value
    }

    // Get request body if present
    let body: unknown = undefined
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const contentType = headers['content-type'] || ''
        if (contentType.includes('application/json')) {
          body = await c.req.json()
        } else {
          body = await c.req.text()
        }
      } catch {
        // Ignore body parsing errors
      }
    }

    // Create mock request
    const mockRequest: MockRequest = {
      method,
      path: requestPath,
      headers,
      query,
      body
    }

    // Handle the request using the mock handlers
    const mockResponse = handleMockRequest(mockRequest, mockHandlers)

    // Return response
    return c.json(mockResponse.body, mockResponse.status, mockResponse.headers)

  } catch (error) {
    console.error('Mock request handling error:', error)
    return c.json({ error: 'Failed to handle mock request' }, 500)
  }
}