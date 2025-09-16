# Service Versioning Architecture Refactor Plan

## Executive Summary

This document outlines a comprehensive refactoring of the Entente platform to introduce **ServiceVersions** as first-class entities. Currently, versions are simple strings scattered throughout the system. This refactor will create a central ServiceVersion entity that owns specs, metadata, and serves as the single source of truth for all version references.

## Current State Analysis

### Problems with Current Architecture

1. **Version Strings Everywhere**: `consumerVersion` and `providerVersion` are just strings in:
   - contracts table
   - interactions table
   - verificationTasks table
   - verificationResults table
   - deployments table
   - fixtures table
   - serviceDependencies table

2. **Specs Disconnected from Versions**:
   - Specs table has version/branch/environment but no formal relationship
   - Specs are looked up through deployments (backwards)
   - No clear ownership of specs by versions

3. **No Version Entity**:
   - Versions are just strings, not entities with properties
   - No place to store version metadata (git SHA, package.json, etc.)
   - No version lifecycle management

4. **Deployment Confusion**:
   - System conflates "deployed version" with "service version"
   - Specs are tied to deployments rather than versions
   - Version resolution goes through deployment lookup

5. **Fixture Version Issues**:
   - When requesting mock for version "0.1.0", system may use spec from "1.0.0"
   - Fixtures get created with wrong versions
   - No proper version matching/resolution

## Proposed Architecture

### New Core Entity: ServiceVersions

```sql
CREATE TABLE service_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_id UUID NOT NULL REFERENCES services(id),
  version VARCHAR(100) NOT NULL,
  spec JSONB, -- Nullable initially, can be added later
  git_sha VARCHAR(40),
  package_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, service_id, version)
);
```

### Key Principles

1. **Non-Breaking Migration**: Add new columns/tables without removing existing ones
2. **Auto-Creation**: Service versions are created automatically when referenced
3. **Gradual Adoption**: Dual-write to both old strings and new IDs
4. **Backward Compatible**: Old code continues to work with strings
5. **Forward Compatible**: New code can use IDs when available

## Implementation Phases

### Phase 1: Database Schema Changes (Non-Breaking)

#### 1.1 Create ServiceVersions Table

```typescript
// New table: service_versions
export const serviceVersions = pgTable('service_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  serviceId: uuid('service_id').references(() => services.id).notNull(),
  version: varchar('version', { length: 100 }).notNull(),
  spec: jsonb('spec'), // Nullable - can be added later
  gitSha: varchar('git_sha', { length: 40 }),
  packageJson: jsonb('package_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  tenantServiceVersionUnique: unique().on(table.tenantId, table.serviceId, table.version),
}))
```

#### 1.2 Add Nullable Foreign Keys to Existing Tables

**contracts table**:
```sql
ALTER TABLE contracts
ADD COLUMN consumer_version_id UUID REFERENCES service_versions(id),
ADD COLUMN provider_version_id UUID REFERENCES service_versions(id);
-- Keep existing: consumer_version, provider_version
```

**interactions table**:
```sql
ALTER TABLE interactions
ADD COLUMN consumer_version_id UUID REFERENCES service_versions(id),
ADD COLUMN provider_version_id UUID REFERENCES service_versions(id);
-- Keep existing: consumer_version, provider_version
```

**verification_tasks table**:
```sql
ALTER TABLE verification_tasks
ADD COLUMN consumer_version_id UUID REFERENCES service_versions(id),
ADD COLUMN provider_version_id UUID REFERENCES service_versions(id);
-- Keep existing: consumer_version, provider_version
```

**verification_results table**:
```sql
ALTER TABLE verification_results
ADD COLUMN consumer_version_id UUID REFERENCES service_versions(id),
ADD COLUMN provider_version_id UUID REFERENCES service_versions(id);
-- Keep existing: consumer_version, provider_version
```

**deployments table**:
```sql
ALTER TABLE deployments
ADD COLUMN service_version_id UUID REFERENCES service_versions(id);
-- Keep existing: version
```

**fixtures table**:
```sql
ALTER TABLE fixtures
ADD COLUMN service_version_id UUID REFERENCES service_versions(id),
ADD COLUMN service_version_ids UUID[]; -- Array for multi-version support
-- Keep existing: service_version, service_versions
```

