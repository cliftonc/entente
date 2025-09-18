import type {
  GitHubServiceConfig,
  GitHubServiceConfigRequest,
  GitHubTriggerWorkflowRequest,
  GitHubWorkflow,
  OpenAPISpec,
} from '@entente/types'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
// Remove unused Env import
import { serviceVersions, services } from '../../db/schema'
import type { DbService } from '../../db/types'
import { injectMockServerUrls } from '../utils/openapi'
import {
  findRepositoryByName,
  getRepositories,
  getWorkflows,
  parseRepositoryUrl,
  triggerWorkflow,
} from '../utils/github-client'
import { ensureServiceVersion } from '../utils/service-versions'

export const servicesRouter = new Hono()

// Register a new service (consumer or provider)
servicesRouter.post('/', async c => {
  const registration = await c.req.json()

  if (!registration.name || !registration.type || !registration.packageJson) {
    return c.json({ error: 'Missing required fields: name, type, packageJson' }, 400)
  }

  if (!['consumer', 'provider'].includes(registration.type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')
  const { user } = c.get('auth')

  // Check if service already exists with this name and type
  const existing = await db.query.services.findFirst({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.name, registration.name),
      eq(services.type, registration.type)
    ),
  })

  let service: DbService
  let isNew = false

  // Auto-match GitHub repository if gitRepositoryUrl is provided
  let githubRepositoryOwner: string | undefined
  let githubRepositoryName: string | undefined
  let githubAutoLinked = false

  if (registration.gitRepositoryUrl) {
    const repoInfo = parseRepositoryUrl(registration.gitRepositoryUrl)
    if (repoInfo) {
      githubRepositoryOwner = repoInfo.owner
      githubRepositoryName = repoInfo.repo
      githubAutoLinked = true
      console.log(`🔗 Auto-linked GitHub repo: ${repoInfo.owner}/${repoInfo.repo}`)
    }
  }

  if (existing) {
    // Check if repository URL has changed
    const repositoryUrlChanged = existing.gitRepositoryUrl !== registration.gitRepositoryUrl

    // Update GitHub fields if:
    // 1. New auto-linking is happening (gitRepositoryUrl provided and parsed successfully)
    // 2. Repository URL changed and existing config was auto-linked (not manually configured)
    // 3. Repository URL was removed/nullified and existing config was auto-linked
    const shouldUpdateGitHubFields =
      githubAutoLinked || (repositoryUrlChanged && existing.githubAutoLinked)

    // Update existing service
    const [updated] = await db
      .update(services)
      .set({
        description: registration.description,
        packageJson: registration.packageJson,
        gitRepositoryUrl: registration.gitRepositoryUrl,
        // Update GitHub fields only if appropriate
        githubRepositoryOwner: shouldUpdateGitHubFields
          ? githubRepositoryOwner || null
          : existing.githubRepositoryOwner,
        githubRepositoryName: shouldUpdateGitHubFields
          ? githubRepositoryName || null
          : existing.githubRepositoryName,
        githubAutoLinked: shouldUpdateGitHubFields ? githubAutoLinked : existing.githubAutoLinked,
        githubConfiguredAt: shouldUpdateGitHubFields
          ? githubAutoLinked
            ? new Date()
            : null
          : existing.githubConfiguredAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(services.tenantId, tenantId),
          eq(services.name, registration.name),
          eq(services.type, registration.type)
        )
      )
      .returning()

    service = updated
    if (shouldUpdateGitHubFields && repositoryUrlChanged) {
      console.log(
        `🔄 Updated GitHub auto-linking for ${registration.type}: ${registration.name} (repository URL changed)`
      )
    }
    console.log(`📦 Updated existing ${registration.type}: ${registration.name}`)
  } else {
    // Create new service
    const [created] = await db
      .insert(services)
      .values({
        tenantId,
        name: registration.name,
        type: registration.type,
        description: registration.description,
        packageJson: registration.packageJson,
        gitRepositoryUrl: registration.gitRepositoryUrl,
        githubRepositoryOwner,
        githubRepositoryName,
        githubAutoLinked,
        githubConfiguredAt: githubAutoLinked ? new Date() : undefined,
      })
      .returning()

    service = created
    isNew = true
    console.log(`📦 Registered new ${registration.type}: ${registration.name}`)
  }

  // Extract version from packageJson and create service version
  if (registration.packageJson && registration.packageJson.version) {
    try {
      await ensureServiceVersion(
        db,
        tenantId,
        registration.name,
        registration.packageJson.version,
        {
          packageJson: registration.packageJson,
          gitSha: registration.gitSha,
          createdBy: user?.name || 'service-registration',
        }
      )
      console.log(
        `📋 Created service version: ${registration.name}@${registration.packageJson.version}`
      )
    } catch (error) {
      console.warn(
        `⚠️  Failed to create service version for ${registration.name}@${registration.packageJson.version}: ${error}`
      )
    }
  }

  return c.json(
    {
      id: service.id,
      name: service.name,
      type: service.type,
      description: service.description,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      isNew,
    },
    isNew ? 201 : 200
  )
})

