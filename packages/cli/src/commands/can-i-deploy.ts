import type { ProjectMetadata } from '@entente/metadata'
import type { CanIDeployOptions, CanIDeployResult } from '@entente/types'
import { getServerUrl } from '../config.js'
import { makeAuthenticatedRequest } from '../utils.js'

export const canIDeploy = async (
  options: CanIDeployOptions,
  metadata: ProjectMetadata | null
): Promise<CanIDeployResult> => {
  const { service, consumer, version, environment, semverCompatibility } = options

  // Use service if provided, otherwise fall back to consumer for backward compatibility
  const serviceName = service || consumer

  if (!serviceName) {
    throw new Error('Service name is required')
  }

  const serviceUrl = await getServerUrl()

  // Build query string with optional semverCompatibility
  const params = new URLSearchParams()
  params.append('service', serviceName)
  params.append('version', version)
  params.append('environment', environment)

  if (semverCompatibility && semverCompatibility !== 'none') {
    params.append('semverCompatibility', semverCompatibility)
  }

  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/can-i-deploy?${params.toString()}`
  )

  if (!response.ok) {
    throw new Error(
      `Failed to check deployment compatibility: ${response.status} ${response.statusText}`
    )
  }

  return response.json()
}