**service_dependencies table**:
```sql
ALTER TABLE service_dependencies
ADD COLUMN consumer_version_id UUID REFERENCES service_versions(id),
ADD COLUMN provider_version_id UUID REFERENCES service_versions(id);
-- Keep existing: consumer_version
```

### Phase 2: Auto-Creation Logic Implementation

#### 2.1 Core Helper Function

```typescript
// File: apps/server/src/api/utils/service-versions.ts

export async function ensureServiceVersion(
  db: Database,
  tenantId: string,
  serviceName: string,
  version: string,
  metadata?: {
    spec?: OpenAPISpec,
    gitSha?: string,
    packageJson?: any,
    createdBy?: string
  }
): Promise<string> { // Returns serviceVersionId

  // 1. Find or create service
  let service = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, serviceName)
    )
  })

  if (!service) {
    // Auto-create service if it doesn't exist
    const [newService] = await db
      .insert(services)
      .values({
        tenantId,
        name: serviceName,
        type: 'consumer/provider', // Default type
        createdAt: new Date(),
        updatedAt: new Date()
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
    )
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
        gitSha: metadata?.gitSha,
        packageJson: metadata?.packageJson,
        createdBy: metadata?.createdBy || 'auto-created',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()
    serviceVersion = newVersion
  } else if (!serviceVersion.spec && metadata?.spec) {
    // Update with spec if we have one and version doesn't
    await db
      .update(serviceVersions)
      .set({
        spec: metadata.spec,
        gitSha: metadata.gitSha || serviceVersion.gitSha,
        packageJson: metadata.packageJson || serviceVersion.packageJson,
        updatedAt: new Date()
      })
      .where(eq(serviceVersions.id, serviceVersion.id))
  }

  return serviceVersion.id
}
```

#### 2.2 Semver Matching Helper

```typescript
// File: apps/server/src/api/utils/semver-match.ts

export function findBestSemverMatch(
  requested: string,
  available: Array<{ id: string; version: string }>
): { id: string; version: string } | null {

  // Parse version numbers (handle x.y.z format)
  const parseVersion = (version: string): [number, number, number] | null => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) return null
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
  }

  const requestedParts = parseVersion(requested)
  if (!requestedParts) {
    // If not semver format, try exact match
    return available.find(v => v.version === requested) || null
  }

  const [reqMajor, reqMinor, reqPatch] = requestedParts

  // Filter and sort available versions
  const compatibleVersions = available
    .map(item => {
      const parts = parseVersion(item.version)
      if (!parts) return null
      return { ...item, parts }
    })
    .filter(item => {
      if (!item) return false
      const [major] = item.parts
      // Same major version = compatible
      return major === reqMajor
    })
    .sort((a, b) => {
      if (!a || !b) return 0
      const [aMajor, aMinor, aPatch] = a.parts
      const [bMajor, bMinor, bPatch] = b.parts

      // Prefer exact match
      if (a.version === requested) return -1
      if (b.version === requested) return 1

      // Then prefer closest minor.patch
      if (aMinor !== bMinor) return bMinor - aMinor
      return bPatch - aPatch
    })

  // If no compatible version in same major, fall back to latest
  if (compatibleVersions.length === 0) {
    const latest = available
      .map(item => {
        const parts = parseVersion(item.version)
        if (!parts) return null
        return { ...item, parts }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0
        const [aMajor, aMinor, aPatch] = a.parts
        const [bMajor, bMinor, bPatch] = b.parts
        if (aMajor !== bMajor) return bMajor - aMajor
        if (aMinor !== bMinor) return bMinor - aMinor
        return bPatch - aPatch
      })

    return latest[0] || null
  }

  return compatibleVersions[0] || null
}
```

### Phase 3: API Endpoint Updates

#### 3.1 Interaction Recording

