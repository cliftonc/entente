import fs from 'node:fs/promises'
import { createFixtureManager } from '@entente/fixtures'
import type {
  CanIDeployOptions,
  CanIDeployResult,
  ConsumerDeployment,
  ConsumerRegistration,
  DeploymentOptions,
  OpenAPISpec,
  ProviderDeployment,
  ProviderRegistration,
  ServiceDeployment,
  ServiceRegistration,
  UploadOptions,
} from '@entente/types'
import chalk from 'chalk'
import { getApiKey, getServerUrl } from './config.js'
import { getGitRepositoryUrl, getGitSha } from './git-utils.js'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.')
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (response.status === 401) {
    throw new Error('Authentication failed. Please run "entente login" to re-authenticate.')
  }

  return response
}

export const uploadSpec = async (options: UploadOptions): Promise<void> => {
  const { service, version, branch = 'main', environment, spec: specPath } = options

  // Read OpenAPI spec from file
  const fs = await import('node:fs/promises')

  let spec: OpenAPISpec
  try {
    const specContent = await fs.readFile(specPath, 'utf-8')
    spec = JSON.parse(specContent)
  } catch (error) {
    throw new Error(
      `Failed to read spec file ${specPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  const serviceUrl = await getServerUrl()

  // Check if provider service exists, if not try to auto-register
  try {
    const providerResponse = await makeAuthenticatedRequest(
      `${serviceUrl}/api/services/${service}/provider`
    )

    if (!providerResponse.ok && providerResponse.status === 404) {
      console.log(
        chalk.yellow('⚠️'),
        `Provider service ${service} not found, attempting auto-registration...`
      )

      // Try to find package.json in current directory
      let _packageJson: Record<string, unknown> = {}
      try {
        const packageContent = await fs.readFile('./package.json', 'utf-8')
        _packageJson = JSON.parse(packageContent)
        console.log(
          chalk.blue('📦'),
          `Found package.json, registering provider service ${service}...`
        )

        await registerService({
          name: service,
          type: 'provider',
          packagePath: './package.json',
          description: `Auto-registered provider for ${service}`,
        })
      } catch (_pkgError) {
        console.log(
          chalk.yellow('⚠️'),
          'No package.json found, creating minimal provider registration...'
        )

        // Create minimal provider registration
        const registration: ProviderRegistration = {
          name: service,
          description: `Auto-registered provider for ${service}`,
          packageJson: {
            name: service,
            version: version,
            description: `Auto-registered provider for ${service}`,
          },
        }

        const registerResponse = await makeAuthenticatedRequest(`${serviceUrl}/api/providers`, {
          method: 'POST',
          body: JSON.stringify(registration),
        })

        if (!registerResponse.ok) {
          const error = await registerResponse.json()
          throw new Error(
            `Failed to auto-register provider: ${error.error || registerResponse.statusText}`
          )
        }

        console.log(chalk.green('✅'), `Auto-registered provider ${service}`)
      }
    }
  } catch (error) {
    // If provider check/registration fails, continue with spec upload
    console.log(
      chalk.yellow('⚠️'),
      `Could not verify/register provider: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Upload to central service
  const response = await makeAuthenticatedRequest(`${serviceUrl}/api/specs/${service}`, {
    method: 'POST',
    body: JSON.stringify({
      spec,
      metadata: {
        service,
        version,
        branch,
        environment,
        uploadedBy: process.env.USER || 'unknown',
        uploadedAt: new Date(),
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Failed to upload spec: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  if (result.isNew) {
    console.log(
      chalk.green('✅'),
      `Uploaded new OpenAPI spec for ${service}@${version} to ${environment}`
    )
  } else {
    console.log(
      chalk.green('✅'),
      `Updated OpenAPI spec for ${service}@${version} in ${environment}`
    )
  }
}

export const recordDeployment = async (options: DeploymentOptions): Promise<void> => {
  const { service, version, environment, deployedBy = process.env.USER || 'unknown' } = options

  const serviceUrl = await getServerUrl()

  // Get current git SHA
  const gitSha = getGitSha()

  try {
    // Mark new version as active
    const response = await makeAuthenticatedRequest(`${serviceUrl}/api/deployments`, {
      method: 'POST',
      body: JSON.stringify({
        service,
        version,
        environment,
        deployedAt: new Date(),
        deployedBy,
        active: true,
        gitSha,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to record deployment: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      )
    }

    console.log(`✅ Successfully recorded deployment of ${service}@${version} to ${environment}`)
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to Entente server at ${serviceUrl}. Make sure the server is running.`
      )
    }
    throw error
  }
}

export const canIDeploy = async (options: CanIDeployOptions): Promise<CanIDeployResult> => {
  const { service, consumer, version, environment } = options

  // Use service if provided, otherwise fall back to consumer for backward compatibility
  const serviceName = service || consumer

  const serviceUrl = await getServerUrl()
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/can-i-deploy?service=${serviceName}&version=${version}&environment=${environment}`
  )

  if (!response.ok) {
    throw new Error(
      `Failed to check deployment compatibility: ${response.status} ${response.statusText}`
    )
  }

  return response.json()
}

export const approveFixtures = async (options: {
  testRun?: string
  service?: string
  approver: string
}): Promise<number> => {
  const { testRun, service, approver } = options
  const serviceUrl = await getServerUrl()
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.')
  }

  // Create fixture manager with API key for authentication
  const fixtureManager = createFixtureManager(`${serviceUrl}/api`, apiKey)

  if (testRun) {
    // Bulk approve fixtures from a test run
    return fixtureManager.bulkApprove(testRun, approver)
  }
  // Get pending fixtures and approve them one by one
  const pendingFixtures = await fixtureManager.getPending(service)

  let approvedCount = 0
  for (const fixture of pendingFixtures) {
    try {
      await fixtureManager.approve(fixture.id, approver, 'CLI bulk approval')
      approvedCount++
    } catch (error) {
      console.error(`Failed to approve fixture ${fixture.id}:`, error)
    }
  }

  return approvedCount
}

export const listFixtures = async (options: {
  service?: string
  status?: string
}): Promise<void> => {
  const { service } = options
  const serviceUrl = await getServerUrl()
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.')
  }

  // Create fixture manager with API key for authentication
  const fixtureManager = createFixtureManager(`${serviceUrl}/api`, apiKey)
  const fixtures = await fixtureManager.getPending(service)

  if (fixtures.length === 0) {
    console.log('No fixtures found')
    return
  }

  console.log(`\nFound ${fixtures.length} fixture(s):\n`)

  for (const fixture of fixtures) {
    console.log(`ID: ${fixture.id}`)
    console.log(`Service: ${fixture.service}@${fixture.serviceVersion}`)
    console.log(`Operation: ${fixture.operation}`)
    console.log(`Status: ${fixture.status}`)
    console.log(`Source: ${fixture.source}`)
    console.log(`Priority: ${fixture.priority}`)
    if (fixture.notes) {
      console.log(`Notes: ${fixture.notes}`)
    }
    console.log('---')
  }
}

export const getDeploymentStatus = async (environment: string): Promise<void> => {
  const serviceUrl = await getServerUrl()
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/deployments/active?environment=${environment}`
  )

  if (!response.ok) {
    throw new Error(`Failed to get deployment status: ${response.status} ${response.statusText}`)
  }

  const activeVersions = await response.json()

  if (activeVersions.length === 0) {
    console.log(`No active deployments found for ${environment}`)
    return
  }

  console.log(`\nActive deployments in ${environment}:\n`)

  for (const version of activeVersions) {
    console.log(`${version.service}@${version.version} (deployed ${version.deployedAt})`)
  }
}

// Unified service registration
export const registerService = async (options: {
  name: string
  type: 'consumer' | 'provider'
  packagePath: string
  description?: string
}): Promise<void> => {
  const serviceUrl = await getServerUrl()

  // Read package.json
  let packageJson: Record<string, unknown>
  try {
    const packageContent = await fs.readFile(options.packagePath, 'utf-8')
    packageJson = JSON.parse(packageContent)
  } catch (error) {
    throw new Error(
      `Failed to read package.json from ${options.packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Get git repository information
  const gitRepositoryUrl = await getGitRepositoryUrl()

  const registration: ServiceRegistration = {
    name: options.name,
    type: options.type,
    description: options.description || (packageJson.description as string),
    packageJson,
    gitRepositoryUrl: gitRepositoryUrl || undefined,
  }

  const response = await makeAuthenticatedRequest(`${serviceUrl}/api/services`, {
    method: 'POST',
    body: JSON.stringify(registration),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to register ${options.type}: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  if (result.isNew) {
    console.log(chalk.green('✅'), `${options.type} ${options.name} registered successfully`)
    console.log(`   ID: ${result.id}`)
    console.log(`   Created: ${result.createdAt}`)
  } else {
    console.log(chalk.green('✅'), `${options.type} ${options.name} updated successfully`)
    console.log(`   ID: ${result.id}`)
    console.log(`   Updated: ${result.updatedAt}`)
  }
}

// Legacy provider registration function for backward compatibility
export const registerProvider = async (options: {
  name: string
  packagePath: string
  description?: string
}): Promise<void> => {
  return registerService({
    name: options.name,
    type: 'provider',
    packagePath: options.packagePath,
    description: options.description,
  })
}

// Legacy consumer registration function for backward compatibility
export const registerConsumer = async (options: {
  name: string
  packagePath: string
  description?: string
}): Promise<void> => {
  return registerService({
    name: options.name,
    type: 'consumer',
    packagePath: options.packagePath,
    description: options.description,
  })
}

// Consumer deployment with dependencies
export const deployConsumer = async (options: {
  name: string
  version: string
  environment: string
  deployedBy?: string
}): Promise<void> => {
  const serviceUrl = await getServerUrl()

  // Get current git SHA
  const gitSha = getGitSha()

  const deployment: ConsumerDeployment = {
    name: options.name,
    version: options.version,
    environment: options.environment,
    deployedBy: options.deployedBy || process.env.USER || 'unknown',
    gitSha: gitSha || undefined,
  }

  const response = await makeAuthenticatedRequest(`${serviceUrl}/api/deployments/consumer`, {
    method: 'POST',
    body: JSON.stringify(deployment),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to deploy consumer: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  console.log(
    chalk.green('🚀'),
    `Consumer ${options.name}@${options.version} deployed to ${options.environment}`
  )
  console.log(`   Deployment ID: ${result.deployment.id}`)
}

// Provider deployment
export const deployProvider = async (options: {
  name: string
  version: string
  environment: string
  deployedBy?: string
}): Promise<void> => {
  const serviceUrl = await getServerUrl()

  // Get current git SHA
  const gitSha = getGitSha()

  const deployment: ProviderDeployment = {
    name: options.name,
    version: options.version,
    environment: options.environment,
    deployedBy: options.deployedBy || process.env.USER || 'unknown',
    gitSha: gitSha || undefined,
  }

  const response = await makeAuthenticatedRequest(`${serviceUrl}/api/deployments/provider`, {
    method: 'POST',
    body: JSON.stringify(deployment),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to deploy provider: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  console.log(
    chalk.green('🚀'),
    `Provider ${options.name}@${options.version} deployed to ${options.environment}`
  )
  console.log(`   Deployment ID: ${result.deployment.id}`)
}
