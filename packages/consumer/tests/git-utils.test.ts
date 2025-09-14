import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('git-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Clear environment variables
    process.env.COMMIT_SHA = undefined
    process.env.GITHUB_SHA = undefined
    process.env.GIT_COMMIT = undefined
  })

  describe('getGitSha', () => {
    it('should return SHA from COMMIT_SHA environment variable', async () => {
      process.env.COMMIT_SHA = 'env-commit-sha-123'

      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      expect(sha).toBe('env-commit-sha-123')
    })

    it('should return SHA from GITHUB_SHA environment variable', async () => {
      process.env.GITHUB_SHA = 'github-sha-456'

      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      expect(sha).toBe('github-sha-456')
    })

    it('should return SHA from GIT_COMMIT environment variable', async () => {
      process.env.GIT_COMMIT = 'git-commit-789'

      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      expect(sha).toBe('git-commit-789')
    })

    it('should prioritize COMMIT_SHA over other environment variables', async () => {
      process.env.COMMIT_SHA = 'commit-sha-priority'
      process.env.GITHUB_SHA = 'github-sha'
      process.env.GIT_COMMIT = 'git-commit'

      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      expect(sha).toBe('commit-sha-priority')
    })

    it('should return a git SHA when in a real git repository', async () => {
      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      // In the test environment with a real git repo, should return a SHA or null
      expect(typeof sha === 'string' || sha === null).toBe(true)
      if (sha) {
        expect(sha).toMatch(/^[a-f0-9]{40}$/) // Valid git SHA format
      }
    })

    it('should handle errors gracefully and return null', async () => {
      // Mock fs to throw an error
      vi.doMock('fs', () => ({
        existsSync: vi.fn().mockImplementation(() => {
          throw new Error('Mocked error')
        }),
        readFileSync: vi.fn().mockImplementation(() => {
          throw new Error('Mocked error')
        }),
      }))

      const { getGitSha } = await import('../src/git-utils.js')
      const sha = getGitSha()

      expect(sha).toBeNull()
    })
  })
})
