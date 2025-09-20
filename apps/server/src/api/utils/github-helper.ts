import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { services } from '../../db/schema'
import type { Database } from '../../db/types'
import { findRepositoryByName, getInstallationConfig, parseRepositoryUrl } from './github-client'
import * as GitHubClient from './github-client'
import { debugLog } from './logger'

export interface GitHubHelper {
  // Repository operations
  getRepositories: () => Promise<GitHubClient.GitHubRepository[]>
  getRepository: (owner: string, repo: string) => Promise<GitHubClient.GitHubRepository>
  findRepositoryByName: (repoName: string) => Promise<GitHubClient.GitHubRepository | null>
  getRepositoryFromService: (serviceName: string) => Promise<{
    repository: GitHubClient.GitHubRepository
    owner: string
    repo: string
  } | null>

  // GitHub Actions operations
  getWorkflows: (owner: string, repo: string) => Promise<GitHubClient.GitHubWorkflow[]>
  getWorkflowRuns: (
    owner: string,
    repo: string,
    options?: {
      workflowId?: string | number
      branch?: string
      event?: string
      status?: 'queued' | 'in_progress' | 'completed'
      perPage?: number
    }
  ) => Promise<GitHubClient.GitHubWorkflowRun[]>
  getWorkflowRun: (
    owner: string,
    repo: string,
    runId: number
  ) => Promise<GitHubClient.GitHubWorkflowRun>
  getWorkflowJobs: (
    owner: string,
    repo: string,
    runId: number
  ) => Promise<GitHubClient.GitHubWorkflowJob[]>
  triggerWorkflow: (
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
    inputs?: Record<string, any>
  ) => Promise<void>

  // Pull Request operations
  getPullRequests: (
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all'
  ) => Promise<GitHubClient.GitHubPullRequest[]>
  getPullRequest: (
    owner: string,
    repo: string,
    pullNumber: number
  ) => Promise<GitHubClient.GitHubPullRequest>
  createPullRequestComment: (
    owner: string,
    repo: string,
    pullNumber: number,
    body: string
  ) => Promise<void>

  // Issue operations
  getIssues: (
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all'
  ) => Promise<GitHubClient.GitHubIssue[]>
  getIssue: (owner: string, repo: string, issueNumber: number) => Promise<GitHubClient.GitHubIssue>
  createIssue: (
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ) => Promise<GitHubClient.GitHubIssue>

  // Commit operations
  getCommits: (owner: string, repo: string, branch?: string) => Promise<GitHubClient.GitHubCommit[]>
  getCommit: (owner: string, repo: string, sha: string) => Promise<GitHubClient.GitHubCommit>

  // File operations
  getFileContent: (
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ) => Promise<{ content: string; encoding: string; sha: string }>
  updateFile: (
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ) => Promise<void>

  // Webhook operations
  createWebhook: (
    owner: string,
    repo: string,
    webhookUrl: string,
    events?: string[]
  ) => Promise<void>

  // Status checks
  createCheckRun: (
    owner: string,
    repo: string,
    headSha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?:
      | 'success'
      | 'failure'
      | 'neutral'
      | 'cancelled'
      | 'skipped'
      | 'timed_out'
      | 'action_required'
  ) => Promise<void>

  // Utility functions
  parseRepositoryUrl: (gitRepositoryUrl: string) => GitHubClient.RepositoryInfo | null
  getInstallationConfig: () => Promise<{
    installationId: number
    appId: string
    privateKey: string
  } | null>
}

