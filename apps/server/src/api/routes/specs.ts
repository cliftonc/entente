import type { OpenAPISpec, SpecMetadata } from '@entente/types'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deployments, services, specs } from '../../db/schema'
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

// Get OpenAPI specification by provider deployment version
specsRouter.get('/:service/by-provider-version', async c => {
  const service = c.req.param('service')
  const providerVersion = c.req.query('providerVersion')
  const environment = c.req.query('environment') || 'production'
  const branch = c.req.query('branch') || 'main'

  if (!providerVersion) {
    return c.json({ error: 'providerVersion parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  let deployment
  let actualProviderVersion = providerVersion

  if (providerVersion === 'latest') {
    // Find the most recently deployed version
    deployment = await db.query.deployments.findFirst({
      where: and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.service, service),
        eq(deployments.type, 'provider'),
        eq(deployments.environment, environment),
        eq(deployments.active, true)
      ),
      orderBy: desc(deployments.deployedAt),
    })

    if (deployment) {
      actualProviderVersion = deployment.version
    }
  } else {
    // Look for specific version
    deployment = await db.query.deployments.findFirst({
      where: and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.service, service),
        eq(deployments.type, 'provider'),
        eq(deployments.version, providerVersion),
        eq(deployments.environment, environment),
        eq(deployments.active, true)
      ),
    })
  }

  // If no deployment found, we'll still try to find a spec
  // This allows testing against specs even if not deployed
  if (!deployment && providerVersion === 'latest') {
    // For 'latest' without deployment, we can't resolve to a specific version
    // So provide helpful error with available deployed versions
    const availableDeployments = await db.query.deployments.findMany({
      where: and(
        eq(deployments.tenantId, tenantId),
        eq(deployments.service, service),
        eq(deployments.type, 'provider'),
        eq(deployments.environment, environment),
        eq(deployments.active, true)
      ),
      columns: { version: true },
      orderBy: desc(deployments.deployedAt),
    })

    const availableVersions = availableDeployments.map(d => d.version)

    return c.json({
      error: 'No deployed versions found for latest',
      message: `No deployed versions found for provider '${service}' in environment '${environment}'.`,
      availableVersions,
      suggestion: availableVersions.length > 0
        ? `Try using a specific version like: ${availableVersions.join(', ')}`
        : `No deployed versions found for '${service}' in '${environment}'. Upload a spec or deploy the provider first.`
    }, 404)
  }

  // Now find the spec that corresponds to this provider deployment version
  // We'll look for a spec with the same version, but if not found, we'll look for specs
  // from the same environment and branch (allowing for spec versioning independence)
  let spec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.service, service),
      eq(specs.version, actualProviderVersion), // Try exact version match first
      eq(specs.environment, environment),
      eq(specs.branch, branch)
    ),
  })

  if (!spec) {
    // If no exact version match, find the most recent spec for this service/environment/branch
    spec = await db.query.specs.findFirst({
      where: and(
        eq(specs.tenantId, tenantId),
        eq(specs.service, service),
        eq(specs.environment, environment),
        eq(specs.branch, branch)
      ),
      orderBy: desc(specs.uploadedAt),
    })
  }

  if (!spec) {
    return c.json({
      error: 'No OpenAPI spec found',
      message: `No OpenAPI specification found for provider '${service}' in environment '${environment}' on branch '${branch}'.`,
      suggestion: `Please upload an OpenAPI spec for this provider using 'entente upload-spec'.`
    }, 404)
  }

  return c.json({
    spec: spec.spec,
    metadata: {
      providerVersion: actualProviderVersion, // Return the resolved version (important for 'latest')
      specVersion: spec.version,
      environment,
      branch,
      uploadedAt: spec.uploadedAt,
      resolvedFromLatest: providerVersion === 'latest',
      isDeployed: !!deployment // Indicates if this version is actually deployed
    }
  })
})
