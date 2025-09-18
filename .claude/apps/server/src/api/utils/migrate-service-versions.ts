import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  contracts,
  deployments,
  fixtureServiceVersions,
  fixtures,
  interactions,
  serviceDependencies,
  serviceVersions,
  services,
  specs,
  verificationResults,
  verificationTasks,
} from '../../db/schema'
import type { Database } from '../../db/types'
import { addServiceVersionToFixture } from './fixture-service-versions'
import { ensureServiceVersion } from './service-versions'

/**
 * Migration script to backfill serviceVersions from existing data.
 * This should be run after the schema migration to populate the new table
 * and update foreign key references.
 */

export async function migrateExistingServiceVersions(db: Database): Promise<void> {
  console.log('🔄 Starting service versions migration...')

  // Step 1: Backfill serviceVersions from all unique service+version combinations
  await backfillServiceVersionsFromExistingData(db)

  // Step 2: Update all tables with serviceVersionIds
  await updateTablesWithVersionIds(db)

  console.log('✅ Service versions migration completed successfully')
}

/**
 * Create ServiceVersion entries from existing data across all tables
 */
async function backfillServiceVersionsFromExistingData(db: Database): Promise<void> {
  console.log('📋 Backfilling serviceVersions from existing data...')

  // Get unique tenant + service + version combinations from all tables
  const uniqueVersions = new Set<string>()

  // From interactions
  console.log('   • Processing interactions...')
  const interactionVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, consumer as service, consumer_version as version
    FROM interactions
    WHERE consumer_version IS NOT NULL AND consumer IS NOT NULL AND tenant_id IS NOT NULL
    UNION
    SELECT DISTINCT tenant_id, service, provider_version as version
    FROM interactions
    WHERE provider_version IS NOT NULL AND service IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of interactionVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    // Skip if any value is null/undefined
    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From contracts
  console.log('   • Processing contracts...')
  const contractVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, consumer_name as service, consumer_version as version
    FROM contracts
    WHERE consumer_version IS NOT NULL AND consumer_name IS NOT NULL AND tenant_id IS NOT NULL
    UNION
    SELECT DISTINCT tenant_id, provider_name as service, provider_version as version
    FROM contracts
    WHERE provider_version IS NOT NULL AND provider_name IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of contractVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From verification tasks
  console.log('   • Processing verification tasks...')
  const verificationVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, consumer as service, consumer_version as version
    FROM verification_tasks
    WHERE consumer_version IS NOT NULL AND consumer IS NOT NULL AND tenant_id IS NOT NULL
    UNION
    SELECT DISTINCT tenant_id, provider as service, provider_version as version
    FROM verification_tasks
    WHERE provider_version IS NOT NULL AND provider IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of verificationVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From verification results
  console.log('   • Processing verification results...')
  const verificationResultVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, consumer as service, consumer_version as version
    FROM verification_results
    WHERE consumer_version IS NOT NULL AND consumer IS NOT NULL AND tenant_id IS NOT NULL
    UNION
    SELECT DISTINCT tenant_id, provider as service, provider_version as version
    FROM verification_results
    WHERE provider_version IS NOT NULL AND provider IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of verificationResultVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From deployments
  console.log('   • Processing deployments...')
  const deploymentVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, service, version
    FROM deployments
    WHERE version IS NOT NULL AND service IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of deploymentVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From fixtures
  console.log('   • Processing fixtures...')
  const fixtureVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, service, service_version as version
    FROM fixtures
    WHERE service_version IS NOT NULL AND service IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of fixtureVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From service dependencies
  console.log('   • Processing service dependencies...')
  const dependencyVersions = await db.execute(sql`
    SELECT DISTINCT sd.tenant_id, s.name as service, sd.consumer_version as version
    FROM service_dependencies sd
    JOIN services s ON sd.consumer_id = s.id
    WHERE sd.consumer_version IS NOT NULL AND s.name IS NOT NULL AND sd.tenant_id IS NOT NULL
  `)

  for (const row of dependencyVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  // From specs
  console.log('   • Processing specs...')
  const specVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, service, version
    FROM specs
    WHERE version IS NOT NULL AND service IS NOT NULL AND tenant_id IS NOT NULL
  `)

  for (const row of specVersions.rows) {
    const tenantId = row[0]
    const serviceName = row[1]
    const version = row[2]

    if (tenantId && serviceName && version) {
      const key = `${tenantId}:${serviceName}:${version}`
      uniqueVersions.add(key)
    }
  }

  console.log(`   📊 Found ${uniqueVersions.size} unique service versions to migrate`)

  // Create serviceVersion entries for all unique combinations
  let count = 0
  for (const versionKey of uniqueVersions) {
    const [tenantId, serviceName, version] = versionKey.split(':')

    try {
      await ensureServiceVersion(db, tenantId, serviceName, version, { createdBy: 'migration' })
      count++

      if (count % 100 === 0) {
        console.log(`   ⏳ Migrated ${count}/${uniqueVersions.size} service versions...`)
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to create service version ${serviceName}@${version}: ${error}`)
    }
  }

  console.log(`   ✅ Created ${count} service versions`)
}