export async function createGitHubHelper(db: Database, tenantId: string): Promise<GitHubHelper> {
  // Validate that the tenant has a GitHub installation
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  // Get services for service-to-repository mapping
  const getServicesFromDb = async () => {
    return await db
      .select({
        name: services.name,
        gitRepositoryUrl: services.gitRepositoryUrl,
      })
      .from(services)
      .where(eq(services.tenantId, tenantId))
  }

  return {
    // Repository operations
    getRepositories: () => GitHubClient.getRepositories(db, tenantId),

    getRepository: (owner: string, repo: string) =>
      GitHubClient.getRepository(owner, repo, db, tenantId),

    findRepositoryByName: (repoName: string) =>
      GitHubClient.findRepositoryByName(repoName, db, tenantId),

    getRepositoryFromService: async (serviceName: string) => {
      const services = await getServicesFromDb()
      const service = services.find(s => s.name === serviceName)

      if (!service?.gitRepositoryUrl) {
        return null
      }

      const repoInfo = parseRepositoryUrl(service.gitRepositoryUrl)
      if (!repoInfo) {
        return null
      }

      try {
        const repository = await GitHubClient.getRepository(
          repoInfo.owner,
          repoInfo.repo,
          db,
          tenantId
        )
        return {
          repository,
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        }
      } catch (error) {
        return null
      }
    },

    // GitHub Actions operations
    getWorkflows: (owner: string, repo: string) =>
      GitHubClient.getWorkflows(owner, repo, db, tenantId),

    getWorkflowRuns: (owner: string, repo: string, options = {}) =>
      GitHubClient.getWorkflowRuns(owner, repo, db, tenantId, options),

    getWorkflowRun: (owner: string, repo: string, runId: number) =>
      GitHubClient.getWorkflowRun(owner, repo, runId, db, tenantId),

    getWorkflowJobs: (owner: string, repo: string, runId: number) =>
      GitHubClient.getWorkflowJobs(owner, repo, runId, db, tenantId),

    triggerWorkflow: (owner: string, repo: string, workflowId: string, ref: string, inputs = {}) =>
      GitHubClient.triggerWorkflow(owner, repo, workflowId, ref, inputs, db, tenantId),

    // Pull Request operations
    getPullRequests: (owner: string, repo: string, state = 'open') =>
      GitHubClient.getPullRequests(owner, repo, state, db, tenantId),

    getPullRequest: (owner: string, repo: string, pullNumber: number) =>
      GitHubClient.getPullRequest(owner, repo, pullNumber, db, tenantId),

    createPullRequestComment: (owner: string, repo: string, pullNumber: number, body: string) =>
      GitHubClient.createPullRequestComment(owner, repo, pullNumber, body, db, tenantId),

    // Issue operations
    getIssues: (owner: string, repo: string, state = 'open') =>
      GitHubClient.getIssues(owner, repo, state, db, tenantId),

    getIssue: (owner: string, repo: string, issueNumber: number) =>
      GitHubClient.getIssue(owner, repo, issueNumber, db, tenantId),

    createIssue: (owner: string, repo: string, title: string, body: string, labels = []) =>
      GitHubClient.createIssue(owner, repo, title, body, labels, db, tenantId),

    // Commit operations
    getCommits: (owner: string, repo: string, branch?: string) =>
      GitHubClient.getCommits(owner, repo, branch, db, tenantId),

    getCommit: (owner: string, repo: string, sha: string) =>
      GitHubClient.getCommit(owner, repo, sha, db, tenantId),

    // File operations
    getFileContent: (owner: string, repo: string, path: string, ref?: string) =>
      GitHubClient.getFileContent(owner, repo, path, ref, db, tenantId),

    updateFile: (
      owner: string,
      repo: string,
      path: string,
      content: string,
      message: string,
      sha: string,
      branch?: string
    ) => GitHubClient.updateFile(owner, repo, path, content, message, sha, branch, db, tenantId),

    // Webhook operations
    createWebhook: (
      owner: string,
      repo: string,
      webhookUrl: string,
      events = ['push', 'pull_request']
    ) => GitHubClient.createWebhook(owner, repo, webhookUrl, events, db, tenantId),

    // Status checks
    createCheckRun: (
      owner: string,
      repo: string,
      headSha: string,
      name: string,
      status,
      conclusion
    ) => GitHubClient.createCheckRun(owner, repo, headSha, name, status, conclusion, db, tenantId),

    // Utility functions
    parseRepositoryUrl: parseRepositoryUrl,

    getInstallationConfig: () => getInstallationConfig(db, tenantId),
  }
}

// Hono middleware to add GitHub helper to context
export function withGitHub() {
  return async (c: Context, next: () => Promise<void>) => {
    debugLog('🏁 withGitHub middleware starting')

    const db = c.get('db') as Database
    const session = c.get('session')
    const auth = c.get('auth')

    debugLog('🔍 withGitHub middleware - db:', db ? 'available' : 'null')
    debugLog(
      '🔍 withGitHub middleware - session:',
      session ? { tenantId: session.tenantId, userId: session.userId } : 'null'
    )
    debugLog('🔍 withGitHub middleware - auth:', auth ? { tenantId: auth.tenantId } : 'null')

    const tenantId = session?.tenantId || auth?.tenantId

    if (!tenantId) {
      console.error('❌ No tenant found in session or auth')
      return c.json({ error: 'No tenant found in session' }, 500)
    }

    try {
      debugLog(`🔧 Creating GitHub helper for tenant: ${tenantId}`)
      const github = await createGitHubHelper(db, tenantId)
      debugLog('✅ GitHub helper created successfully')
      c.set('github', github)
    } catch (error) {
      // Don't throw error if GitHub isn't configured, just don't set the helper
      console.warn(
        '⚠️ GitHub integration not available:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      c.set('github', null)
    }

    debugLog('🏁 withGitHub middleware calling next()')
    await next()
    debugLog('🏁 withGitHub middleware finished')
  }
}
