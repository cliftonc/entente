import { specRegistry } from '@entente/fixtures'
import type { OpenAPISpec, SpecMetadata, SpecType, SupportedSpec } from '@entente/types'
import { debugLog } from '@entente/types'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deployments, services, specs } from '../../db/schema'
import type { DbSpec } from '../../db/types'
import { injectMockServerUrls } from '../utils/openapi'
import { findBestSemverMatch, getLatestVersion } from '../utils/semver-match'
import { ensureServiceVersion, getServiceVersions } from '../utils/service-versions'

export const specsRouter = new Hono()

// Upload API specification (OpenAPI, GraphQL, AsyncAPI, gRPC, SOAP)
specsRouter.post('/:service', async c => {
  const service = c.req.param('service')
  const body = await c.req.json()

  const { spec, metadata }: { spec: SupportedSpec; metadata: SpecMetadata } = body

  if (!spec || !metadata) {
    return c.json({ error: 'Missing spec or metadata' }, 400)
  }

  // Auto-detect spec type
  const detectedSpecType = specRegistry.detectType(spec)
  if (!detectedSpecType) {
    return c.json({ error: 'Unsupported specification format' }, 400)
  }

  debugLog(`🔍 Detected spec type: ${detectedSpecType} for service ${service}`)

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
      specType: detectedSpecType, // Include the detected spec type
      gitSha: undefined,
      packageJson: undefined,
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
        specType: detectedSpecType, // Update spec type in case it changed
        uploadedBy: metadata.uploadedBy,
        uploadedAt: new Date(),
      })
      .where(eq(specs.id, existingSpec.id))
      .returning()

    resultSpec = updated
    debugLog(`📋 Updated spec for ${service}@${metadata.version} (${metadata.environment})`)
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
        specType: detectedSpecType, // Include the detected spec type
        spec,
        uploadedBy: metadata.uploadedBy,
      })
      .returning()

    resultSpec = created
    isNew = true
    debugLog(`📋 Uploaded new spec for ${service}@${metadata.version} (${metadata.environment})`)
  }

  // Update service specType if it's different from detected type
  if (provider.specType !== detectedSpecType) {
    await db
      .update(services)
      .set({
        specType: detectedSpecType,
        updatedAt: new Date(),
      })
      .where(eq(services.id, provider.id))

    debugLog(
      `🔄 Updated service ${service} specType from ${provider.specType} to ${detectedSpecType}`
    )
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

  let spec

  if (version === 'latest') {
    // Find the latest spec for this service
    const allSpecs = await db.query.specs.findMany({
      where: and(
        eq(specs.tenantId, tenantId),
        eq(specs.service, service),
        eq(specs.branch, branch)
      ),
      orderBy: desc(specs.uploadedAt),
    })

    spec = allSpecs[0] // Most recent by upload time
  } else {
    // Find specific version
    spec = await db.query.specs.findFirst({
      where: and(
        eq(specs.tenantId, tenantId),
        eq(specs.service, service),
        eq(specs.version, version),
        eq(specs.branch, branch)
      ),
    })
  }

  if (!spec) {
    return c.json({ error: 'Spec not found' }, 404)
  }

  // Inject mock server URLs only for OpenAPI specs
  if (spec.specType === 'openapi') {
    const specWithMock = injectMockServerUrls(spec.spec as OpenAPISpec, service, 'latest')
    return c.json(specWithMock)
  }

  // For non-OpenAPI specs (GraphQL, AsyncAPI, etc.), return the spec with appropriate endpoint info
  const response: any = {
    specType: spec.specType,
    spec: spec.spec,
    service: spec.service,
    version: spec.version,
    branch: spec.branch,
    environment: spec.environment,
    uploadedAt: spec.uploadedAt,
  }

  // Add endpoint information for GraphQL
  if (spec.specType === 'graphql') {
    response.endpoints = {
      mock: `/api/mock/service/${service}`, // Mock GraphQL endpoint
      latest: `/api/mock/service/${service}`, // Latest version mock
      version: `/api/mock/version/${spec.id}`, // Specific version mock
    }
  }

  return c.json(response)
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
        debugLog(
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

  // Inject mock server URLs only for OpenAPI specs
  const rawSpec = selectedVersion.spec || {}
  const urlType = requestedVersion === 'latest' ? 'latest' : 'version'
  let specWithMock = rawSpec

  if (rawSpec && Object.keys(rawSpec).length > 0 && selectedVersion.specType === 'openapi') {
    specWithMock = injectMockServerUrls(
      rawSpec as OpenAPISpec,
      service,
      urlType,
      selectedVersion.id
    )
  }

  return c.json({
    spec: specWithMock,
    metadata: {
      providerVersion: selectedVersion.version,
      serviceVersionId: selectedVersion.id,
      specType: selectedVersion.specType,
      environment,
      branch,
      hasSpec: !!selectedVersion.spec,
      createdAt: selectedVersion.createdAt,
      resolvedFromLatest: requestedVersion === 'latest',
      isDeployed: !!deployment,
    },
  })
})