/**
 * Update all existing records with serviceVersionIds
 */
async function updateTablesWithVersionIds(db: Database): Promise<void> {
  console.log('🔗 Updating tables with service version IDs...')

  await updateInteractionsWithVersionIds(db)
  await updateContractsWithVersionIds(db)
  await updateVerificationTasksWithVersionIds(db)
  await updateVerificationResultsWithVersionIds(db)
  await updateDeploymentsWithVersionIds(db)
  await updateFixturesWithVersionIds(db)
  await updateServiceDependenciesWithVersionIds(db)
}

async function updateInteractionsWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating interactions...')

  const interactionsToUpdate = await db.query.interactions.findMany({
    where: isNull(interactions.consumerVersionId),
  })

  let count = 0
  for (const interaction of interactionsToUpdate) {
    try {
      const consumerVersionId = await ensureServiceVersion(
        db,
        interaction.tenantId,
        interaction.consumer,
        interaction.consumerVersion
      )

      const providerVersionId = await ensureServiceVersion(
        db,
        interaction.tenantId,
        interaction.service,
        interaction.providerVersion
      )

      await db
        .update(interactions)
        .set({
          consumerVersionId,
          providerVersionId,
        })
        .where(eq(interactions.id, interaction.id))

      count++
      if (count % 100 === 0) {
        console.log(`     ⏳ Updated ${count}/${interactionsToUpdate.length} interactions...`)
      }
    } catch (error) {
      console.warn(`     ⚠️  Failed to update interaction ${interaction.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} interactions`)
}

async function updateContractsWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating contracts...')

  const contractsToUpdate = await db.query.contracts.findMany({
    where: isNull(contracts.consumerVersionId),
  })

  let count = 0
  for (const contract of contractsToUpdate) {
    try {
      const consumerVersionId = await ensureServiceVersion(
        db,
        contract.tenantId,
        contract.consumerName,
        contract.consumerVersion
      )

      const providerVersionId = await ensureServiceVersion(
        db,
        contract.tenantId,
        contract.providerName,
        contract.providerVersion
      )

      await db
        .update(contracts)
        .set({
          consumerVersionId,
          providerVersionId,
        })
        .where(eq(contracts.id, contract.id))

      count++
    } catch (error) {
      console.warn(`     ⚠️  Failed to update contract ${contract.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} contracts`)
}

async function updateVerificationTasksWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating verification tasks...')

  const tasksToUpdate = await db.query.verificationTasks.findMany({
    where: isNull(verificationTasks.consumerVersionId),
  })

  let count = 0
  for (const task of tasksToUpdate) {
    try {
      const consumerVersionId = await ensureServiceVersion(
        db,
        task.tenantId,
        task.consumer,
        task.consumerVersion
      )

      const providerVersionId = await ensureServiceVersion(
        db,
        task.tenantId,
        task.provider,
        task.providerVersion
      )

      await db
        .update(verificationTasks)
        .set({
          consumerVersionId,
          providerVersionId,
        })
        .where(eq(verificationTasks.id, task.id))

      count++
    } catch (error) {
      console.warn(`     ⚠️  Failed to update verification task ${task.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} verification tasks`)
}

async function updateVerificationResultsWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating verification results...')

  const resultsToUpdate = await db.query.verificationResults.findMany({
    where: isNull(verificationResults.consumerVersionId),
  })

  let count = 0
  for (const result of resultsToUpdate) {
    try {
      const consumerVersionId = result.consumer
        ? await ensureServiceVersion(
            db,
            result.tenantId,
            result.consumer,
            result.consumerVersion || 'unknown'
          )
        : null

      const providerVersionId = await ensureServiceVersion(
        db,
        result.tenantId,
        result.provider,
        result.providerVersion
      )

      await db
        .update(verificationResults)
        .set({
          consumerVersionId,
          providerVersionId,
        })
        .where(eq(verificationResults.id, result.id))

      count++
    } catch (error) {
      console.warn(`     ⚠️  Failed to update verification result ${result.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} verification results`)
}

async function updateDeploymentsWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating deployments...')

  const deploymentsToUpdate = await db.query.deployments.findMany({
    where: isNull(deployments.serviceVersionId),
  })

  let count = 0
  for (const deployment of deploymentsToUpdate) {
    try {
      const serviceVersionId = await ensureServiceVersion(
        db,
        deployment.tenantId,
        deployment.service,
        deployment.version
      )

      await db
        .update(deployments)
        .set({
          serviceVersionId,
        })
        .where(eq(deployments.id, deployment.id))

      count++
    } catch (error) {
      console.warn(`     ⚠️  Failed to update deployment ${deployment.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} deployments`)
}

async function updateFixturesWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating fixtures...')

  const fixturesToUpdate = await db.query.fixtures.findMany()

  let count = 0
  let relationshipCount = 0

  for (const fixture of fixturesToUpdate) {
    try {
      // Handle serviceVersions array
      const serviceVersionsArray = (fixture.serviceVersions as string[]) || [fixture.serviceVersion]

      for (const version of serviceVersionsArray) {
        if (version) {
          // Add each version to the join table
          await addServiceVersionToFixture(
            db,
            fixture.id,
            fixture.tenantId,
            fixture.service,
            version
          )
          relationshipCount++
        }
      }

      count++
      if (count % 100 === 0) {
        console.log(`     ⏳ Updated ${count}/${fixturesToUpdate.length} fixtures...`)
      }
    } catch (error) {
      console.warn(`     ⚠️  Failed to update fixture ${fixture.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} fixtures with ${relationshipCount} version relationships`)
}

async function updateServiceDependenciesWithVersionIds(db: Database): Promise<void> {
  console.log('   • Updating service dependencies...')

  const dependenciesToUpdate = await db.query.serviceDependencies.findMany({
    where: isNull(serviceDependencies.consumerVersionId),
    with: {
      consumer: true,
      provider: true,
    },
  })

  let count = 0
  for (const dependency of dependenciesToUpdate) {
    try {
      const consumerVersionId = dependency.consumer
        ? await ensureServiceVersion(
            db,
            dependency.tenantId,
            dependency.consumer.name,
            dependency.consumerVersion
          )
        : null

      // For provider, we need to infer the version since it's not stored in the dependency
      // We'll use 'latest' as a placeholder
      const providerVersionId = dependency.provider
        ? await ensureServiceVersion(db, dependency.tenantId, dependency.provider.name, 'latest')
        : null

      await db
        .update(serviceDependencies)
        .set({
          consumerVersionId,
          providerVersionId,
        })
        .where(eq(serviceDependencies.id, dependency.id))

      count++
    } catch (error) {
      console.warn(`     ⚠️  Failed to update service dependency ${dependency.id}: ${error}`)
    }
  }

  console.log(`     ✅ Updated ${count} service dependencies`)
}

/**
 * Validation function to check migration completeness
 */
export async function validateServiceVersionsMigration(db: Database): Promise<boolean> {
  console.log('🔍 Validating service versions migration...')

  const checks = []

  // Check interactions
  const interactionsWithoutVersionIds = await db.execute(sql`
    SELECT COUNT(*) FROM interactions WHERE consumer_version_id IS NULL OR provider_version_id IS NULL
  `)
  const interactionsMissing = Number(interactionsWithoutVersionIds.rows[0]?.[0] || 0)
  checks.push({ table: 'interactions', missing: interactionsMissing })

  // Check contracts
  const contractsWithoutVersionIds = await db.execute(sql`
    SELECT COUNT(*) FROM contracts WHERE consumer_version_id IS NULL OR provider_version_id IS NULL
  `)
  const contractsMissing = Number(contractsWithoutVersionIds.rows[0]?.[0] || 0)
  checks.push({ table: 'contracts', missing: contractsMissing })

  // Check fixtures (should have relationships in join table)
  const fixturesWithoutVersionIds = await db.execute(sql`
    SELECT COUNT(*) FROM fixtures f
    WHERE NOT EXISTS (
      SELECT 1 FROM fixture_service_versions fsv
      WHERE fsv.fixture_id = f.id
    )
  `)
  const fixturesMissing = Number(fixturesWithoutVersionIds.rows[0]?.[0] || 0)
  checks.push({ table: 'fixtures', missing: fixturesMissing })

  // Check deployments
  const deploymentsWithoutVersionIds = await db.execute(sql`
    SELECT COUNT(*) FROM deployments WHERE service_version_id IS NULL
  `)
  const deploymentsMissing = Number(deploymentsWithoutVersionIds.rows[0]?.[0] || 0)
  checks.push({ table: 'deployments', missing: deploymentsMissing })

  const totalMissing = checks.reduce((sum, check) => sum + check.missing, 0)

  for (const check of checks) {
    if (check.missing > 0) {
      console.log(`   ⚠️  ${check.table}: ${check.missing} records missing version IDs`)
    } else {
      console.log(`   ✅ ${check.table}: All records have version IDs`)
    }
  }

  const isValid = totalMissing === 0
  console.log(
    isValid
      ? '✅ Migration validation passed'
      : `❌ Migration validation failed: ${totalMissing} missing references`
  )

  return isValid
}
