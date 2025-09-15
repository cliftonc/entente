import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { databaseMiddleware } from '../middleware/database'
import { withGitHub } from '../utils/github-helper'

export const githubRoutes = new Hono()

console.log('📂 GitHub routes module loaded')
console.log('🔍 withGitHub function:', typeof withGitHub)

// Apply middleware (auth and database already applied at main app level)
githubRoutes.use('*', withGitHub())

// Debug endpoint
githubRoutes.get('/debug', async (c) => {
  console.log('🐛 GitHub debug endpoint reached')
  console.log('🔍 Context keys available:', Object.keys(c.var))
  const github = c.get('github')
  console.log('🔍 GitHub helper in context:', github ? 'available' : 'null')
  return c.json({ message: 'GitHub routes are working', timestamp: new Date().toISOString(), github: github ? 'available' : 'null' })
})

console.log('✅ GitHub debug route registered')

// Get all repositories accessible to the tenant
githubRoutes.get('/repositories', async (c) => {
  console.log('🚀 GitHub repositories endpoint called')
  const github = c.get('github')

  console.log('🔍 GitHub helper availability:', github ? '✅ Available' : '❌ Not available')

  if (!github) {
    console.error('❌ GitHub integration not available for this tenant')
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  try {
    console.log('📡 Fetching repositories from GitHub...')
    const repositories = await github.getRepositories()
    console.log(`✅ Successfully fetched ${repositories.length} repositories`)
    return c.json({ repositories })
  } catch (error) {
    console.error('❌ Error fetching repositories:', error)
    return c.json({ error: 'Failed to fetch repositories' }, 500)
  }
})

// Get repository details by owner/repo
githubRoutes.get('/repository/:owner/:repo', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()

  try {
    const repository = await github.getRepository(owner, repo)
    return c.json({ repository })
  } catch (error) {
    console.error('Error fetching repository:', error)
    return c.json({ error: 'Failed to fetch repository' }, 500)
  }
})

// Find repository by service name
githubRoutes.get('/repository/service/:serviceName', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { serviceName } = c.req.param()

  try {
    const result = await github.getRepositoryFromService(serviceName)
    if (!result) {
      return c.json({ error: 'Repository not found for service' }, 404)
    }

    return c.json(result)
  } catch (error) {
    console.error('Error finding repository for service:', error)
    return c.json({ error: 'Failed to find repository for service' }, 500)
  }
})

// Get workflows for a repository
githubRoutes.get('/repository/:owner/:repo/workflows', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()

  try {
    const workflows = await github.getWorkflows(owner, repo)
    return c.json({ workflows })
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return c.json({ error: 'Failed to fetch workflows' }, 500)
  }
})

// Get workflow runs for a repository
githubRoutes.get('/repository/:owner/:repo/workflow-runs', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()

  // Parse query parameters
  const workflowId = c.req.query('workflow_id')
  const branch = c.req.query('branch')
  const event = c.req.query('event')
  const status = c.req.query('status') as 'queued' | 'in_progress' | 'completed' | undefined
  const perPage = c.req.query('per_page') ? parseInt(c.req.query('per_page')!) : undefined

  const options = {
    ...(workflowId && { workflowId }),
    ...(branch && { branch }),
    ...(event && { event }),
    ...(status && { status }),
    ...(perPage && { perPage }),
  }

  try {
    const workflowRuns = await github.getWorkflowRuns(owner, repo, options)
    return c.json({ workflow_runs: workflowRuns })
  } catch (error) {
    console.error('Error fetching workflow runs:', error)
    return c.json({ error: 'Failed to fetch workflow runs' }, 500)
  }
})

// Get a specific workflow run
githubRoutes.get('/repository/:owner/:repo/workflow-runs/:runId', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo, runId } = c.req.param()

  try {
    const workflowRun = await github.getWorkflowRun(owner, repo, parseInt(runId))
    return c.json({ workflow_run: workflowRun })
  } catch (error) {
    console.error('Error fetching workflow run:', error)
    return c.json({ error: 'Failed to fetch workflow run' }, 500)
  }
})

