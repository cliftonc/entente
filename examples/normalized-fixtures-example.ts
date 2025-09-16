// Example: Using Normalized Fixtures with Entente Provider
import { createProvider } from '@entente/provider'
import type { NormalizedFixtures } from '@entente/types'

// Example database interface (you would replace this with your actual database)
interface Database {
  batchInsert(table: string, records: any[]): Promise<void>
  clear(table: string): Promise<void>
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

// Mock database for example purposes
const db: Database = {
  async batchInsert(table: string, records: any[]) {
    console.log(`Inserting ${records.length} records into ${table}:`, records)
  },
  async clear(table: string) {
    console.log(`Clearing table: ${table}`)
  },
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    console.log('Starting database transaction')
    const result = await fn()
    console.log('Committing database transaction')
    return result
  },
}

// Example of using normalized fixtures for automatic test data setup
async function setupNormalizedFixtures(fixtures: NormalizedFixtures): Promise<void> {
  console.log('🔧 Setting up normalized fixture data...')
  console.log(
    `📊 Found ${Object.keys(fixtures.entities).length} entity types:`,
    Object.keys(fixtures.entities)
  )

  await db.transaction(async () => {
    // Clear existing test data (optional - depends on your test strategy)
    for (const entityType of Object.keys(fixtures.entities)) {
      const tableName = entityType.toLowerCase() + 's' // Simple pluralization
      await db.clear(tableName)
    }

    // Insert entities with dependency resolution
    const insertOrder = resolveDependencyOrder(fixtures)

    for (const entityType of insertOrder) {
      const entities = fixtures.entities[entityType]
      if (entities.length === 0) continue

      const tableName = entityType.toLowerCase() + 's' // Simple pluralization
      const records = entities.map(entity => entity.data)

      console.log(`Inserting ${entities.length} ${entityType} entities`)
      await db.batchInsert(tableName, records)
    }
  })

  console.log('✅ Normalized fixture data setup completed')
}

// Simple dependency resolution - in practice you might want more sophisticated logic
function resolveDependencyOrder(fixtures: NormalizedFixtures): string[] {
  const entityTypes = Object.keys(fixtures.entities)

  // Simple heuristic: entities referenced by others should be inserted first
  const dependencies = new Map<string, Set<string>>()

  // Analyze relationships to determine dependencies
  for (const rel of fixtures.relationships) {
    if (!dependencies.has(rel.toEntity)) {
      dependencies.set(rel.toEntity, new Set())
    }
    dependencies.get(rel.toEntity)!.add(rel.fromEntity)
  }

  // Sort by dependency count (fewer dependencies first)
  return entityTypes.sort((a, b) => {
    const aDeps = dependencies.get(a)?.size || 0
    const bDeps = dependencies.get(b)?.size || 0
    return aDeps - bDeps
  })
}

// Create provider with normalized fixtures enabled
const provider = createProvider({
  serviceUrl: 'https://entente.company.com',
  apiKey: process.env.ENTENTE_API_KEY!,
  provider: 'order-service',
  providerVersion: '2.1.0',

  // Enable normalized fixtures
  useNormalizedFixtures: true,

  // Provide callback for database setup
  dataSetupCallback: setupNormalizedFixtures,
})

// Example usage in tests
async function runProviderVerification() {
  try {
    console.log('🚀 Starting provider verification with normalized fixtures...')

    const results = await provider.verify({
      baseUrl: 'http://localhost:3000',
      environment: 'test',

      // With normalized fixtures, you may not need state handlers
      // The data is already set up automatically
      stateHandlers: {
        // Only add specific state handlers for complex scenarios
        processPayment: async () => {
          console.log('Setting up specific payment processing state')
          // Custom setup for payment-specific tests
        },
      },

      cleanup: async () => {
        console.log('🧹 Cleaning up after verification')
        // Optional cleanup after each test
      },
    })

    console.log(`✅ Verification completed with ${results.results.length} interactions`)
    const passed = results.results.filter(r => r.success).length
    const failed = results.results.filter(r => !r.success).length

    console.log(`   Passed: ${passed}, Failed: ${failed}`)

    if (failed > 0) {
      console.log('❌ Failed interactions:')
      results.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.interactionId}: ${r.error}`))
    }
  } catch (error) {
    console.error('❌ Provider verification failed:', error)
    process.exit(1)
  }
}

// Example with more advanced database setup
async function advancedSetupExample(fixtures: NormalizedFixtures): Promise<void> {
  console.log('🔧 Advanced normalized fixtures setup...')

  // Custom table mapping
  const tableMapping: Record<string, string> = {
    User: 'users',
    Order: 'orders',
    Product: 'products',
    Customer: 'customers',
    Payment: 'payment_records',
  }

  // Custom field mapping for database schema differences
  const fieldMapping: Record<string, Record<string, string>> = {
    User: {
      id: 'user_id',
      createdAt: 'created_timestamp',
    },
  }

  await db.transaction(async () => {
    for (const [entityType, entities] of Object.entries(fixtures.entities)) {
      if (entities.length === 0) continue

      const tableName = tableMapping[entityType] || entityType.toLowerCase() + 's'
      const fieldMap = fieldMapping[entityType] || {}

      // Transform entities to match database schema
      const records = entities.map(entity => {
        const record = { ...entity.data }

        // Apply field mapping
        for (const [fromField, toField] of Object.entries(fieldMap)) {
          if (fromField in record) {
            record[toField] = record[fromField]
            delete record[fromField]
          }
        }

        return record
      })

      console.log(`Inserting ${entities.length} ${entityType} entities into ${tableName}`)
      await db.batchInsert(tableName, records)
    }
  })

  console.log('✅ Advanced fixture setup completed')
}

// Run the example
if (require.main === module) {
  runProviderVerification().catch(console.error)
}

export { setupNormalizedFixtures, advancedSetupExample, provider }
