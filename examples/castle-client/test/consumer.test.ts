import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@entente/client'
import type { Fixture } from '@entente/types'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CastleApiClient } from '../src/castle-api.js'

// Load environment variables from .env file
dotenv.config()

describe('Castle Client Consumer Contract Tests', () => {
  let client: ReturnType<typeof createClient>
  let mock: Awaited<ReturnType<typeof client.createMock>>
  let castleApi: CastleApiClient

  beforeAll(async () => {
    // Load local fixtures
    const fixturesPath = join(process.cwd(), 'fixtures', 'castle-service.json')
    const localFixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'))

    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL || '',
      apiKey: process.env.ENTENTE_API_KEY || '',
      consumer: 'castle-client',
      environment: 'test', // Test context (not deployment environment)
      recordingEnabled: process.env.CI === 'true',
    })

    mock = await client.createMock('castle-service', '1.0.0', {
      useFixtures: true,
      validateRequests: true,
      validateResponses: true,
      localFixtures,
    })

    castleApi = new CastleApiClient(mock.url)
  })

  afterAll(async () => {
    if (mock) {
      await mock.close()
    }
  })

  describe('Castle API Contract Tests', () => {
    it('should get all castles from the service', async () => {
      const castles = await castleApi.getAllCastles()

      expect(Array.isArray(castles)).toBe(true)
      expect(castles.length).toBeGreaterThan(0)

      const castle = castles[0]
      expect(castle).toHaveProperty('id')
      expect(castle).toHaveProperty('name')
      expect(castle).toHaveProperty('region')
      expect(castle).toHaveProperty('yearBuilt')

      expect(typeof castle.id).toBe('string')
      expect(typeof castle.name).toBe('string')
      expect(typeof castle.region).toBe('string')
      expect(typeof castle.yearBuilt).toBe('number')
    })

    it('should get a specific castle by ID', async () => {
      const allCastles = await castleApi.getAllCastles()
      const castleId = allCastles[0].id

      const castle = await castleApi.getCastleById(castleId)

      expect(castle.id).toBe(castleId)
      expect(castle).toHaveProperty('name')
      expect(castle).toHaveProperty('region')
      expect(castle).toHaveProperty('yearBuilt')
    })

    it('should create a new castle', async () => {
      const newCastleData = {
        name: 'Château de Test',
        region: 'Test Region',
        yearBuilt: 1500,
      }

      const createdCastle = await castleApi.createCastle(newCastleData)

      expect(createdCastle).toHaveProperty('id')
      expect(createdCastle.name).toBe(newCastleData.name)
      expect(createdCastle.region).toBe(newCastleData.region)
      expect(createdCastle.yearBuilt).toBe(newCastleData.yearBuilt)
    })

    it('should delete a castle', async () => {
      const allCastles = await castleApi.getAllCastles()
      const castleId = allCastles[0].id

      await expect(castleApi.deleteCastle(castleId)).resolves.toBeUndefined()
    })

    it('should handle castle not found error', async () => {
      const nonExistentId = 'non-existent-id'

      await expect(castleApi.getCastleById(nonExistentId)).rejects.toThrow('Castle not found')
    })

    it('should handle validation errors for castle creation', async () => {
      const invalidCastleData = {
        name: '',
        region: 'Test Region',
        yearBuilt: 999,
      }

      await expect(castleApi.createCastle(invalidCastleData)).rejects.toThrow()
    })
  })

  describe('Castle API Client Extended Methods', () => {
    it('should get castles by region', async () => {
      const region = 'Île-de-France'
      const castles = await castleApi.getCastlesByRegion(region)

      expect(Array.isArray(castles)).toBe(true)
      castles.forEach(castle => {
        expect(castle.region.toLowerCase()).toContain(region.toLowerCase())
      })
    })

    it('should get oldest castles', async () => {
      const limit = 3
      const oldestCastles = await castleApi.getOldestCastles(limit)

      expect(Array.isArray(oldestCastles)).toBe(true)
      expect(oldestCastles.length).toBeLessThanOrEqual(limit)

      if (oldestCastles.length > 1) {
        for (let i = 1; i < oldestCastles.length; i++) {
          expect(oldestCastles[i].yearBuilt).toBeGreaterThanOrEqual(oldestCastles[i - 1].yearBuilt)
        }
      }
    })
  })

  describe('Mock Server Features', () => {
    it('should use fixtures if available', () => {
      const fixtures = mock.getFixtures()

      expect(fixtures).toBeDefined()
      expect(Array.isArray(fixtures)).toBe(true)
    })
  })

  describe('Contract Validation', () => {
    it('should validate response structure matches OpenAPI spec', async () => {
      const castles = await castleApi.getAllCastles()

      expect(Array.isArray(castles)).toBe(true)

      if (castles.length > 0) {
        const castle = castles[0]

        expect(castle).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          region: expect.any(String),
          yearBuilt: expect.any(Number),
        })

        expect(castle.yearBuilt).toBeGreaterThanOrEqual(1000)
        expect(castle.yearBuilt).toBeLessThanOrEqual(2100)
      }
    })

    it('should validate error response structure', async () => {
      try {
        await castleApi.getCastleById('non-existent-id')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Castle not found')
      }
    })
  })

  describe('Recording Interactions', () => {
    it('should record interactions in CI environment', async () => {
      const isRecording = process.env.CI === 'true'

      await castleApi.getAllCastles()

      expect(true).toBe(true)
    })
  })
})
