import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGitSha } from '../src/git-utils.js'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

// Don't mock path - use actual implementation

describe('getGitSha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment variables
    delete process.env.COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.GIT_COMMIT
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return COMMIT_SHA from environment', () => {
    process.env.COMMIT_SHA = 'env-commit-sha-123'

    const result = getGitSha()

    expect(result).toBe('env-commit-sha-123')
  })

  it('should return GITHUB_SHA from environment', () => {
    process.env.GITHUB_SHA = 'github-sha-456'

    const result = getGitSha()

    expect(result).toBe('github-sha-456')
  })

  it('should return GIT_COMMIT from environment', () => {
    process.env.GIT_COMMIT = 'git-commit-789'

    const result = getGitSha()

    expect(result).toBe('git-commit-789')
  })

  it('should prioritize COMMIT_SHA over other env vars', () => {
    process.env.COMMIT_SHA = 'commit-sha-priority'
    process.env.GITHUB_SHA = 'github-sha-secondary'
    process.env.GIT_COMMIT = 'git-commit-tertiary'

    const result = getGitSha()

    expect(result).toBe('commit-sha-priority')
  })

  it('should read from .git/HEAD when no env vars are set', async () => {
    const { existsSync, readFileSync } = vi.mocked(await import('fs'))

    // Mock finding .git directory
    existsSync.mockImplementation(path => {
      if (typeof path === 'string' && path.includes('.git')) {
        return true
      }
      return false
    })

    // Mock HEAD file containing direct SHA
    readFileSync.mockReturnValue('abc123def456789direct\n')

    const result = getGitSha()

    expect(result).toBe('abc123def456789direct')
    expect(existsSync).toHaveBeenCalledWith(expect.stringContaining('.git'))
    expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('HEAD'), 'utf8')
  })

  it('should follow ref when HEAD points to a branch', async () => {
    const { existsSync, readFileSync } = vi.mocked(await import('fs'))

    // Mock finding .git directory
    existsSync.mockReturnValue(true)

    // Mock HEAD file containing branch reference
    readFileSync.mockImplementation(path => {
      if (typeof path === 'string' && path.endsWith('HEAD')) {
        return 'ref: refs/heads/main\n'
      }
      if (typeof path === 'string' && path.includes('refs/heads/main')) {
        return 'branch-commit-sha-123\n'
      }
      return ''
    })

    const result = getGitSha()

    expect(result).toBe('branch-commit-sha-123')
    expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('HEAD'), 'utf8')
    expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('refs/heads/main'), 'utf8')
  })

  it('should return null when .git directory is not found', async () => {
    const { existsSync } = vi.mocked(await import('fs'))
    existsSync.mockReturnValue(false)

    const result = getGitSha()

    expect(result).toBeNull()
  })

  it('should return null when HEAD file does not exist', async () => {
    const { existsSync } = vi.mocked(await import('fs'))

    existsSync.mockImplementation(path => {
      if (typeof path === 'string' && path.includes('.git') && !path.includes('HEAD')) {
        return true
      }
      return false
    })

    const result = getGitSha()

    expect(result).toBeNull()
  })

  it('should return null when referenced branch file does not exist', async () => {
    const { existsSync, readFileSync } = vi.mocked(await import('fs'))

    existsSync.mockImplementation(path => {
      if (typeof path === 'string' && path.includes('.git') && !path.includes('refs/heads')) {
        return true
      }
      return false
    })

    readFileSync.mockReturnValue('ref: refs/heads/nonexistent\n')

    const result = getGitSha()

    expect(result).toBeNull()
  })

  it('should handle file system errors gracefully', async () => {
    const { existsSync } = vi.mocked(await import('fs'))
    existsSync.mockImplementation(() => {
      throw new Error('File system error')
    })

    const result = getGitSha()

    expect(result).toBeNull()
  })

  it('should handle read file errors gracefully', async () => {
    const { existsSync, readFileSync } = vi.mocked(await import('fs'))
    existsSync.mockReturnValue(true)
    readFileSync.mockImplementation(() => {
      throw new Error('Read error')
    })

    const result = getGitSha()

    expect(result).toBeNull()
  })

  it('should traverse up directory tree to find .git', async () => {
    const { existsSync } = vi.mocked(await import('fs'))

    // Mock the existsSync to return false for all paths (simulating no .git found)
    existsSync.mockReturnValue(false)

    const result = getGitSha()

    // Should return null when no .git directory is found
    expect(result).toBeNull()
    // Should have been called at least once
    expect(existsSync).toHaveBeenCalled()
  })
})
