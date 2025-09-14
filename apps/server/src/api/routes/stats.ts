import type { VerificationResult } from '@entente/types'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { deployments, fixtures, interactions, services, verificationResults } from '../../db/schema'

export const statsRouter = new Hono()

// Dashboard statistics endpoint
statsRouter.get('/dashboard', async c => {
  const db = c.get('db')
  const session = c.get('session')

  if (!session || !session.tenantId) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const { tenantId } = session

  try {
    // Get total services (consumers + providers)
    const [consumerCount] = await db
      .select({ count: count() })
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.type, 'consumer')))

    const [providerCount] = await db
      .select({ count: count() })
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.type, 'provider')))

    const totalServices = consumerCount.count + providerCount.count

    // Get total interactions count
    const [interactionCount] = await db
      .select({ count: count() })
      .from(interactions)
      .where(eq(interactions.tenantId, tenantId))

    // Get draft fixtures count (equivalent to "pending")
    const [draftFixturesCount] = await db
      .select({ count: count() })
      .from(fixtures)
      .where(and(eq(fixtures.tenantId, tenantId), eq(fixtures.status, 'draft')))

    // Get recent deployments (last 10)
    const recentDeployments = await db
      .select({
        id: deployments.id,
        service: deployments.service,
        version: deployments.version,
        environment: deployments.environment,
        deployedAt: deployments.deployedAt,
        deployedBy: deployments.deployedBy,
        type: deployments.type,
      })
      .from(deployments)
      .where(eq(deployments.tenantId, tenantId))
      .orderBy(desc(deployments.deployedAt))
      .limit(10)

    // Calculate verification rate from recent verification results
    const verificationResults30Days = await db
      .select({
        id: verificationResults.id,
        results: verificationResults.results,
      })
      .from(verificationResults)
      .where(
        and(
          eq(verificationResults.tenantId, tenantId),
          gte(verificationResults.submittedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )

    const _totalVerifications = verificationResults30Days.length

    // Calculate actual pass rate from verification results
    let totalTests = 0
    let totalPassed = 0

    for (const verification of verificationResults30Days) {
      const results = verification.results as VerificationResult[]
      totalTests += results.length
      totalPassed += results.filter(r => r.success).length
    }

    const verificationRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0

    // Service health - calculate pass rates from verification results
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get recent verification results to calculate service health
    const recentVerifications = await db.query.verificationResults.findMany({
      where: and(
        eq(verificationResults.tenantId, tenantId),
        gte(verificationResults.submittedAt, last7Days)
      ),
      columns: {
        provider: true,
        results: true,
      },
    })

    // Calculate pass rates per service
    const servicePassRates = new Map<
      string,
      { total: number; passed: number; interactions: number }
    >()

    for (const verification of recentVerifications) {
      const results = verification.results as VerificationResult[]
      const serviceName = verification.provider

      if (!servicePassRates.has(serviceName)) {
        servicePassRates.set(serviceName, { total: 0, passed: 0, interactions: 0 })
      }

      const serviceStats = servicePassRates.get(serviceName)
      if (serviceStats) {
        serviceStats.total += results.length
        serviceStats.passed += results.filter(r => r.success).length
        serviceStats.interactions += 1 // Count verification runs as interactions
      }
    }

    // Get interaction counts for services that have verifications
    const serviceInteractionCounts = await db
      .select({
        service: interactions.service,
        count: count(),
      })
      .from(interactions)
      .where(and(eq(interactions.tenantId, tenantId), gte(interactions.timestamp, last7Days)))
      .groupBy(interactions.service)

    // Merge interaction counts with verification data
    for (const item of serviceInteractionCounts) {
      const serviceStats = servicePassRates.get(item.service)
      if (serviceStats) {
        serviceStats.interactions = item.count
      }
    }

    const serviceHealth = Array.from(servicePassRates.entries())
      .map(([serviceName, stats]) => {
        const passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
        const status = passRate >= 95 ? 'healthy' : passRate >= 80 ? 'warning' : 'error'

        return {
          name: serviceName,
          status,
          interactions: stats.interactions,
          passRate: Math.round(passRate * 10) / 10,
        }
      })
      .sort((a, b) => b.interactions - a.interactions) // Sort by interaction count
      .slice(0, 10) // Limit to top 10

    return c.json({
      totalServices,
      totalInteractions: interactionCount.count,
      pendingFixtures: draftFixturesCount.count,
      verificationRate: Math.round(verificationRate * 10) / 10,
      recentDeployments: recentDeployments.map(d => ({
        service: d.service,
        version: d.version,
        environment: d.environment,
        deployedAt: d.deployedAt,
        deployedBy: d.deployedBy,
        type: d.type,
      })),
      serviceHealth,
    })
  } catch (error) {
    console.error('Stats dashboard error:', error)
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500)
  }
})
