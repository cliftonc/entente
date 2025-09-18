import type { OpenAPISpec } from '@entente/types'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
// Remove unused Env import
import { serviceVersions, services } from '../../db/schema'
import { injectMockServerUrls } from '../utils/openapi'

export const serviceVersionsRouter = new Hono()

// Get a specific service version by ID
serviceVersionsRouter.get('/:id', async c => {
  const { id } = c.req.param()
  const db = c.get('db')
  const { tenantId } = c.get('session')

  try {
    const version = await db.query.serviceVersions.findFirst({
      where: and(eq(serviceVersions.id, id), eq(serviceVersions.tenantId, tenantId)),
      with: {
        service: true,
      },
    })

    if (!version) {
      return c.json({ error: 'Service version not found' }, 404)
    }

    // Inject mock server URLs into the spec if present
    const serviceName = (version as any).service?.name || 'Unknown'
    const specWithMock = version.spec && Object.keys(version.spec).length > 0
      ? injectMockServerUrls(version.spec as OpenAPISpec, serviceName, 'version', version.id)
      : version.spec

    // Map to include service info for the frontend
    const versionWithService = {
      id: version.id,
      tenantId: version.tenantId,
      serviceId: version.serviceId,
      serviceName: serviceName,
      serviceType: (version as any).service?.type || 'unknown',
      version: version.version,
      spec: specWithMock,
      gitSha: version.gitSha,
      packageJson: version.packageJson,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    }

    return c.json(versionWithService)
  } catch (error) {
    console.error('Error fetching service version:', error)
    return c.json({ error: 'Failed to fetch service version' }, 500)
  }
})
