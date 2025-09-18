import type { OpenAPISpec, SpecMetadata } from '@entente/types'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deployments, services, specs } from '../../db/schema'
import type { DbSpec } from '../../db/types'
import { findBestSemverMatch, getLatestVersion } from '../utils/semver-match'
import { ensureServiceVersion, getServiceVersions } from '../utils/service-versions'

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
  const { user } = c.get('auth')

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

  // Ensure service version exists and get its ID
  const serviceVersionId = await ensureServiceVersion(
    db,
    tenantId,
    metadata.service,
    metadata.version,
    {
      spec: spec,
      gitSha: metadata.gitSha,
      packageJson: metadata.packageJson,
      createdBy: user?.name || 'spec-upload',
    }
  )

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
  const requestedVersion = c.req.query('providerVersion')
  const environment = c.req.query('environment') || 'production'
  const branch = c.req.query('branch') || 'main'

  if (!requestedVersion) {
    return c.json({ error: 'providerVersion parameter is required' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Find all service versions for this service
  const allVersions = await getServiceVersions(db, tenantId, service)

  if (allVersions.length === 0) {
    return c.json(
      {
        error: 'No versions found',
        message: `No versions found for service '${service}'.`,
        suggestion: `Upload a spec or record interactions for this service first.`,
      },
      404
    )
  }

  // Find best match using semver
  let selectedVersion = null
  if (requestedVersion === 'latest') {
    // Get latest version by creation date
    selectedVersion = getLatestVersion(allVersions)
  } else {
    // Try exact match first
    selectedVersion = allVersions.find(v => v.version === requestedVersion)

    // If no exact match, use semver matching
    if (!selectedVersion) {
      const match = findBestSemverMatch(requestedVersion, allVersions)
      if (match) {
        selectedVersion = allVersions.find(v => v.id === match.id)
        console.log(
          `🔍 Version ${requestedVersion} not found for ${service}, using best semver match: ${match.version}`
        )
      }
    }
  }

  if (!selectedVersion) {
    return c.json(
      {
        error: 'No compatible version found',
        message: `No compatible version found for '${requestedVersion}'.`,
        requestedVersion: requestedVersion,
        availableVersions: allVersions.map(v => v.version),
        suggestion:
          allVersions.length > 0
            ? `Try using one of the available versions: ${allVersions.map(v => v.version).join(', ')}`
            : `No versions available for ${service}.`,
      },
      404
    )
  }

  // Check if this version is deployed (for metadata)
  const deployment = await db.query.deployments.findFirst({
    where: and(
      eq(deployments.tenantId, tenantId),
      eq(deployments.service, service),
      eq(deployments.type, 'provider'),
      eq(deployments.version, selectedVersion.version),
      eq(deployments.environment, environment),
      eq(deployments.active, true)
    ),
  })

  // Return spec from ServiceVersion
  return c.json({
    spec: selectedVersion.spec || {}, // Return empty spec if none stored
    metadata: {
      providerVersion: selectedVersion.version, // Return actual version used
      serviceVersionId: selectedVersion.id,
      environment,
      branch,
      hasSpec: !!selectedVersion.spec,
      createdAt: selectedVersion.createdAt,
      resolvedFromLatest: requestedVersion === 'latest',
      isDeployed: !!deployment, // Indicates if this version is actually deployed
    },
  })
})
