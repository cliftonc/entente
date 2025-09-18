#!/usr/bin/env node

/**
 * Migration script to backfill serviceVersions table and update foreign key references.
 *
 * Usage:
 *   node dist/scripts/migrate-service-versions.js
 *
 * or with direct TypeScript execution:
 *   npx tsx src/scripts/migrate-service-versions.ts
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/neon-http'
import {
  migrateExistingServiceVersions,
  validateServiceVersionsMigration,
} from '../api/utils/migrate-service-versions'
import * as schema from '../db/schema'

// Load environment variables from .env file
config()

async function main() {
  console.log('🚀 Starting service versions migration script...')

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  // Initialize database connection
  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })

  try {
    // Run the migration
    await migrateExistingServiceVersions(db)

    // Validate the migration
    const isValid = await validateServiceVersionsMigration(db)

    if (isValid) {
      console.log('🎉 Migration completed successfully!')
      process.exit(0)
    } else {
      console.error('❌ Migration validation failed')
      process.exit(1)
    }
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
