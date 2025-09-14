import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { eq, and, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { serviceDependencies, services, deployments, interactions, verificationResults, verificationTasks } from "../db/schema/index.js";
import { envMiddleware } from "./middleware/env.js";
import { databaseMiddleware } from "./middleware/database.js";
import { authMiddleware } from "./middleware/auth.js";
import { performanceMiddleware } from "./middleware/performance.js";

import { specsRouter } from "./routes/specs.js";
import { interactionsRouter } from "./routes/interactions.js";
import { fixturesRouter } from "./routes/fixtures.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { verificationRouter } from "./routes/verification.js";
import { keysRouter } from "./routes/keys.js";
import { authRouter } from "./routes/auth.js";
import { servicesRouter } from "./routes/services.js";
import { dependenciesRouter } from "./routes/dependencies.js";
import { statsRouter } from "./routes/stats.js";

const app = new Hono();

// Middleware
app.use("*", performanceMiddleware);
app.use("*", logger());
app.use("*", envMiddleware);
app.use("*", databaseMiddleware);
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "https://entente.your-domain.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check (no auth required)
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (no auth required for login)
app.route("/auth", authRouter);

// Protected API routes (require authentication)
app.use("/api/keys/*", authMiddleware);
app.use("/api/specs/*", authMiddleware);
app.use("/api/interactions/*", authMiddleware);
app.use("/api/fixtures/*", authMiddleware);
app.use("/api/deployments/*", authMiddleware);
app.use("/api/verification/*", authMiddleware);
app.use("/api/services/*", authMiddleware);
app.use("/api/dependencies/*", authMiddleware);
app.use("/api/stats/*", authMiddleware);

app.route("/api/keys", keysRouter);
app.route("/api/specs", specsRouter);
app.route("/api/interactions", interactionsRouter);
app.route("/api/fixtures", fixturesRouter);
app.route("/api/deployments", deploymentsRouter);
app.route("/api/verification", verificationRouter);
app.route("/api/services", servicesRouter);
app.route("/api/dependencies", dependenciesRouter);
app.route("/api/stats", statsRouter);

// Can I Deploy endpoint (protected)
app.get("/api/can-i-deploy", authMiddleware, async (c) => {
  const service = c.req.query("service") || c.req.query("consumer"); // Accept both for backward compatibility
  const version = c.req.query("version");
  const environment = c.req.query("environment");
  const type = c.req.query("type"); // New parameter for unified services table

  if (!service || !version || !environment) {
    return c.json({ error: "Missing required parameters" }, 400);
  }

  if (type && !['consumer', 'provider'].includes(type)) {
    return c.json({ error: "Type must be either 'consumer' or 'provider'" }, 400);
  }

  const db = c.get("db");
  const auth = c.get("auth");
  const tenantId = auth.tenantId;

  try {
    // Find the service record, optionally filtered by type
    const whereConditions = [
      eq(services.tenantId, tenantId),
      eq(services.name, service)
    ];

    if (type) {
      whereConditions.push(eq(services.type, type));
    }

    const serviceRecords = await db.select().from(services).where(and(...whereConditions));

    if (serviceRecords.length === 0) {
      return c.json({
        canDeploy: false,
        compatibleServices: [],
        message: `Service ${service} not found${type ? ` with type ${type}` : ''}`,
        serviceType: 'unknown'
      });
    }

    // Determine service types
    const isConsumer = serviceRecords.some(s => s.type === 'consumer');
    const isProvider = serviceRecords.some(s => s.type === 'provider');

    let compatibleServices = [];
    let allVerified = true;
    let errorMessages = [];

    // If it's a consumer, check what providers are deployed and if they've verified
    if (isConsumer) {
      // Step 1: Find all providers deployed in the target environment
      const deployedProviders = await db
        .select({
          service: deployments.service,
          version: deployments.version,
          type: deployments.type,
          deployedAt: deployments.deployedAt
        })
        .from(deployments)
        .where(
          and(
            eq(deployments.tenantId, tenantId),
            eq(deployments.environment, environment),
            eq(deployments.type, 'provider'),
            eq(deployments.active, true)
          )
        );

      if (deployedProviders.length === 0) {
        errorMessages.push(`No providers are deployed in ${environment}`);
      }

      // Step 2: For each deployed provider, check if it has verified against this consumer version
      for (const provider of deployedProviders) {
        // Look for verification results that link this provider version to this consumer version
        const verificationQuery = await db
          .select({
            id: verificationResults.id,
            results: verificationResults.results,
            submittedAt: verificationResults.submittedAt,
            taskConsumer: verificationTasks.consumer,
            taskConsumerVersion: verificationTasks.consumerVersion,
          })
          .from(verificationResults)
          .innerJoin(verificationTasks, eq(verificationResults.taskId, verificationTasks.id))
          .where(
            and(
              eq(verificationResults.tenantId, tenantId),
              eq(verificationResults.provider, provider.service),
              eq(verificationResults.providerVersion, provider.version),
              eq(verificationTasks.consumer, service),
              eq(verificationTasks.consumerVersion, version)
              // Note: No environment filter - verification is environment-agnostic
            )
          )
          .limit(1);

        const verification = verificationQuery[0];
        // Check if all results in the verification passed
        let isVerified = false;
        if (verification?.results) {
          const results = verification.results as any[];
          isVerified = results.length > 0 && results.every(r => r.success === true);
        }

        // Count interactions between this consumer and provider (across all environments)
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, provider.service),
              eq(interactions.serviceVersion, provider.version),
              eq(interactions.consumer, service),
              eq(interactions.consumerVersion, version)
              // Note: No environment filter - interactions are environment-agnostic
            )
          );

        const totalInteractions = interactionCount[0]?.count || 0;

        if (!isVerified) {
          allVerified = false;
          errorMessages.push(`Provider ${provider.service}@${provider.version} verification is pending or failed`);
        }

        compatibleServices.push({
          service: provider.service,
          version: provider.version,
          verified: isVerified,
          interactionCount: totalInteractions,
          type: 'provider'
        });
      }
    }

    // If it's a provider, check what consumers depend on it
    if (isProvider) {
      const consumerServices = alias(services, 'consumer_services');
      const providerServices = alias(services, 'provider_services');

      const dependents = await db
        .select({
          id: serviceDependencies.id,
          consumerId: serviceDependencies.consumerId,
          consumerVersion: serviceDependencies.consumerVersion,
          status: serviceDependencies.status,
          verifiedAt: serviceDependencies.verifiedAt,
          consumerName: consumerServices.name,
        })
        .from(serviceDependencies)
        .innerJoin(consumerServices, eq(serviceDependencies.consumerId, consumerServices.id))
        .innerJoin(providerServices, eq(serviceDependencies.providerId, providerServices.id))
        .where(
          and(
            eq(serviceDependencies.tenantId, tenantId),
            eq(providerServices.name, service),
            eq(providerServices.type, 'provider'),
            eq(serviceDependencies.providerVersion, version),
            eq(serviceDependencies.environment, environment)
          )
        );

      for (const dependent of dependents) {
        // Check if consumer is actively deployed (for context)
        const activeDeployment = await db
          .select()
          .from(deployments)
          .where(
            and(
              eq(deployments.tenantId, tenantId),
              eq(deployments.service, dependent.consumerName),
              eq(deployments.version, dependent.consumerVersion),
              eq(deployments.environment, environment),
              eq(deployments.active, true)
            )
          )
          .limit(1);

        // Count interactions
        const interactionCount = await db
          .select({ count: count() })
          .from(interactions)
          .where(
            and(
              eq(interactions.tenantId, tenantId),
              eq(interactions.service, service),
              eq(interactions.serviceVersion, version),
              eq(interactions.consumer, dependent.consumerName),
              eq(interactions.consumerVersion, dependent.consumerVersion),
              eq(interactions.environment, environment)
            )
          );

        const totalInteractions = interactionCount[0]?.count || 0;
        const isVerified = dependent.status === 'verified' && dependent.verifiedAt !== null;

        if (!isVerified) {
          allVerified = false;
          errorMessages.push(`Consumer ${dependent.consumerName}@${dependent.consumerVersion} verification is pending or failed`);
        }

        compatibleServices.push({
          service: dependent.consumerName,
          version: dependent.consumerVersion,
          verified: isVerified,
          interactionCount: totalInteractions,
          type: 'consumer',
          activelyDeployed: activeDeployment.length > 0
        });
      }
    }

    if (compatibleServices.length === 0) {
      const serviceType = isConsumer && isProvider ? 'consumer/provider' :
                         isConsumer ? 'consumer' :
                         isProvider ? 'provider' : 'unknown';
      return c.json({
        canDeploy: false,
        compatibleServices: [],
        message: `No dependencies or dependents found for ${serviceType} ${service}@${version} in ${environment}`,
        serviceType
      });
    }

    const canDeploy = allVerified && errorMessages.length === 0;
    const message = canDeploy
      ? `All verifications passed for ${service}@${version}`
      : errorMessages.join("; ");

    return c.json({
      canDeploy,
      compatibleServices,
      message,
      serviceType: isConsumer && isProvider ? 'consumer/provider' :
                  isConsumer ? 'consumer' : 'provider'
    });

  } catch (error) {
    console.error("Error in can-i-deploy:", error);
    return c.json({
      error: "Failed to check deployment compatibility",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Export for Cloudflare Workers
export default app;
