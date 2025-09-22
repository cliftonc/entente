import type { ProjectMetadata } from '@entente/metadata'
import type { ConsumerDeployment } from '@entente/types'
import chalk from 'chalk'
import { getServerUrl } from '../config.js'
import { getGitSha } from '../git-utils.js'
import { makeAuthenticatedRequest } from '../utils.js'

export const deployConsumer = async (
  options: {
    name: string
    version: string
    environment: string
    deployedBy?: string
  },
  metadata: ProjectMetadata | null
): Promise<void> => {
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
    chalk.green('✓'),
    `Consumer ${options.name}@${options.version} deployed to ${options.environment}`
  )
  console.log(`   Deployment ID: ${result.deployment.id}`)
}