// Get all services for tenant with optional type filter
servicesRouter.get('/', async c => {
  const type = c.req.query('type') // Optional filter: 'consumer' | 'provider'
  const db = c.get('db')
  const { tenantId } = c.get('session')

  const whereConditions = [eq(services.tenantId, tenantId)]

  if (type && ['consumer', 'provider'].includes(type)) {
    whereConditions.push(eq(services.type, type))
  }

  const serviceList = await db.query.services.findMany({
    where: and(...whereConditions),
    orderBy: [services.name, services.type],
  })

  return c.json(serviceList)
})

// Get all versions for a service
servicesRouter.get('/:name/versions', async c => {
  const { name } = c.req.param()
  const db = c.get('db')
  const { tenantId } = c.get('session')

  try {
    // First find the service
    const service = await db.query.services.findFirst({
      where: and(eq(services.tenantId, tenantId), eq(services.name, name)),
    })

    if (!service) {
      return c.json({ error: 'Service not found' }, 404)
    }

    // Get all versions for this service
    const versions = await db.query.serviceVersions.findMany({
      where: and(eq(serviceVersions.tenantId, tenantId), eq(serviceVersions.serviceId, service.id)),
      orderBy: (serviceVersions, { desc }) => [desc(serviceVersions.createdAt)],
    })

    // Map to include service info for the frontend
    const versionsWithService = versions.map((v, index) => {
      // Inject appropriate mock server URLs based on whether this is the latest version
      const isLatest = index === 0 // First version is latest since ordered by desc creation date
      const latestVersionWithSpec = versions.find(version => version.spec)
      const isLatestWithSpec = v.id === latestVersionWithSpec?.id

      let specWithUrls = v.spec
      if (v.spec && Object.keys(v.spec).length > 0) {
        specWithUrls = injectMockServerUrls(
          v.spec as OpenAPISpec,
          service.name,
          isLatestWithSpec ? 'latest' : 'version',
          v.id
        )
      }

      return {
        id: v.id,
        tenantId: v.tenantId,
        serviceId: v.serviceId,
        serviceName: service.name,
        serviceType: service.type,
        version: v.version,
        spec: specWithUrls,
        gitSha: v.gitSha,
        packageJson: v.packageJson,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }
    })

    return c.json(versionsWithService)
  } catch (error) {
    console.error('Error fetching service versions:', error)
    return c.json({ error: 'Failed to fetch service versions' }, 500)
  }
})

// Get specific service by name and type
servicesRouter.get('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!service) {
    return c.json({ error: 'Service not found' }, 404)
  }

  return c.json(service)
})

// Update service (e.g., new package.json)
servicesRouter.put('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')
  const updates = await c.req.json()

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Check if service exists
  const existing = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!existing) {
    return c.json({ error: 'Service not found' }, 404)
  }

  // Update service
  const [updated] = await db
    .update(services)
    .set({
      description: updates.description ?? existing.description,
      packageJson: updates.packageJson ?? existing.packageJson,
      updatedAt: new Date(),
    })
    .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))
    .returning()

  console.log(`📦 Updated ${type}: ${name}`)

  return c.json(updated)
})

// Delete service
servicesRouter.delete('/:name/:type', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const deleted = await db
    .delete(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))
    .returning()

  if (deleted.length === 0) {
    return c.json({ error: 'Service not found' }, 404)
  }

  console.log(`🗑️ Deleted ${type}: ${name}`)
  return c.json({ message: 'Service deleted successfully' })
})

// GitHub integration endpoints

// Get GitHub configuration for a service
servicesRouter.get('/:name/:type/github/config', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!service) {
    return c.json({ error: 'Service not found' }, 404)
  }

  const config: GitHubServiceConfig = {
    repositoryOwner: service.githubRepositoryOwner || undefined,
    repositoryName: service.githubRepositoryName || undefined,
    verifyWorkflowId: service.githubVerifyWorkflowId || undefined,
    verifyWorkflowName: service.githubVerifyWorkflowName || undefined,
    verifyWorkflowPath: service.githubVerifyWorkflowPath || undefined,
    autoLinked: service.githubAutoLinked || false,
    configuredAt: service.githubConfiguredAt || undefined,
  }

  return c.json(config)
})

// Update GitHub configuration for a service
const githubConfigSchema = z.object({
  repositoryOwner: z.string().optional(),
  repositoryName: z.string().optional(),
  verifyWorkflowId: z.string().optional(),
  verifyWorkflowName: z.string().optional(),
  verifyWorkflowPath: z.string().optional(),
})

