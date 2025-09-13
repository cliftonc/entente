import { Hono } from 'hono'
import type { OpenAPISpec, SpecMetadata } from '@entente/types'
import { specs } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const specsRouter = new Hono()

// Upload OpenAPI specification
specsRouter.post('/:service', async (c) => {
  const service = c.req.param('service')
  const body = await c.req.json()
  
  const { spec, metadata }: { spec: OpenAPISpec; metadata: SpecMetadata } = body

  if (!spec || !metadata) {
    return c.json({ error: 'Missing spec or metadata' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const [newSpec] = await db.insert(specs).values({
    tenantId,
    service: metadata.service,
    version: metadata.version,
    branch: metadata.branch,
    environment: metadata.environment,
    spec,
    uploadedBy: metadata.uploadedBy,
  }).returning()

  console.log(`📋 Uploaded spec for ${service}@${metadata.version} (${metadata.environment})`)

  return c.json({
    id: newSpec.id,
    service: newSpec.service,
    version: newSpec.version,
    branch: newSpec.branch,
    environment: newSpec.environment,
    uploadedAt: newSpec.uploadedAt,
  }, 201)
})

// Get OpenAPI specification
specsRouter.get('/:service', async (c) => {
  const service = c.req.param('service')
  const version = c.req.query('version')
  const branch = c.req.query('branch') || 'main'

  if (!version) {
    return c.json({ error: 'Version parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const spec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.service, service),
      eq(specs.version, version),
      eq(specs.branch, branch)
    )
  })

  if (!spec) {
    return c.json({ error: 'Spec not found' }, 404)
  }

  return c.json(spec.spec)
})

// List available versions for a service
specsRouter.get('/:service/versions', async (c) => {
  const service = c.req.param('service')
  
  const db = c.get('db')
  const { tenantId } = c.get('session')

  const versions = await db.query.specs.findMany({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.service, service)
    ),
    columns: {
      version: true,
      branch: true,
      environment: true,
      uploadedAt: true,
    },
    orderBy: desc(specs.uploadedAt),
  })

  return c.json(versions)
})