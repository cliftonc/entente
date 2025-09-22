import type { ProjectMetadata } from '@entente/metadata'
import type { DeploymentOptions } from '@entente/types'
import { getServerUrl } from '../config.js'
import { getGitSha } from '../git-utils.js'
import { makeAuthenticatedRequest } from '../utils.js'

export const recordDeployment = async (
  options: DeploymentOptions,
  metadata: ProjectMetadata | null
): Promise<void> => {
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

    console.log(`✓ Successfully recorded deployment of ${service}@${version} to ${environment}`)
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to Entente server at ${serviceUrl}. Make sure the server is running.`
      )
    }
    throw error
  }
}