```typescript
// File: apps/server/src/api/routes/interactions.ts
// POST /api/interactions

// Before processing interaction:
const consumerVersionId = await ensureServiceVersion(
  db,
  tenantId,
  interaction.consumer,
  interaction.consumerVersion,
  {
    gitSha: interaction.consumerGitSha,
    createdBy: 'interaction-recording'
  }
)

const providerVersionId = await ensureServiceVersion(
  db,
  tenantId,
  interaction.service,
  interaction.providerVersion,
  { createdBy: 'interaction-recording' }
)

// Store interaction with both old and new fields
await db.insert(interactions).values({
  ...interaction,
  consumerVersion: interaction.consumerVersion, // Keep string
  consumerVersionId, // Add ID
  providerVersion: interaction.providerVersion, // Keep string
  providerVersionId  // Add ID
})
```

#### 3.2 Fixture Creation

```typescript
// File: apps/server/src/api/routes/fixtures.ts
// POST /api/fixtures

// When creating/updating fixture:
const serviceVersionId = await ensureServiceVersion(
  db,
  tenantId,
  proposal.service,
  proposal.serviceVersion,
  { createdBy: 'fixture-creation' }
)

// For existing fixture (deduplication case):
if (existingFixture) {
  const existingVersionIds = existingFixture.serviceVersionIds || []

  if (!existingVersionIds.includes(serviceVersionId)) {
    // Add new version to array
    await db
      .update(fixtures)
      .set({
        serviceVersions: [...(existingFixture.serviceVersions || []), proposal.serviceVersion],
        serviceVersionIds: [...existingVersionIds, serviceVersionId],
        serviceVersion: proposal.serviceVersion // Update for compatibility
      })
      .where(eq(fixtures.id, existingFixture.id))
  }
}

// For new fixture:
await db.insert(fixtures).values({
  ...proposal,
  serviceVersion: proposal.serviceVersion, // Keep string
  serviceVersions: [proposal.serviceVersion], // Keep string array
  serviceVersionId, // Add ID
  serviceVersionIds: [serviceVersionId] // Add ID array
})
```

#### 3.3 Spec Upload/Update

```typescript
// File: apps/server/src/api/routes/specs.ts
// POST /api/specs/:service

const serviceVersionId = await ensureServiceVersion(
  db,
  tenantId,
  service,
  metadata.version,
  {
    spec: spec, // The actual OpenAPI spec
    gitSha: metadata.gitSha,
    packageJson: metadata.packageJson,
    createdBy: metadata.uploadedBy || 'spec-upload'
  }
)

// Continue to store in specs table for backward compatibility
await db.insert(specs).values({
  ...existingSpecData,
  // Also could add service_version_id here for reference
})
```

#### 3.4 Mock Creation (Consumer)

```typescript
// File: apps/server/src/api/routes/specs.ts
// GET /api/specs/:service/by-provider-version

const service = c.req.param('service')
const requestedVersion = c.req.query('providerVersion')

// Find all service versions for this service
const serviceObj = await db.query.services.findFirst({
  where: and(
    eq(services.tenantId, tenantId),
    eq(services.name, service)
  )
})

if (!serviceObj) {
  return c.json({ error: 'Service not found' }, 404)
}

const allVersions = await db.query.serviceVersions.findMany({
  where: and(
    eq(serviceVersions.tenantId, tenantId),
    eq(serviceVersions.serviceId, serviceObj.id)
  )
})

// Find best match using semver
let selectedVersion = null
if (requestedVersion === 'latest') {
  // Get latest version
  selectedVersion = allVersions
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
} else {
  // Try exact match first
  selectedVersion = allVersions.find(v => v.version === requestedVersion)

  // If no exact match, use semver matching
  if (!selectedVersion) {
    const match = findBestSemverMatch(requestedVersion, allVersions)
    if (match) {
      selectedVersion = allVersions.find(v => v.id === match.id)
      console.log(`Version ${requestedVersion} not found for ${service}, using best match: ${match.version}`)
    }
  }
}

if (!selectedVersion) {
  return c.json({
    error: 'No compatible version found',
    requested: requestedVersion,
    available: allVersions.map(v => v.version)
  }, 404)
}

// Return spec from ServiceVersion
return c.json({
  spec: selectedVersion.spec || {}, // Return empty spec if none stored
  metadata: {
    providerVersion: selectedVersion.version, // Return actual version used
    serviceVersionId: selectedVersion.id,
    specVersion: selectedVersion.version,
    gitSha: selectedVersion.gitSha,
    hasSpec: !!selectedVersion.spec,
    createdAt: selectedVersion.createdAt
  }
})
```

