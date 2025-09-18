import { and, eq } from 'drizzle-orm'
import { fixtureServiceVersions, fixtures } from '../../db/schema'
import type { Database } from '../../db/types'
import { ensureServiceVersion } from './service-versions'

/**
 * Add a service version to a fixture's associated versions.
 */
export async function addServiceVersionToFixture(
  db: Database,
  fixtureId: string,
  tenantId: string,
  serviceName: string,
  version: string
): Promise<string> {
  // Ensure the service version exists
  const serviceVersionId = await ensureServiceVersion(db, tenantId, serviceName, version, {
    createdBy: 'fixture-creation',
  })

  // Check if the relationship already exists
  const existingRelation = await db.query.fixtureServiceVersions.findFirst({
    where: and(
      eq(fixtureServiceVersions.fixtureId, fixtureId),
      eq(fixtureServiceVersions.serviceVersionId, serviceVersionId)
    ),
  })

  if (!existingRelation) {
    // Create the relationship
    await db.insert(fixtureServiceVersions).values({
      fixtureId,
      serviceVersionId,
    })
  }

  return serviceVersionId
}

/**
 * Get all service versions associated with a fixture.
 */
export async function getFixtureServiceVersions(
  db: Database,
  fixtureId: string
): Promise<Array<{ id: string; version: string; serviceName: string }>> {
  const relations = await db
    .select({
      serviceVersionId: fixtureServiceVersions.serviceVersionId,
    })
    .from(fixtureServiceVersions)
    .where(eq(fixtureServiceVersions.fixtureId, fixtureId))

  // For now, we'll need to join with service_versions to get the actual version info
  // This will be handled in the query where we need the full data
  return relations.map(r => ({
    id: r.serviceVersionId,
    version: 'unknown', // Will be populated by joins
    serviceName: 'unknown', // Will be populated by joins
  }))
}

/**
 * Remove all service version associations from a fixture.
 */
export async function clearFixtureServiceVersions(db: Database, fixtureId: string): Promise<void> {
  await db.delete(fixtureServiceVersions).where(eq(fixtureServiceVersions.fixtureId, fixtureId))
}

/**
 * Check if a fixture is associated with a specific service version.
 */
export async function isFixtureForServiceVersion(
  db: Database,
  fixtureId: string,
  serviceVersionId: string
): Promise<boolean> {
  const relation = await db.query.fixtureServiceVersions.findFirst({
    where: and(
      eq(fixtureServiceVersions.fixtureId, fixtureId),
      eq(fixtureServiceVersions.serviceVersionId, serviceVersionId)
    ),
  })

  return !!relation
}

/**
 * Get fixtures that are associated with a specific service version.
 */
export async function getFixturesForServiceVersion(
  db: Database,
  serviceVersionId: string
): Promise<string[]> {
  const relations = await db
    .select({
      fixtureId: fixtureServiceVersions.fixtureId,
    })
    .from(fixtureServiceVersions)
    .where(eq(fixtureServiceVersions.serviceVersionId, serviceVersionId))

  return relations.map(r => r.fixtureId)
}
