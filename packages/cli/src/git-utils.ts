import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import chalk from 'chalk'

export interface GitInfo {
  sha: string
  repositoryUrl?: string
}

export function getGitSha(): string | null {
  try {
    // First check environment variables (common in CI/CD)
    if (process.env.COMMIT_SHA) {
      return process.env.COMMIT_SHA
    }
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA
    }
    if (process.env.GIT_COMMIT) {
      return process.env.GIT_COMMIT
    }

    // Find git directory starting from current working directory
    const gitDir = findGitDirectory(process.cwd())
    if (!gitDir) {
      return null
    }

    // Read .git/HEAD file
    const headPath = join(gitDir, 'HEAD')
    if (!existsSync(headPath)) {
      return null
    }

    const head = readFileSync(headPath, 'utf8').trim()

    // If HEAD is a reference to a branch, follow it
    if (head.startsWith('ref: ')) {
      const refPath = join(gitDir, head.substring(5))
      if (!existsSync(refPath)) {
        return null
      }
      return readFileSync(refPath, 'utf8').trim()
    }

    // HEAD contains a direct SHA
    return head
  } catch (_error) {
    console.log(
      chalk.yellow('⚠️'),
      'Could not get git SHA - not in a git repository or git not available'
    )
    return null
  }
}

export async function getGitRepositoryUrl(): Promise<string | null> {
  try {
    // Try to get the remote origin URL
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim()

    // Convert SSH URLs to HTTPS
    if (remoteUrl.startsWith('git@github.com:')) {
      const repoPath = remoteUrl.replace('git@github.com:', '').replace('.git', '')
      return `https://github.com/${repoPath}`
    }

    // Handle HTTPS URLs
    if (remoteUrl.startsWith('https://github.com/')) {
      return remoteUrl.replace('.git', '')
    }

    return remoteUrl
  } catch (_error) {
    console.log(chalk.yellow('⚠️'), 'Could not get git repository URL')
    return null
  }
}

// Find the .git directory by walking up the directory tree
function findGitDirectory(startPath: string): string | null {
  let currentPath = startPath
  const root = '/'

  while (currentPath !== root) {
    const gitPath = join(currentPath, '.git')
    if (existsSync(gitPath)) {
      return gitPath
    }
    currentPath = join(currentPath, '..')
  }

  return null
}

export async function getGitInfo(): Promise<GitInfo> {
  const sha = getGitSha()
  const repositoryUrl = await getGitRepositoryUrl()

  return {
    sha: sha || 'unknown',
    repositoryUrl: repositoryUrl || undefined,
  }
}
