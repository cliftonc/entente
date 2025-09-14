import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGitInfo, getGitRepositoryUrl, getGitSha } from './git-utils.js'

// Mock external modules
vi.mock('node:child_process')
vi.mock('node:fs')

describe('Git Utilities', () => {
  const mockExecSync = vi.mocked(execSync)
  const mockExistsSync = vi.mocked(existsSync)
  const mockReadFileSync = vi.mocked(readFileSync)

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.GIT_COMMIT
  })

  describe('getGitSha', () => {
    it('should return SHA from COMMIT_SHA environment variable', () => {
      process.env.COMMIT_SHA = 'env-commit-sha'

      const result = getGitSha()

      expect(result).toBe('env-commit-sha')
    })

    it('should return SHA from GITHUB_SHA environment variable', () => {
      process.env.GITHUB_SHA = 'github-commit-sha'

      const result = getGitSha()

      expect(result).toBe('github-commit-sha')
    })

    it('should return SHA from GIT_COMMIT environment variable', () => {
      process.env.GIT_COMMIT = 'git-commit-sha'

      const result = getGitSha()

      expect(result).toBe('git-commit-sha')
    })

    it('should prioritize COMMIT_SHA over other environment variables', () => {
      process.env.COMMIT_SHA = 'commit-sha'
      process.env.GITHUB_SHA = 'github-sha'
      process.env.GIT_COMMIT = 'git-commit'

      const result = getGitSha()

      expect(result).toBe('commit-sha')
    })

    it('should read SHA from git HEAD file when direct SHA', () => {
      mockExistsSync.mockImplementation(path => {
        return path.includes('.git') && (path.endsWith('/.git') || path.endsWith('/HEAD'))
      })
      mockReadFileSync.mockReturnValue('abc123def456\n')

      // Mock process.cwd
      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBe('abc123def456')
      expect(mockReadFileSync).toHaveBeenCalledWith(join('/mock/cwd', '.git', 'HEAD'), 'utf8')
    })

    it('should follow reference when HEAD points to branch', () => {
      mockExistsSync.mockImplementation(path => {
        return (
          path.includes('.git') &&
          (path.endsWith('/.git') || path.endsWith('/HEAD') || path.includes('/refs/heads/main'))
        )
      })
      mockReadFileSync
        .mockReturnValueOnce('ref: refs/heads/main\n')
        .mockReturnValueOnce('branch-commit-sha\n')

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBe('branch-commit-sha')
      expect(mockReadFileSync).toHaveBeenCalledWith(
        join('/mock/cwd', '.git', 'refs/heads/main'),
        'utf8'
      )
    })

    it('should return null if .git directory not found', () => {
      mockExistsSync.mockReturnValue(false)

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBeNull()
    })

    it('should return null if HEAD file not found', () => {
      mockExistsSync.mockImplementation(path => {
        return path.endsWith('/.git')
      })

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBeNull()
    })

    it('should return null if branch reference file not found', () => {
      mockExistsSync.mockImplementation(path => {
        return path.endsWith('/.git') || path.endsWith('/HEAD')
      })
      mockReadFileSync.mockReturnValue('ref: refs/heads/feature\n')

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBeNull()
    })

    it('should handle file system errors gracefully', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error')
      })

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBeNull()
    })
  })

  describe('getGitRepositoryUrl', () => {
    it('should return HTTPS URL from git remote origin', async () => {
      mockExecSync.mockReturnValue('https://github.com/user/repo.git\n')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('https://github.com/user/repo')
      expect(mockExecSync).toHaveBeenCalledWith('git config --get remote.origin.url', {
        encoding: 'utf8',
      })
    })

    it('should convert SSH URL to HTTPS format', async () => {
      mockExecSync.mockReturnValue('git@github.com:user/repo.git\n')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('https://github.com/user/repo')
    })

    it('should convert SSH URL without .git suffix', async () => {
      mockExecSync.mockReturnValue('git@github.com:user/repo\n')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('https://github.com/user/repo')
    })

    it('should handle HTTPS URLs without .git suffix', async () => {
      mockExecSync.mockReturnValue('https://github.com/user/repo\n')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('https://github.com/user/repo')
    })

    it('should return raw URL for non-GitHub remotes', async () => {
      mockExecSync.mockReturnValue('https://gitlab.com/user/repo.git\n')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('https://gitlab.com/user/repo.git')
    })

    it('should return null if git command fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      const result = await getGitRepositoryUrl()

      expect(result).toBeNull()
    })

    it('should handle empty git remote URL', async () => {
      mockExecSync.mockReturnValue('')

      const result = await getGitRepositoryUrl()

      expect(result).toBe('')
    })
  })

  describe('getGitInfo', () => {
    it('should combine SHA and repository URL', async () => {
      process.env.COMMIT_SHA = 'test-commit-sha'
      mockExecSync.mockReturnValue('https://github.com/user/repo.git\n')

      const result = await getGitInfo()

      expect(result).toEqual({
        sha: 'test-commit-sha',
        repositoryUrl: 'https://github.com/user/repo',
      })
    })

    it('should use "unknown" for SHA if not available', async () => {
      mockExistsSync.mockReturnValue(false)
      mockExecSync.mockReturnValue('https://github.com/user/repo.git\n')

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = await getGitInfo()

      expect(result).toEqual({
        sha: 'unknown',
        repositoryUrl: 'https://github.com/user/repo',
      })
    })

    it('should omit repository URL if not available', async () => {
      process.env.COMMIT_SHA = 'test-commit-sha'
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      const result = await getGitInfo()

      expect(result).toEqual({
        sha: 'test-commit-sha',
        repositoryUrl: undefined,
      })
    })

    it('should handle both SHA and URL being unavailable', async () => {
      mockExistsSync.mockReturnValue(false)
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = await getGitInfo()

      expect(result).toEqual({
        sha: 'unknown',
        repositoryUrl: undefined,
      })
    })
  })

  describe('Git Directory Walking', () => {
    it('should find .git directory in parent directories', () => {
      mockExistsSync.mockImplementation(path => {
        return path.includes('/parent/.git')
      })
      mockReadFileSync.mockReturnValue('abc123\n')

      // Mock process.cwd to return nested directory
      vi.spyOn(process, 'cwd').mockReturnValue('/parent/child/nested')

      const result = getGitSha()

      expect(result).toBe('abc123')
    })

    it('should stop at root directory when searching for .git', () => {
      mockExistsSync.mockReturnValue(false)

      vi.spyOn(process, 'cwd').mockReturnValue('/some/deep/path')

      const result = getGitSha()

      expect(result).toBeNull()
    })
  })

  describe('Environment Variable Handling', () => {
    it('should trim whitespace from environment variables', () => {
      process.env.COMMIT_SHA = '  abc123def456  '

      const result = getGitSha()

      expect(result).toBe('  abc123def456  ')
    })

    it('should handle empty environment variables', () => {
      process.env.COMMIT_SHA = ''
      mockExistsSync.mockReturnValue(false)

      vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd')

      const result = getGitSha()

      expect(result).toBeNull()
    })
  })
})
