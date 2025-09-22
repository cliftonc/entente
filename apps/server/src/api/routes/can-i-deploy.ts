import type { VerificationResult } from '@entente/types'
import { debugLog } from '@entente/types'
import { and, count, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import semver from 'semver'
import {
  deployments,
  interactions,
  serviceDependencies,
  services,
  verificationResults,
  verificationTasks,
} from '../../db/schema'

export const canIDeployRouter = new Hono()

type SemverCompatibility = 'none' | 'patch' | 'minor'

interface ServiceInfo {
  service: string
  version: string
  verified: boolean
  nearestVerifiedVersion?: string
  semverCompatible: SemverCompatibility | null
  interactionCount: number
  activelyDeployed: boolean
}

interface Issue {
  type: 'verification_failed' | 'not_deployed' | 'no_interactions'
  service: string
  version: string
  reason: string
  suggestion?: string
}

interface CanIDeployResponse {
  canDeploy: boolean
  providers: ServiceInfo[]
  consumers: ServiceInfo[]
  issues: Issue[]
  message: string
  serviceType: string
}

/**
 * Check if two versions are compatible based on semver rules
 */
function checkSemverCompatibility(
  requiredVersion: string,
  availableVersion: string,
  allowedLevel: SemverCompatibility
): SemverCompatibility | null {
  if (!semver.valid(requiredVersion) || !semver.valid(availableVersion)) {
    // If versions aren't valid semver, fall back to exact match
    return requiredVersion === availableVersion ? 'none' : null
  }

  if (requiredVersion === availableVersion) {
    return 'none' // Exact match
  }

  const reqMajor = semver.major(requiredVersion)
  const reqMinor = semver.minor(requiredVersion)
  const reqPatch = semver.patch(requiredVersion)

  const availMajor = semver.major(availableVersion)
  const availMinor = semver.minor(availableVersion)
  const availPatch = semver.patch(availableVersion)

  // Major version must always match
  if (reqMajor !== availMajor) {
    return null
  }

  // Check minor version
  if (reqMinor !== availMinor) {
    return allowedLevel === 'minor' ? 'minor' : null
  }

  // Check patch version
  if (reqPatch !== availPatch) {
    return allowedLevel === 'patch' || allowedLevel === 'minor' ? 'patch' : null
  }

  return 'none'
}

canIDeployRouter.get('/', async c => {
  const service = c.req.query('service') || c.req.query('consumer') // Accept both for backward compatibility
  const version = c.req.query('version')
  const environment = c.req.query('environment')
  const semverCompatibility = (c.req.query('semverCompatibility') || 'none') as SemverCompatibility

  if (!service || !version || !environment) {
    return c.json({ error: 'Missing required parameters' }, 400)
  }

  if (!['none', 'patch', 'minor'].includes(semverCompatibility)) {
    return c.json({ error: 'Invalid semverCompatibility value. Must be none, patch, or minor' }, 400)
  }

  const db = c.get('db')
  const auth = c.get('auth')
  const tenantId = auth.tenantId

  try {
    // Find the service record
    const serviceRecords = await db
      .select()
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.name, service)))

    if (serviceRecords.length === 0) {
      return c.json<CanIDeployResponse>({
        canDeploy: false,
        providers: [],
        consumers: [],
        issues: [{
          type: 'not_deployed',
          service,
          version,
          reason: `Service ${service} not found`,
        }],
        message: `Service ${service} not found`,
        serviceType: 'unknown',
      })
    }

    // Determine service roles from contracts
    // For now, assume it can be both until we can query contracts
    const isConsumer = true
    const isProvider = true

    const providers: ServiceInfo[] = []
    const consumers: ServiceInfo[] = []
    const issues: Issue[] = []
    let allVerified = true

    // If it's a consumer, check dependencies against providers in target environment
    if (isConsumer) {
      // Step 1: Find all dependencies for this consumer version
      const consumerServices = alias(services, 'consumer_services')
      const providerServices = alias(services, 'provider_services')

      const requiredDependencies = await db
        .select({
          id: serviceDependencies.id,
          providerId: serviceDependencies.providerId,
          providerName: providerServices.name,
        })
        .from(serviceDependencies)
        .innerJoin(consumerServices, eq(serviceDependencies.consumerId, consumerServices.id))
        .innerJoin(providerServices, eq(serviceDependencies.providerId, providerServices.id))
        .where(
          and(
            eq(serviceDependencies.tenantId, tenantId),
            eq(consumerServices.name, service),
            eq(serviceDependencies.consumerVersion, version)
          )
        )

      // Step 2: For each required dependency, check if the provider is deployed and verified
      for (const dependency of requiredDependencies) {
        // Check if the required provider version is actively deployed
        const deploymentQuery = await db
          .select({
            service: deployments.service,
            version: deployments.version,
            deployedAt: deployments.deployedAt,
          })
          .from(deployments)
          .where(
            and(
              eq(deployments.tenantId, tenantId),
              eq(deployments.service, dependency.providerName),
              eq(deployments.environment, environment),
              eq(deployments.active, true)
            )
          )
          .limit(1)

        const deployment = deploymentQuery[0]

        if (!deployment) {
          allVerified = false
          issues.push({
            type: 'not_deployed',
            service: dependency.providerName,
            version: 'any',
            reason: `Required provider is not deployed in ${environment}`,
          })
          providers.push({
            service: dependency.providerName,
            version: 'unknown',
            verified: false,
            semverCompatible: null,
            interactionCount: 0,
            activelyDeployed: false,
          })
          continue
        }

        // Look for verification results - both exact and semver compatible
        const allVerifications = await db
          .select({
            id: verificationResults.id,
            results: verificationResults.results,
            providerVersion: verificationResults.providerVersion,
            submittedAt: verificationResults.submittedAt,
          })
          .from(verificationResults)
          .innerJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
          .where(
            and(
              eq(verificationResults.tenantId, tenantId),
              eq(verificationResults.provider, dependency.providerName),
              eq(verificationTasks.consumer, service),
              eq(verificationTasks.consumerVersion, version)
            )
          )
          .orderBy(desc(verificationResults.submittedAt))

        // Find exact match or best semver compatible version
        let isVerified = false
        let nearestVerifiedVersion: string | undefined
        let semverCompatible: SemverCompatibility | null = null

        // Check for exact version match first
        const exactMatch = allVerifications.find(v => v.providerVersion === deployment.version)
        if (exactMatch?.results) {
          const results = exactMatch.results as VerificationResult[]
          isVerified = results.length > 0 && results.every(r => r.success === true)
          if (isVerified) {
            semverCompatible = 'none'
          }
        }

        // If not exact match, check for semver compatible versions
        if (!isVerified && semverCompatibility !== 'none') {
          for (const verification of allVerifications) {
            if (verification.results) {
              const results = verification.results as VerificationResult[]
              const verificationPassed = results.length > 0 && results.every(r => r.success === true)

              if (verificationPassed) {
                const compatibility = checkSemverCompatibility(
                  deployment.version,
                  verification.providerVersion,
                  semverCompatibility
                )

                if (compatibility) {
                  isVerified = true
                  semverCompatible = compatibility
                  nearestVerifiedVersion = verification.providerVersion
                  break
                }
              }
            }
          }
        }

        if (!isVerified) {
          allVerified = false
          const nearestVerified = allVerifications.find(v => {
            if (v.results) {
              const results = v.results as VerificationResult[]
              return results.length > 0 && results.every(r => r.success === true)
            }
            return false
          })

          if (nearestVerified) {
            nearestVerifiedVersion = nearestVerified.providerVersion
            const suggestedCompatibility = checkSemverCompatibility(
              deployment.version,
              nearestVerified.providerVersion,
              'minor'
            )

            issues.push({
              type: 'verification_failed',
              service: dependency.providerName,
              version: deployment.version,
              reason: `Verification pending or failed`,
              suggestion: suggestedCompatibility
                ? `Use --semver-compatibility ${suggestedCompatibility} to allow version ${nearestVerified.providerVersion}`
                : undefined
            })
          } else {
            issues.push({
              type: 'verification_failed',
              service: dependency.providerName,
              version: deployment.version,
              reason: `No verified versions found`,
            })
          }
        }

        // Count interactions
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, dependency.providerName),
              eq(interactions.consumer, service),
              eq(interactions.consumerVersion, version)
            )
          )

        const totalInteractions = interactionCount[0]?.count || 0

        providers.push({
          service: dependency.providerName,
          version: deployment.version,
          verified: isVerified,
          nearestVerifiedVersion,
          semverCompatible,
          interactionCount: totalInteractions,
          activelyDeployed: true,
        })
      }
    }

    // If it's a provider, check what consumers are deployed and depend on it
    if (isProvider) {
      const providerServices = alias(services, 'provider_services')
      const consumerServices = alias(services, 'consumer_services')

      const deployedDependencies = await db
        .select({
          id: serviceDependencies.id,
          consumer: consumerServices.name,
          consumerId: serviceDependencies.consumerId,
          consumerVersion: serviceDependencies.consumerVersion,
          deployedAt: deployments.deployedAt,
        })
        .from(serviceDependencies)
        .innerJoin(providerServices, eq(serviceDependencies.providerId, providerServices.id))
        .innerJoin(consumerServices, eq(serviceDependencies.consumerId, consumerServices.id))
        .innerJoin(deployments, eq(serviceDependencies.consumerId, deployments.serviceId))
        .where(
          and(
            eq(serviceDependencies.tenantId, tenantId),
            eq(providerServices.name, service),
            eq(deployments.environment, environment),
            eq(deployments.active, true)
          )
        )

      if (deployedDependencies.length === 0 && providers.length === 0) {
        // If a provider has no dependents and no dependencies, it's safe to deploy
        return c.json<CanIDeployResponse>({
          canDeploy: true,
          providers: [],
          consumers: [],
          issues: [],
          message: `${service}@${version} has no dependencies or dependents and is safe to deploy`,
          serviceType: 'provider',
        })
      }

      for (const consumer of deployedDependencies) {
        if (!consumer.consumerId) {
          continue
        }

        // Get all verification results for this consumer
        const allVerifications = await db
          .select({
            id: verificationResults.id,
            results: verificationResults.results,
            providerVersion: verificationResults.providerVersion,
            submittedAt: verificationResults.submittedAt,
          })
          .from(verificationResults)
          .innerJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
          .where(
            and(
              eq(verificationResults.tenantId, tenantId),
              eq(verificationResults.provider, service),
              eq(verificationResults.consumerId, consumer.consumerId),
              eq(verificationResults.consumerVersion, consumer.consumerVersion)
            )
          )
          .orderBy(desc(verificationResults.submittedAt))

        // Check for verification
        let isVerified = false
        let nearestVerifiedVersion: string | undefined
        let semverCompatible: SemverCompatibility | null = null

        // Check exact version first
        const exactMatch = allVerifications.find(v => v.providerVersion === version)
        if (exactMatch?.results) {
          const results = exactMatch.results as VerificationResult[]
          isVerified = results.length > 0 && results.every(r => r.success === true)
          if (isVerified) {
            semverCompatible = 'none'
          }
        }

        // Check semver compatibility
        if (!isVerified && semverCompatibility !== 'none') {
          for (const verification of allVerifications) {
            if (verification.results) {
              const results = verification.results as VerificationResult[]
              const verificationPassed = results.length > 0 && results.every(r => r.success === true)

              if (verificationPassed) {
                const compatibility = checkSemverCompatibility(
                  version,
                  verification.providerVersion,
                  semverCompatibility
                )

                if (compatibility) {
                  isVerified = true
                  semverCompatible = compatibility
                  nearestVerifiedVersion = verification.providerVersion
                  break
                }
              }
            }
          }
        }

        // Count interactions
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, service),
              eq(interactions.consumer, consumer.consumer),
              eq(interactions.consumerVersion, consumer.consumerVersion)
            )
          )

        const totalInteractions = interactionCount[0]?.count || 0

        if (!isVerified) {
          allVerified = false
          const nearestVerified = allVerifications.find(v => {
            if (v.results) {
              const results = v.results as VerificationResult[]
              return results.length > 0 && results.every(r => r.success === true)
            }
            return false
          })

          if (nearestVerified) {
            nearestVerifiedVersion = nearestVerified.providerVersion
            const suggestedCompatibility = checkSemverCompatibility(
              version,
              nearestVerified.providerVersion,
              'minor'
            )

            issues.push({
              type: 'verification_failed',
              service: consumer.consumer,
              version: consumer.consumerVersion,
              reason: `Consumer verification pending or failed`,
              suggestion: suggestedCompatibility
                ? `Use --semver-compatibility ${suggestedCompatibility} to allow version ${nearestVerified.providerVersion}`
                : undefined
            })
          } else {
            issues.push({
              type: 'verification_failed',
              service: consumer.consumer,
              version: consumer.consumerVersion,
              reason: `No verified versions found for consumer`,
            })
          }
        }

        consumers.push({
          service: consumer.consumer,
          version: consumer.consumerVersion,
          verified: isVerified,
          nearestVerifiedVersion,
          semverCompatible,
          interactionCount: totalInteractions,
          activelyDeployed: true,
        })
      }
    }

    const canDeploy = allVerified && issues.length === 0

    // Generate summary message
    let message: string
    if (canDeploy) {
      if (semverCompatibility !== 'none') {
        const hasCompatibility = [...providers, ...consumers].some(s => s.semverCompatible && s.semverCompatible !== 'none')
        message = hasCompatibility
          ? `All verifications passed (with ${semverCompatibility}-level compatibility)`
          : `All verifications passed`
      } else {
        message = `All verifications passed for ${service}@${version}`
      }
    } else {
      // Create concise summary of issues
      const failedProviders = issues.filter(i => providers.some(p => p.service === i.service))
      const failedConsumers = issues.filter(i => consumers.some(c => c.service === i.service))

      if (failedProviders.length > 0 && failedConsumers.length > 0) {
        message = `Cannot deploy: ${failedProviders.length} provider(s) and ${failedConsumers.length} consumer(s) have issues`
      } else if (failedProviders.length > 0) {
        const providerNames = failedProviders.map(p => `${p.service}@${p.version}`).join(', ')
        message = `Cannot deploy: provider verification failed (${providerNames})`
      } else if (failedConsumers.length > 0) {
        const consumerNames = failedConsumers.map(c => `${c.service}@${c.version}`).join(', ')
        message = `Cannot deploy: consumer verification failed (${consumerNames})`
      } else {
        message = `Cannot deploy: ${issues[0]?.reason || 'verification failed'}`
      }
    }

    // Record failed deployment attempt if can't deploy
    if (!canDeploy) {
      try {
        const primaryService = serviceRecords[0]
        await db.insert(deployments).values({
          tenantId,
          serviceId: primaryService.id,
          service,
          version,
          environment,
          deployedAt: new Date(),
          deployedBy: auth.user?.username || 'unknown',
          active: false,
          status: 'failed',
          failureReason: message,
          failureDetails: { canDeploy, providers, consumers, issues, message },
        })
      } catch (deploymentError) {
        console.error('Failed to record deployment attempt:', deploymentError)
      }
    }

    // Mark failed deployment attempts as resolved if deployment can now proceed
    if (canDeploy) {
      try {
        const resolvedCount = await db
          .update(deployments)
          .set({
            status: 'resolved',
            failureReason: `Resolved: ${message}`,
          })
          .where(
            and(
              eq(deployments.tenantId, tenantId),
              eq(deployments.service, service),
              eq(deployments.version, version),
              eq(deployments.status, 'failed')
            )
          )
          .returning({ id: deployments.id })

        if (resolvedCount.length > 0) {
          console.log(
            `✅ Marked ${resolvedCount.length} failed deployment attempts as resolved for ${service}@${version}`
          )
        }
      } catch (resolveError) {
        console.error('Failed to resolve deployment attempts:', resolveError)
      }
    }

    const serviceType =
      isConsumer && isProvider ? 'consumer/provider' : isConsumer ? 'consumer' : 'provider'

    return c.json<CanIDeployResponse>({
      canDeploy,
      providers,
      consumers,
      issues,
      message,
      serviceType,
    })
  } catch (error) {
    console.error('Error in can-i-deploy:', error)
    return c.json(
      {
        error: 'Failed to check deployment compatibility',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})