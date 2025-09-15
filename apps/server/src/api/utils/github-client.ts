import type { Database } from '../db/database'
import { createInstallationToken, getInstallationForTenant } from '../auth/github-app'

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  clone_url: string
  ssh_url: string
  created_at: string
  updated_at: string
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  body: string
  state: 'open' | 'closed' | 'merged'
  user: {
    id: number
    login: string
    avatar_url: string
  }
  base: {
    ref: string
    sha: string
  }
  head: {
    ref: string
    sha: string
  }
  html_url: string
  created_at: string
  updated_at: string
  merged_at: string | null
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  user: {
    id: number
    login: string
    avatar_url: string
  }
  labels: Array<{
    name: string
    color: string
  }>
  html_url: string
  created_at: string
  updated_at: string
}

export interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
  author: {
    id: number
    login: string
    avatar_url: string
  } | null
  html_url: string
}

export interface GitHubWorkflow {
  id: number
  name: string
  path: string
  state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually'
  created_at: string
  updated_at: string
  url: string
  html_url: string
  badge_url: string
}

export interface GitHubWorkflowRun {
  id: number
  name: string | null
  node_id: string
  head_branch: string
  head_sha: string
  path: string
  display_title: string
  run_number: number
  event: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | null
  workflow_id: number
  check_suite_id: number
  check_suite_node_id: string
  url: string
  html_url: string
  pull_requests: Array<{
    url: string
    id: number
    number: number
    head: {
      ref: string
      sha: string
      repo: {
        id: number
        name: string
        url: string
      }
    }
    base: {
      ref: string
      sha: string
      repo: {
        id: number
        name: string
        url: string
      }
    }
  }>
  created_at: string
  updated_at: string
  run_started_at: string
  triggering_actor: {
    login: string
    id: number
    avatar_url: string
  }
  run_attempt: number
}

export interface GitHubWorkflowJob {
  id: number
  run_id: number
  run_url: string
  node_id: string
  head_sha: string
  url: string
  html_url: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | null
  started_at: string
  completed_at: string | null
  name: string
  steps: Array<{
    name: string
    status: 'queued' | 'in_progress' | 'completed'
    conclusion: 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | null
    number: number
    started_at: string | null
    completed_at: string | null
  }>
  check_run_url: string
  labels: string[]
  runner_id: number | null
  runner_name: string | null
  runner_group_id: number | null
  runner_group_name: string | null
}

export interface GitHubActionsConfig {
  owner: string
  repo: string
  installationId: number
  appId: string
  privateKey: string
}

export interface RepositoryInfo {
  owner: string
  repo: string
}

// Utility functions for GitHub API access
export async function getInstallationConfig(db: Database, tenantId: string): Promise<{
  installationId: number
  appId: string
  privateKey: string
} | null> {
  console.log(`🔍 Getting GitHub installation config for tenant: ${tenantId}`)
  const installation = await getInstallationForTenant(db, tenantId)

  if (!installation) {
    console.log(`❌ No GitHub installation found for tenant: ${tenantId}`)
    return null
  }

  console.log(`✅ GitHub installation found - installationId: ${installation.installationId}, appId: ${installation.appId}`)
  return {
    installationId: installation.installationId,
    appId: installation.appId.toString(),
    privateKey: installation.privateKey
  }
}

export async function createGitHubHeaders(installationId: number, appId: string, privateKey: string): Promise<Record<string, string>> {
  const token = await createInstallationToken(installationId, appId, privateKey)

  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Entente-Server',
  }
}

export async function makeGitHubRequest<T>(
  endpoint: string,
  installationId: number,
  appId: string,
  privateKey: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await createGitHubHeaders(installationId, appId, privateKey)

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

// Utility to parse repository URL to owner/repo
export function parseRepositoryUrl(gitRepositoryUrl: string): RepositoryInfo | null {
  // Match GitHub URLs: https://github.com/owner/repo(.git) or git@github.com:owner/repo(.git)
  const httpsMatch = gitRepositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  const sshMatch = gitRepositoryUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  return null
}

// Repository operations
export async function getRepositories(db: Database, tenantId: string): Promise<GitHubRepository[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const data = await makeGitHubRequest<{ repositories: GitHubRepository[] }>(
    '/installation/repositories',
    config.installationId,
    config.appId,
    config.privateKey
  )
  return data.repositories
}

export async function getRepository(owner: string, repo: string, db: Database, tenantId: string): Promise<GitHubRepository> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubRepository>(
    `/repos/${owner}/${repo}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function findRepositoryByName(repoName: string, db: Database, tenantId: string): Promise<GitHubRepository | null> {
  const repos = await getRepositories(db, tenantId)
  return repos.find(repo => repo.name === repoName || repo.full_name.endsWith(`/${repoName}`)) || null
}

// GitHub Actions operations
export async function getWorkflows(owner: string, repo: string, db: Database, tenantId: string): Promise<GitHubWorkflow[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const data = await makeGitHubRequest<{ workflows: GitHubWorkflow[] }>(
    `/repos/${owner}/${repo}/actions/workflows`,
    config.installationId,
    config.appId,
    config.privateKey
  )
  return data.workflows
}

export async function getWorkflowRuns(
  owner: string,
  repo: string,
  db: Database,
  tenantId: string,
  options: {
    workflowId?: string | number
    branch?: string
    event?: string
    status?: 'queued' | 'in_progress' | 'completed'
    perPage?: number
  } = {}
): Promise<GitHubWorkflowRun[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  let endpoint = `/repos/${owner}/${repo}/actions/runs`
  if (options.workflowId) {
    endpoint = `/repos/${owner}/${repo}/actions/workflows/${options.workflowId}/runs`
  }

  const params = new URLSearchParams()
  if (options.branch) params.append('branch', options.branch)
  if (options.event) params.append('event', options.event)
  if (options.status) params.append('status', options.status)
  if (options.perPage) params.append('per_page', options.perPage.toString())

  if (params.toString()) {
    endpoint += `?${params.toString()}`
  }

  const data = await makeGitHubRequest<{ workflow_runs: GitHubWorkflowRun[] }>(
    endpoint,
    config.installationId,
    config.appId,
    config.privateKey
  )
  return data.workflow_runs
}

export async function getWorkflowRun(owner: string, repo: string, runId: number, db: Database, tenantId: string): Promise<GitHubWorkflowRun> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubWorkflowRun>(
    `/repos/${owner}/${repo}/actions/runs/${runId}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function getWorkflowJobs(owner: string, repo: string, runId: number, db: Database, tenantId: string): Promise<GitHubWorkflowJob[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const data = await makeGitHubRequest<{ jobs: GitHubWorkflowJob[] }>(
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
    config.installationId,
    config.appId,
    config.privateKey
  )
  return data.jobs
}

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string,
  ref: string,
  inputs: Record<string, any> = {},
  db: Database,
  tenantId: string
): Promise<void> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  await makeGitHubRequest(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, inputs })
    }
  )
}

