import type { OpenAPISpec, SpecMetadata } from '@entente/types'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { services, specs } from '../../db/schema'
import type { DbSpec } from '../../db/types'

export const specsRouter = new Hono()

// Upload OpenAPI specification
specsRouter.post('/:service', async c => {
  const service = c.req.param('service')
  const body = await c.req.json()

  const { spec, metadata }: { spec: OpenAPISpec; metadata: SpecMetadata } = body

  if (!spec || !metadata) {
    return c.json({ error: 'Missing spec or metadata' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find the provider service for this service
  const provider = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, metadata.service),
      eq(services.type, 'provider')
    ),
  })

  if (!provider) {
    return c.json(
      {
        error: `Provider service '${metadata.service}' not found. Please register the provider first using 'entente register-service -t provider'.`,
      },
      404
    )
  }

  // Check if spec already exists for this provider+version+environment+branch
  const existingSpec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.providerId, provider.id),
      eq(specs.version, metadata.version),
      eq(specs.environment, metadata.environment),
      eq(specs.branch, metadata.branch)
    ),
  })

  let resultSpec: DbSpec
  let isNew = false

  if (existingSpec) {
    // Update existing spec
    const [updated] = await db
      .update(specs)
      .set({
        spec,
        uploadedBy: metadata.uploadedBy,
        uploadedAt: new Date(),
      })
      .where(eq(specs.id, existingSpec.id))
      .returning()

    resultSpec = updated
    console.log(`📋 Updated spec for ${service}@${metadata.version} (${metadata.environment})`)
  } else {
    // Create new spec
    const [created] = await db
      .insert(specs)
      .values({
        tenantId,
        providerId: provider.id,
        service: metadata.service,
        version: metadata.version,
        branch: metadata.branch,
        environment: metadata.environment,
        spec,
        uploadedBy: metadata.uploadedBy,
      })
      .returning()

    resultSpec = created
    isNew = true
    console.log(`📋 Uploaded new spec for ${service}@${metadata.version} (${metadata.environment})`)
  }

  return c.json(
    {
      id: resultSpec.id,
      service: resultSpec.service,
      version: resultSpec.version,
      branch: resultSpec.branch,
      environment: resultSpec.environment,
      uploadedAt: resultSpec.uploadedAt,
      isNew,
    },
    isNew ? 201 : 200
  )
})

// Get OpenAPI specification
specsRouter.get('/:service', async c => {
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
    ),
  })

  if (!spec) {
    return c.json({ error: 'Spec not found' }, 404)
  }

  return c.json(spec.spec)
})

// List available versions for a service
specsRouter.get('/:service/versions', async c => {
  const service = c.req.param('service')

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const versions = await db.query.specs.findMany({
    where: and(eq(specs.tenantId, tenantId), eq(specs.service, service)),
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
