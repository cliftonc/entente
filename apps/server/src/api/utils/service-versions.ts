import type { SpecType } from '@entente/types'
import { and, eq } from 'drizzle-orm'
import { serviceVersions, services } from '../../db/schema'
import type { Database } from '../../db/types'

export interface ServiceVersionMetadata {
  spec?: any // OpenAPI spec payload (OpenAPI/GraphQL/etc.)
  specType?: SpecType | null // Enumerated spec type
  gitSha?: string
  packageJson?: any
  createdBy?: string
}

/**
 * Ensures a service version exists, creating it and the service if necessary.
 * This is the core function that enables auto-creation of versions throughout the system.
 */
export async function ensureServiceVersion(
  db: Database,
  tenantId: string,
  serviceName: string,
  version: string,
  metadata?: ServiceVersionMetadata
): Promise<string> {
  // 1. Find or create service
  let service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, serviceName)),
  })

  if (!service) {
    // Auto-create service if it doesn't exist
    const [newService] = await db
      .insert(services)
      .values({
        tenantId,
        name: serviceName,
        description: `Auto-created service for ${serviceName}`,
        packageJson: metadata?.packageJson || {},
        gitRepositoryUrl: null,
        githubRepositoryOwner: null,
        githubRepositoryName: null,
        githubVerifyWorkflowId: null,
        githubVerifyWorkflowName: null,
        githubVerifyWorkflowPath: null,
        githubAutoLinked: false,
        githubConfiguredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    service = newService
  }

  // 2. Find or create service version
  let serviceVersion = await db.query.serviceVersions.findFirst({
    where: and(
      eq(serviceVersions.tenantId, tenantId),
      eq(serviceVersions.serviceId, service.id),
      eq(serviceVersions.version, version)
    ),
  })

  if (!serviceVersion) {
    // Auto-create version
    const [newVersion] = await db
      .insert(serviceVersions)
      .values({
        tenantId,
        serviceId: service.id,
        version,
        spec: metadata?.spec || null,
        specType: metadata?.specType || null,
        gitSha: metadata?.gitSha || null,
        packageJson: metadata?.packageJson || null,
        createdBy: metadata?.createdBy || 'auto-created',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    serviceVersion = newVersion
  } else if (!serviceVersion.spec && metadata?.spec) {
    // Update with spec if we have one and version doesn't
    await db
      .update(serviceVersions)
      .set({
        spec: metadata.spec,
        specType: metadata.specType || serviceVersion.specType,
        gitSha: metadata.gitSha || serviceVersion.gitSha,
        packageJson: metadata.packageJson || serviceVersion.packageJson,
        updatedAt: new Date(),
      })
      .where(eq(serviceVersions.id, serviceVersion.id))
  }

  return serviceVersion.id
}

/**
 * Find an existing service version by tenant, service name, and version.
 * Returns null if not found.
 */
export async function findServiceVersion(
  db: Database,
  tenantId: string,
  serviceName: string,
  version: string
): Promise<{
  id: string
  version: string
  spec: any
  specType: SpecType | null
  createdAt: Date
} | null> {
  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, serviceName)),
  })

  if (!service) {
    return null
  }

  const serviceVersion = await db.query.serviceVersions.findFirst({
    where: and(
      eq(serviceVersions.tenantId, tenantId),
      eq(serviceVersions.serviceId, service.id),
      eq(serviceVersions.version, version)
    ),
  })

  if (!serviceVersion) {
    return null
  }

  return {
    id: serviceVersion.id,
    version: serviceVersion.version,
    spec: serviceVersion.spec,
    specType: serviceVersion.specType as SpecType | null,
    createdAt: serviceVersion.createdAt,
  }
}

/**
 * Get all service versions for a given service.
 */
export async function getServiceVersions(
  db: Database,
  tenantId: string,
  serviceName: string
): Promise<
  Array<{ id: string; version: string; spec: any; specType: SpecType | null; createdAt: Date }>
> {
  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, serviceName)),
  })

  if (!service) {
    return []
  }

  const versions = await db.query.serviceVersions.findMany({
    where: and(eq(serviceVersions.tenantId, tenantId), eq(serviceVersions.serviceId, service.id)),
    orderBy: (serviceVersions, { desc }) => [desc(serviceVersions.createdAt)],
  })

  return versions.map(v => ({
    id: v.id,
    version: v.version,
    spec: v.spec,
    specType: v.specType as SpecType | null,
    createdAt: v.createdAt,
  }))
}