// Pull Request operations
export async function getPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  db: Database,
  tenantId: string
): Promise<GitHubPullRequest[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=${state}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function getPullRequest(owner: string, repo: string, pullNumber: number, db: Database, tenantId: string): Promise<GitHubPullRequest> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubPullRequest>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function createPullRequestComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  db: Database,
  tenantId: string
): Promise<void> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  await makeGitHubRequest(
    `/repos/${owner}/${repo}/issues/${pullNumber}/comments`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  )
}

// Issue operations
export async function getIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  db: Database,
  tenantId: string
): Promise<GitHubIssue[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=${state}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function getIssue(owner: string, repo: string, issueNumber: number, db: Database, tenantId: string): Promise<GitHubIssue> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubIssue>(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[] = [],
  db: Database,
  tenantId: string
): Promise<GitHubIssue> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubIssue>(
    `/repos/${owner}/${repo}/issues`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, labels }),
    }
  )
}

// Commit operations
export async function getCommits(owner: string, repo: string, branch: string | undefined, db: Database, tenantId: string): Promise<GitHubCommit[]> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const url = branch
    ? `/repos/${owner}/${repo}/commits?sha=${branch}`
    : `/repos/${owner}/${repo}/commits`

  return makeGitHubRequest<GitHubCommit[]>(
    url,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

export async function getCommit(owner: string, repo: string, sha: string, db: Database, tenantId: string): Promise<GitHubCommit> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  return makeGitHubRequest<GitHubCommit>(
    `/repos/${owner}/${repo}/commits/${sha}`,
    config.installationId,
    config.appId,
    config.privateKey
  )
}

// File operations
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string | undefined,
  db: Database,
  tenantId: string
): Promise<{ content: string; encoding: string; sha: string }> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const url = ref
    ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
    : `/repos/${owner}/${repo}/contents/${path}`

  const response = await makeGitHubRequest<{
    content: string
    encoding: 'base64'
    sha: string
  }>(url, config.installationId, config.appId, config.privateKey)

  return {
    content: response.encoding === 'base64'
      ? Buffer.from(response.content, 'base64').toString('utf8')
      : response.content,
    encoding: response.encoding,
    sha: response.sha,
  }
}

export async function updateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha: string,
  branch: string | undefined,
  db: Database,
  tenantId: string
): Promise<void> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const data: any = {
    message,
    content: Buffer.from(content).toString('base64'),
    sha,
  }

  if (branch) {
    data.branch = branch
  }

  await makeGitHubRequest(
    `/repos/${owner}/${repo}/contents/${path}`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
}

// Webhook operations
export async function createWebhook(
  owner: string,
  repo: string,
  webhookUrl: string,
  events: string[] = ['push', 'pull_request'],
  db: Database,
  tenantId: string
): Promise<void> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  await makeGitHubRequest(
    `/repos/${owner}/${repo}/hooks`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events,
        config: {
          url: webhookUrl,
          content_type: 'json',
        },
      }),
    }
  )
}

// Status checks
export async function createCheckRun(
  owner: string,
  repo: string,
  headSha: string,
  name: string,
  status: 'queued' | 'in_progress' | 'completed',
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | undefined,
  db: Database,
  tenantId: string
): Promise<void> {
  const config = await getInstallationConfig(db, tenantId)
  if (!config) {
    throw new Error('No GitHub App installation found for this tenant')
  }

  const data: any = {
    name,
    head_sha: headSha,
    status,
  }

  if (conclusion && status === 'completed') {
    data.conclusion = conclusion
  }

  await makeGitHubRequest(
    `/repos/${owner}/${repo}/check-runs`,
    config.installationId,
    config.appId,
    config.privateKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
}