### Phase 4: Query Updates (Dual Support)

#### 4.1 Reading Fixtures

```typescript
// Support both old and new lookup
const whereConditions = []

if (version) {
  // Try new way first (serviceVersionIds array contains)
  if (await hasServiceVersionsColumn()) {
    const versionObj = await findServiceVersion(tenantId, service, version)
    if (versionObj) {
      whereConditions.push(
        sql`${fixtures.serviceVersionIds} @> ARRAY[${versionObj.id}]::uuid[]`
      )
    } else {
      // Fall back to string match
      whereConditions.push(
        sql`${fixtures.serviceVersions} @> ${JSON.stringify([version])}`
      )
    }
  } else {
    // Old way only
    whereConditions.push(eq(fixtures.serviceVersion, version))
  }
}
```

#### 4.2 Contract Lookups

```typescript
// When querying contracts, join with service_versions for richer data
const contractsWithVersions = await db
  .select({
    contract: contracts,
    consumerVersion: serviceVersions.version,
    consumerSpec: serviceVersions.spec,
    providerVersion: providerVersions.version,
    providerSpec: providerVersions.spec
  })
  .from(contracts)
  .leftJoin(
    serviceVersions,
    eq(contracts.consumerVersionId, serviceVersions.id)
  )
  .leftJoin(
    providerVersions,
    eq(contracts.providerVersionId, providerVersions.id)
  )
  .where(conditions)
```

### Phase 5: Migration Scripts

#### 5.1 Backfill ServiceVersions from Existing Data

```typescript
// Migration script to create ServiceVersion entries from existing data

async function migrateExistingVersions() {
  // 1. From interactions
  const uniqueVersions = await db.execute(sql`
    SELECT DISTINCT tenant_id, consumer as service, consumer_version as version
    FROM interactions
    UNION
    SELECT DISTINCT tenant_id, service, provider_version as version
    FROM interactions
  `)

  for (const row of uniqueVersions) {
    await ensureServiceVersion(
      db,
      row.tenant_id,
      row.service,
      row.version,
      { createdBy: 'migration' }
    )
  }

  // 2. From specs table
  const specs = await db.query.specs.findMany()
  for (const spec of specs) {
    await ensureServiceVersion(
      db,
      spec.tenantId,
      spec.service,
      spec.version,
      {
        spec: spec.spec,
        createdBy: 'migration-from-specs'
      }
    )
  }

  // 3. Update all tables with serviceVersionIds
  await updateInteractionsWithVersionIds()
  await updateContractsWithVersionIds()
  await updateFixturesWithVersionIds()
  // ... etc
}
```

#### 5.2 Update Existing Records with Version IDs

```typescript
async function updateInteractionsWithVersionIds() {
  const interactions = await db.query.interactions.findMany({
    where: isNull(interactions.consumerVersionId)
  })

  for (const interaction of interactions) {
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
        providerVersionId
      })
      .where(eq(interactions.id, interaction.id))
  }
}
```

### Phase 6: Package Updates

#### 6.1 Consumer Package

```typescript
// packages/consumer/src/index.ts

// When creating mock, receive serviceVersionId in response
const { spec, metadata } = await fetchSpec(...)
const serviceVersionId = metadata.serviceVersionId

// Use serviceVersionId when recording interactions
if (recorder) {
  await recorder.record({
    ...interaction,
    serviceVersionId, // Include the version ID
    providerVersion: metadata.providerVersion // Keep string too
  })
}

// When proposing fixtures
await fixtureManager.propose({
  ...fixture,
  serviceVersionId, // Include the version ID
  serviceVersion: providerVersion // Keep string too
})
```

#### 6.2 Provider Package

```typescript
// packages/provider/src/index.ts

// When fetching verification tasks
const tasks = await getVerificationTasks()

// Tasks now include serviceVersionIds
for (const task of tasks) {
  // Can use serviceVersionId to fetch spec directly
  const spec = await getServiceVersionSpec(task.providerVersionId)
}
```