servicesRouter.put(
  '/:name/:type/github/config',
  zValidator('json', githubConfigSchema),
  async c => {
    const name = c.req.param('name')
    const type = c.req.param('type')
    const config = c.req.valid('json') as GitHubServiceConfigRequest

    if (!['consumer', 'provider'].includes(type)) {
      return c.json({ error: 'Type must be either consumer or provider' }, 400)
    }

    const db = c.get('db')
    const { tenantId } = c.get('session')

    // Check if service exists
    const existing = await db.query.services.findFirst({
      where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
    })

    if (!existing) {
      return c.json({ error: 'Service not found' }, 404)
    }

    // Update GitHub configuration
    const [updated] = await db
      .update(services)
      .set({
        githubRepositoryOwner: config.repositoryOwner ?? existing.githubRepositoryOwner,
        githubRepositoryName: config.repositoryName ?? existing.githubRepositoryName,
        githubVerifyWorkflowId: config.verifyWorkflowId ?? existing.githubVerifyWorkflowId,
        githubVerifyWorkflowName: config.verifyWorkflowName ?? existing.githubVerifyWorkflowName,
        githubVerifyWorkflowPath: config.verifyWorkflowPath ?? existing.githubVerifyWorkflowPath,
        githubAutoLinked: false, // Manual configuration overrides auto-linking
        githubConfiguredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))
      .returning()

    console.log(`🔧 Updated GitHub config for ${type}: ${name}`)

    const result: GitHubServiceConfig = {
      repositoryOwner: updated.githubRepositoryOwner || undefined,
      repositoryName: updated.githubRepositoryName || undefined,
      verifyWorkflowId: updated.githubVerifyWorkflowId || undefined,
      verifyWorkflowName: updated.githubVerifyWorkflowName || undefined,
      verifyWorkflowPath: updated.githubVerifyWorkflowPath || undefined,
      autoLinked: updated.githubAutoLinked || false,
      configuredAt: updated.githubConfiguredAt || undefined,
    }

    return c.json(result)
  }
)

// Clear GitHub configuration for a service
servicesRouter.delete('/:name/:type/github/config', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Check if service exists
  const existing = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!existing) {
    return c.json({ error: 'Service not found' }, 404)
  }

  // Clear GitHub configuration
  await db
    .update(services)
    .set({
      githubRepositoryOwner: null,
      githubRepositoryName: null,
      githubVerifyWorkflowId: null,
      githubVerifyWorkflowName: null,
      githubVerifyWorkflowPath: null,
      githubAutoLinked: false,
      githubConfiguredAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)))

  console.log(`🧹 Cleared GitHub config for ${type}: ${name}`)
  return c.json({ message: 'GitHub configuration cleared successfully' })
})

// Get available workflows for a service's GitHub repository
servicesRouter.get('/:name/:type/github/workflows', async c => {
  const name = c.req.param('name')
  const type = c.req.param('type')

  if (!['consumer', 'provider'].includes(type)) {
    return c.json({ error: 'Type must be either consumer or provider' }, 400)
  }

  const db = c.get('db')
  const { tenantId } = c.get('session')

  // Get service with GitHub configuration
  const service = await db.query.services.findFirst({
    where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
  })

  if (!service) {
    return c.json({ error: 'Service not found' }, 404)
  }

  if (!service.githubRepositoryOwner || !service.githubRepositoryName) {
    return c.json({ error: 'GitHub repository not configured for this service' }, 400)
  }

  try {
    const workflows = await getWorkflows(
      service.githubRepositoryOwner,
      service.githubRepositoryName,
      db,
      tenantId
    )

    // Map to our interface
    const mappedWorkflows: GitHubWorkflow[] = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      badge_url: workflow.badge_url,
      html_url: workflow.html_url,
    }))

    return c.json(mappedWorkflows)
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return c.json({ error: 'Failed to fetch workflows' }, 500)
  }
})

// Trigger verification workflow for a service
const triggerWorkflowSchema = z.object({
  ref: z.string().optional(),
  inputs: z.record(z.any()).optional(),
})

servicesRouter.post(
  '/:name/:type/github/trigger-workflow',
  zValidator('json', triggerWorkflowSchema),
  async c => {
    const name = c.req.param('name')
    const type = c.req.param('type')
    const { ref = 'main', inputs = {} } = c.req.valid('json') as GitHubTriggerWorkflowRequest

    if (!['consumer', 'provider'].includes(type)) {
      return c.json({ error: 'Type must be either consumer or provider' }, 400)
    }

    const db = c.get('db')
    const { tenantId } = c.get('session')

    // Get service with GitHub configuration
    const service = await db.query.services.findFirst({
      where: and(eq(services.tenantId, tenantId), eq(services.name, name), eq(services.type, type)),
    })

    if (!service) {
      return c.json({ error: 'Service not found' }, 404)
    }

    if (
      !service.githubRepositoryOwner ||
      !service.githubRepositoryName ||
      !service.githubVerifyWorkflowPath
    ) {
      return c.json({ error: 'GitHub verification workflow not configured for this service' }, 400)
    }

    console.log(
      `🔍 Service GitHub config: owner="${service.githubRepositoryOwner}", repo="${service.githubRepositoryName}", path="${service.githubVerifyWorkflowPath}"`
    )

    try {
      await triggerWorkflow(
        service.githubRepositoryOwner,
        service.githubRepositoryName,
        service.githubVerifyWorkflowPath,
        ref,
        inputs,
        db,
        tenantId
      )

      console.log(`🚀 Triggered verification workflow for ${type}: ${name}`)
      return c.json({ message: 'Verification workflow triggered successfully' })
    } catch (error) {
      console.error('Error triggering workflow:', error)
      return c.json({ error: 'Failed to trigger verification workflow' }, 500)
    }
  }
)
