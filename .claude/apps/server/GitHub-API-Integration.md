# GitHub API Integration

This document describes the GitHub API wrapper/helper system built for the Entente server that provides easy access to GitHub APIs from any route.

## Overview

The GitHub integration consists of several key components:

- **Functional GitHub Client** (`github-client.ts`): Core GitHub API functions
- **GitHub Helper** (`github-helper.ts`): Convenient wrapper with middleware
- **GitHub Routes** (`github.ts`): Example API endpoints demonstrating usage
- **Token Management** (`github-app.ts`): GitHub App authentication and token handling

## Key Features

- ✅ **Functional Programming Approach**: All utilities are functions, not classes
- ✅ **Tenant-Aware**: Automatically uses the correct GitHub installation per tenant
- ✅ **GitHub Actions Support**: Complete workflow, runs, and jobs API coverage
- ✅ **Repository Management**: Search, lookup, and service-to-repo mapping
- ✅ **Error Handling**: Graceful handling when GitHub isn't configured
- ✅ **Token Caching**: Automatic token caching with proper expiration
- ✅ **Type Safety**: Full TypeScript types for all GitHub API responses

## Usage Examples

### Using the GitHub Helper in Routes

```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { databaseMiddleware } from '../middleware/database'
import { withGitHub } from '../utils/github-helper'

const app = new Hono()

// Apply middleware (order matters)
app.use('*', databaseMiddleware)
app.use('*', authMiddleware)
app.use('*', withGitHub)

// Get repository details for a service
app.get('/service/:serviceName/repository', async (c) => {
  const github = c.get('github')

  if (!github) {
    return c.json({ error: 'GitHub integration not available' }, 400)
  }

  const { serviceName } = c.req.param()

  const result = await github.getRepositoryFromService(serviceName)
  if (!result) {
    return c.json({ error: 'Repository not found' }, 404)
  }

  return c.json(result)
})

// Get GitHub Actions workflow status
app.get('/repository/:owner/:repo/workflow-status', async (c) => {
  const github = c.get('github')
  const { owner, repo } = c.req.param()

  const workflows = await github.getWorkflows(owner, repo)
  const workflowRuns = await github.getWorkflowRuns(owner, repo, {
    perPage: 5
  })

  return c.json({
    workflows,
    recent_runs: workflowRuns
  })
})
```

### Direct Usage of GitHub Client Functions

```typescript
import * as GitHubClient from '../utils/github-client'

// Inside an authenticated route handler
const db = c.get('db')
const { tenantId } = c.get('session')

// Get all repositories for the tenant
const repositories = await GitHubClient.getRepositories(db, tenantId)

// Get workflows for a specific repository
const workflows = await GitHubClient.getWorkflows('owner', 'repo', db, tenantId)

// Trigger a workflow
await GitHubClient.triggerWorkflow(
  'owner',
  'repo',
  'workflow.yml',
  'main',
  { environment: 'production' },
  db,
  tenantId
)
```

## Available API Endpoints

All endpoints are prefixed with `/api/github` and require authentication:

### Repository Operations
- `GET /repositories` - List all accessible repositories
- `GET /repository/:owner/:repo` - Get repository details
- `GET /repository/service/:serviceName` - Find repository by service name

### GitHub Actions
- `GET /repository/:owner/:repo/workflows` - List workflows
- `GET /repository/:owner/:repo/workflow-runs` - List workflow runs
- `GET /repository/:owner/:repo/workflow-runs/:runId` - Get specific run
- `GET /repository/:owner/:repo/workflow-runs/:runId/jobs` - Get run jobs
- `POST /repository/:owner/:repo/workflows/:workflowId/dispatch` - Trigger workflow

### Pull Requests
- `GET /repository/:owner/:repo/pulls` - List pull requests
- `GET /repository/:owner/:repo/pulls/:pullNumber` - Get specific PR
- `POST /repository/:owner/:repo/pulls/:pullNumber/comments` - Add PR comment

### Issues
- `GET /repository/:owner/:repo/issues` - List issues
- `POST /repository/:owner/:repo/issues` - Create issue

### Utilities
- `POST /utils/parse-repository-url` - Parse GitHub repository URL

## Service-to-Repository Mapping

The system automatically maps services to their GitHub repositories:

1. **Automatic Detection**: Uses the `gitRepositoryUrl` field in the services table
2. **URL Parsing**: Supports both HTTPS and SSH GitHub URLs
3. **Repository Lookup**: Can find repositories by service name

```typescript
// Find repository for the "castle-client" service
const result = await github.getRepositoryFromService('castle-client')

if (result) {
  console.log(result.repository.name) // e.g., "castle-client"
  console.log(result.owner)           // e.g., "cliftonc"
  console.log(result.repo)            // e.g., "castle-client"
}
```

## GitHub Actions Integration

Get detailed information about workflows and their status:

```typescript
// Get all workflows for a repository
const workflows = await github.getWorkflows('owner', 'repo')

// Get recent workflow runs with filters
const runs = await github.getWorkflowRuns('owner', 'repo', {
  status: 'completed',
  branch: 'main',
  perPage: 10
})

// Get jobs for a specific run
const jobs = await github.getWorkflowJobs('owner', 'repo', runId)

// Trigger a workflow with inputs
await github.triggerWorkflow('owner', 'repo', 'deploy.yml', 'main', {
  environment: 'staging',
  version: '1.2.3'
})
```

## Error Handling

The system gracefully handles cases where GitHub isn't configured:

- If no GitHub App installation exists for a tenant, the `github` context variable will be `null`
- Routes should check `if (!github)` and return appropriate error responses
- The middleware logs warnings but doesn't throw errors for missing configurations

## Authentication & Security

- Uses GitHub App installation tokens (not personal access tokens)
- Tokens are automatically cached and refreshed
- Each tenant has their own GitHub App installation
- All API calls are scoped to the repositories the tenant has access to

## Integration with Services

The system integrates seamlessly with the existing services infrastructure:

- Service registrations can include `gitRepositoryUrl`
- Automatic parsing of GitHub URLs from service configurations
- Repository lookup by service name for easy mapping

This provides a complete solution for GitHub integration that any route in the Entente server can use with minimal setup.