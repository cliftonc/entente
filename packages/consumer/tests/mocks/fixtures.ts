import { vi } from 'vitest'
import type { Fixture } from '@entente/types'

export const createMockFixtureManager = () => {
  const mockFixtures: Fixture[] = []

  const propose = vi.fn().mockResolvedValue(undefined)

  const addMockFixture = (fixture: Fixture) => {
    mockFixtures.push(fixture)
  }

  const clearMockFixtures = () => {
    mockFixtures.length = 0
  }

  const getMockFixtures = () => [...mockFixtures]

  return {
    propose,
    addMockFixture,
    clearMockFixtures,
    getMockFixtures
  }
}

export const setupFixturesMock = () => {
  const fixtureManagerMock = createMockFixtureManager()

  const createFixtureManager = vi.fn().mockReturnValue(fixtureManagerMock)

  const extractOperationFromPath = vi.fn().mockReturnValue('test-operation')
  const extractOperationFromSpec = vi.fn().mockReturnValue('test-operation')
  const generateFixtureHash = vi.fn().mockResolvedValue('mock-hash-123')
  const generateInteractionHash = vi.fn().mockResolvedValue('mock-interaction-hash-456')
  const prioritizeFixtures = vi.fn().mockImplementation((fixtures: Fixture[]) => fixtures)

  vi.doMock('@entente/fixtures', () => ({
    createFixtureManager,
    extractOperationFromPath,
    extractOperationFromSpec,
    generateFixtureHash,
    generateInteractionHash,
    prioritizeFixtures
  }))

  return {
    createFixtureManager,
    extractOperationFromPath,
    extractOperationFromSpec,
    generateFixtureHash,
    generateInteractionHash,
    prioritizeFixtures,
    fixtureManagerMock
  }
}