### Phase 7: Final Cleanup (Future)

After all data has been migrated and system is stable:

1. **Make Foreign Keys Required**
   ```sql
   ALTER TABLE interactions
   ALTER COLUMN consumer_version_id SET NOT NULL,
   ALTER COLUMN provider_version_id SET NOT NULL;
   ```

2. **Remove Old String Columns**
   ```sql
   ALTER TABLE interactions
   DROP COLUMN consumer_version,
   DROP COLUMN provider_version;
   ```

3. **Remove Backward Compatibility Code**
   - Remove string fallbacks
   - Remove dual-write logic
   - Simplify queries to only use IDs

## Benefits of This Architecture

### Immediate Benefits
1. **Auto-Creation**: System "just works" - no need to pre-register versions
2. **Backward Compatible**: Existing code continues to work
3. **Spec Ownership**: Clear ownership of specs by versions
4. **Version Metadata**: Can store git SHA, package.json with versions

### Long-term Benefits
1. **Data Integrity**: All version references are validated FKs
2. **Efficient Queries**: Direct joins instead of string matching
3. **Immutable Specs**: Each version has its immutable spec
4. **Semver Support**: Proper semantic version matching
5. **Single Source of Truth**: ServiceVersion is the authoritative source

## Implementation Timeline

### Week 1: Foundation
- [ ] Create serviceVersions table
- [ ] Add nullable FK columns to all tables
- [ ] Implement ensureServiceVersion function
- [ ] Implement semver matching logic

### Week 2: Core APIs
- [ ] Update interaction recording
- [ ] Update fixture creation
- [ ] Update spec upload
- [ ] Update mock creation endpoint

### Week 3: Migration
- [ ] Create migration scripts
- [ ] Backfill serviceVersions from existing data
- [ ] Update existing records with version IDs
- [ ] Test dual-write functionality

### Week 4: Package Updates
- [ ] Update consumer package
- [ ] Update provider package
- [ ] Update CLI
- [ ] Update documentation

### Week 5: Testing & Validation
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Data validation
- [ ] Fix any issues

### Future: Cleanup
- [ ] Monitor adoption
- [ ] Plan string column removal
- [ ] Remove backward compatibility code

## Risk Mitigation

### Risks
1. **Data Inconsistency**: Version IDs might not match strings
   - **Mitigation**: Dual-write and validation scripts

2. **Performance Impact**: Additional joins and lookups
   - **Mitigation**: Proper indexes, caching

3. **Migration Failures**: Large data sets might fail
   - **Mitigation**: Batch processing, resumable migrations

4. **API Compatibility**: Breaking existing integrations
   - **Mitigation**: Keep all existing fields, add new ones

## Success Metrics

1. **Zero Breaking Changes**: All existing APIs continue to work
2. **100% Version Coverage**: All versions have ServiceVersion entries
3. **Performance Maintained**: No degradation in API response times
4. **Successful Migration**: All records have version IDs populated
5. **Clean Semver Matching**: Correct version resolution for mocks

## Open Questions

1. Should we enforce spec upload when creating versions?
   - **Decision**: No, specs can be optional and added later

2. How to handle version conflicts across tenants?
   - **Decision**: Versions are tenant-scoped, no conflicts

3. Should we auto-migrate on read or require explicit migration?
   - **Decision**: Auto-create on write, explicit migration for existing data

4. What about version ranges (^1.0.0, ~1.0.0)?
   - **Decision**: Future enhancement, start with exact and semver matching

## Appendix A: Database Schema DDL

```sql
-- Complete DDL for all changes
-- To be generated from Drizzle schema files
```

## Appendix B: API Changes Summary

### New Endpoints
- `GET /api/services/:service/versions` - List versions
- `POST /api/services/:service/versions` - Create version
- `GET /api/services/:service/versions/:version` - Get specific version

### Modified Endpoints
- `POST /api/interactions` - Auto-creates versions
- `POST /api/fixtures` - Auto-creates versions
- `GET /api/specs/:service/by-provider-version` - Uses serviceVersions

### Unchanged Endpoints
- All existing endpoints continue to work with string versions

---

*This document is a living document and will be updated as implementation proceeds.*