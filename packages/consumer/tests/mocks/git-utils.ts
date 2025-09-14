import { vi } from 'vitest'

export const createMockGitUtils = () => {
  let mockGitSha: string | null = 'abc123def456'

  const getGitSha = vi.fn().mockImplementation(() => mockGitSha)

  const setMockGitSha = (sha: string | null) => {
    mockGitSha = sha
  }

  return {
    getGitSha,
    setMockGitSha
  }
}

export const setupGitUtilsMock = () => {
  const gitUtilsMock = createMockGitUtils()

  vi.doMock('../src/git-utils.js', () => gitUtilsMock)

  return gitUtilsMock
}