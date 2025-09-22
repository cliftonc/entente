import type { ProjectMetadata } from '@entente/metadata'
import type { ServiceRegistration } from '@entente/types'
import chalk from 'chalk'
import { getServerUrl } from '../config.js'
import { getGitRepositoryUrl } from '../git-utils.js'
import { makeAuthenticatedRequest } from '../utils.js'

export const registerService = async (
  options: {
    name: string
    description?: string
  },
  metadata: ProjectMetadata | null
): Promise<void> => {
  const serviceUrl = await getServerUrl()

  // Use metadata instead of reading package.json again
  const packageJson = (metadata?.raw || {}) as Record<string, unknown>

  // Get git repository information
  const gitRepositoryUrl = await getGitRepositoryUrl()

  const registration: ServiceRegistration = {
    name: options.name,
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
    throw new Error(`Failed to register service: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  if (result.isNew) {
    console.log(chalk.green('✓'), `Service ${options.name} registered successfully`)
    console.log(`   ID: ${result.id}`)
    console.log(`   Created: ${result.createdAt}`)
  } else {
    console.log(chalk.green('✓'), `Service ${options.name} updated successfully`)
    console.log(`   ID: ${result.id}`)
    console.log(`   Updated: ${result.updatedAt}`)
  }
}