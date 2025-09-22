import type { ProjectMetadata } from '@entente/metadata'
import chalk from 'chalk'
import { getServerUrl } from '../config.js'
import { makeAuthenticatedRequest } from '../utils.js'

export const getDeploymentStatus = async (
  environment: string,
  includeFailures = false,
  metadata: ProjectMetadata | null
): Promise<void> => {
  const serviceUrl = await getServerUrl()
  const queryParam = includeFailures ? '&include_inactive=true' : ''
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/deployments/active?environment=${environment}${queryParam}`
  )

  if (!response.ok) {
    throw new Error(`Failed to get deployment status: ${response.status} ${response.statusText}`)
  }

  const deployments = await response.json()

  if (deployments.length === 0) {
    console.log(`No deployments found for ${environment}`)
    return
  }

  console.log(`\nDeployments in ${environment}:\n`)

  for (const deployment of deployments) {
    const statusColor =
      deployment.status === 'successful'
        ? chalk.green('✓')
        : deployment.status === 'failed'
          ? chalk.red('✗')
          : chalk.yellow('!')

    const statusText = deployment.status === 'successful' ? 'deployed' : deployment.status

    console.log(
      `${statusColor} ${deployment.service}@${deployment.version} (${statusText} ${deployment.deployedAt})`
    )

    if (deployment.status === 'failed' && deployment.failureReason) {
      console.log(`   ${chalk.red('Reason:')} ${deployment.failureReason}`)
    }
  }
}