import type { VerificationResult } from '@entente/types'
import type { InferSelectModel } from 'drizzle-orm'
import type { createDatabase } from './client'
import type { fixtures, services, specs, verificationResults, verificationTasks } from './schema'
import type * as schema from './schema'

// Drizzle inferred types
export type DbService = InferSelectModel<typeof services>
export type DbFixture = InferSelectModel<typeof fixtures>
export type DbSpec = InferSelectModel<typeof specs>
export type DbVerificationTask = InferSelectModel<typeof verificationTasks>
export type DbVerificationResult = InferSelectModel<typeof verificationResults>

// Type-safe versions of JSONB fields
export interface DbVerificationResultWithTypes extends Omit<DbVerificationResult, 'results'> {
  results: VerificationResult[]
}

export interface DbVerificationTaskWithTypes extends Omit<DbVerificationTask, 'interactions'> {
  interactions: unknown[] // Can be more specific based on your interaction type
}

export interface DbFixtureWithTypes
  extends Omit<DbFixture, 'data' | 'status' | 'source' | 'createdFrom'> {
  data: unknown
  status: 'draft' | 'approved' | 'rejected'
  source: 'consumer' | 'provider' | 'manual'
  createdFrom: unknown
}

// Database connection type
export type DbConnection = ReturnType<typeof createDatabase>
export type Database = DbConnection
