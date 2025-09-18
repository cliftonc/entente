import type { Fixture } from '@entente/types'
import { vi } from 'vitest'

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
    getMockFixtures,
  }
}

export const setupFixturesMock = () => {
  const fixtureManagerMock = createMockFixtureManager()

  // Only mock the createFixtureManager function, let everything else use the real implementation
  vi.doMock('@entente/fixtures', async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      createFixtureManager: vi.fn().mockReturnValue(fixtureManagerMock),
    }
  })

  return {
    fixtureManagerMock,
  }
}
