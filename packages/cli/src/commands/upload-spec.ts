import type { ProjectMetadata } from '@entente/metadata'
import type { UploadOptions, ProviderRegistration } from '@entente/types'
import chalk from 'chalk'
import { getServerUrl } from '../config.js'
import { makeAuthenticatedRequest } from '../utils.js'
import { registerService } from './register-service.js'

export const uploadSpec = async (
  options: UploadOptions,
  metadata: ProjectMetadata | null
): Promise<void> => {
  const { service, version = '0.0.0', branch = 'main', spec: specPath } = options

  // Read spec file from path
  const fs = await import('node:fs/promises')

  let spec: any
  try {
    const specContent = await fs.readFile(specPath, 'utf-8')

    // For JSON files, parse as JSON; otherwise send as raw string
    // Let the server auto-detect the spec type
    if (specPath.endsWith('.json')) {
      spec = JSON.parse(specContent)
    } else {
      spec = specContent.trim()
    }
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
        chalk.yellow('!'),
        `Provider service ${service} not found, attempting auto-registration...`
      )

      // Use metadata instead of reading package.json again
      if (metadata?.raw && Object.keys(metadata.raw).length > 0) {
        console.log(
          '▶',
          `Found project metadata, registering provider service ${service}...`
        )

        await registerService({
          name: service,
          description: `Auto-registered service for ${service}`,
        }, metadata)
      } else {
        console.log(
          chalk.yellow('!'),
          'No project metadata found, creating minimal provider registration...'
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

        console.log(chalk.green('✓'), `Auto-registered provider ${service}`)
      }
    }
  } catch (error) {
    // If provider check/registration fails, continue with spec upload
    console.log(
      chalk.yellow('!'),
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
      chalk.green('✓'),
      `Uploaded new API spec for ${service}@${version}`
    )
  } else {
    console.log(chalk.green('✓'), `Updated API spec for ${service}@${version}`)
  }
}