// Get jobs for a workflow run
githubRoutes.get('/repository/:owner/:repo/workflow-runs/:runId/jobs', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo, runId } = c.req.param()

  try {
    const jobs = await github.getWorkflowJobs(owner, repo, parseInt(runId))
    return c.json({ jobs })
  } catch (error) {
    console.error('Error fetching workflow jobs:', error)
    return c.json({ error: 'Failed to fetch workflow jobs' }, 500)
  }
})

// Trigger a workflow
githubRoutes.post('/repository/:owner/:repo/workflows/:workflowId/dispatch', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo, workflowId } = c.req.param()

  try {
    const body = await c.req.json()
    const { ref = 'main', inputs = {} } = body

    await github.triggerWorkflow(owner, repo, workflowId, ref, inputs)
    return c.json({ message: 'Workflow triggered successfully' })
  } catch (error) {
    console.error('Error triggering workflow:', error)
    return c.json({ error: 'Failed to trigger workflow' }, 500)
  }
})

// Get pull requests for a repository
githubRoutes.get('/repository/:owner/:repo/pulls', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()
  const state = c.req.query('state') as 'open' | 'closed' | 'all' || 'open'

  try {
    const pullRequests = await github.getPullRequests(owner, repo, state)
    return c.json({ pull_requests: pullRequests })
  } catch (error) {
    console.error('Error fetching pull requests:', error)
    return c.json({ error: 'Failed to fetch pull requests' }, 500)
  }
})

// Get a specific pull request
githubRoutes.get('/repository/:owner/:repo/pulls/:pullNumber', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo, pullNumber } = c.req.param()

  try {
    const pullRequest = await github.getPullRequest(owner, repo, parseInt(pullNumber))
    return c.json({ pull_request: pullRequest })
  } catch (error) {
    console.error('Error fetching pull request:', error)
    return c.json({ error: 'Failed to fetch pull request' }, 500)
  }
})

// Comment on a pull request
githubRoutes.post('/repository/:owner/:repo/pulls/:pullNumber/comments', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo, pullNumber } = c.req.param()

  try {
    const body = await c.req.json()
    const { comment } = body

    if (!comment) {
      return c.json({ error: 'Comment body is required' }, 400)
    }

    await github.createPullRequestComment(owner, repo, parseInt(pullNumber), comment)
    return c.json({ message: 'Comment created successfully' })
  } catch (error) {
    console.error('Error creating pull request comment:', error)
    return c.json({ error: 'Failed to create comment' }, 500)
  }
})

// Get issues for a repository
githubRoutes.get('/repository/:owner/:repo/issues', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()
  const state = c.req.query('state') as 'open' | 'closed' | 'all' || 'open'

  try {
    const issues = await github.getIssues(owner, repo, state)
    return c.json({ issues })
  } catch (error) {
    console.error('Error fetching issues:', error)
    return c.json({ error: 'Failed to fetch issues' }, 500)
  }
})

// Create an issue
githubRoutes.post('/repository/:owner/:repo/issues', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  const { owner, repo } = c.req.param()

  try {
    const body = await c.req.json()
    const { title, body: issueBody, labels = [] } = body

    if (!title || !issueBody) {
      return c.json({ error: 'Title and body are required' }, 400)
    }

    const issue = await github.createIssue(owner, repo, title, issueBody, labels)
    return c.json({ issue })
  } catch (error) {
    console.error('Error creating issue:', error)
    return c.json({ error: 'Failed to create issue' }, 500)
  }
})

// Utility endpoint to parse repository URL
githubRoutes.post('/utils/parse-repository-url', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available for this tenant' }, 400)
  }

  try {
    const body = await c.req.json()
    const { url } = body

    if (!url) {
      return c.json({ error: 'URL is required' }, 400)
    }

    const parsed = github.parseRepositoryUrl(url)
    if (!parsed) {
      return c.json({ error: 'Invalid GitHub repository URL' }, 400)
    }

    return c.json({ parsed })
  } catch (error) {
    console.error('Error parsing repository URL:', error)
    return c.json({ error: 'Failed to parse repository URL' }, 500)
  }
})