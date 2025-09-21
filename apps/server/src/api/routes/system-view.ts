import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type {
  SystemViewService,
  SystemViewContract,
  SystemViewOperation,
  SystemViewData,
  SystemViewFilters
} from "@entente/types";
import {
  contracts,
  interactions,
  services,
  verificationResults,
  deployments,
} from "../../db/schema";
import type { DbConnection } from "../../db/types";

export const systemViewRouter = new Hono();

// Get optimized system view data
systemViewRouter.get("/", async (c) => {
  const environment = c.req.query("environment");
  const serviceType = c.req.query("serviceType") as
    | "consumer"
    | "provider"
    | "all"
    | undefined;
  const status = c.req.query("status") as
    | "active"
    | "archived"
    | "deprecated"
    | "all"
    | undefined;

  const { tenantId } = c.get("session");
  const db = c.get("db") as DbConnection;

  try {
    // Get services with basic info only
    const allServices = await db
      .select()
      .from(services)
      .where(eq(services.tenantId, tenantId));

    // Get deployment versions if environment is specified
    let deploymentVersions: Map<string, string> = new Map();
    if (environment) {
      const activeDeployments = await db
        .select({
          service: deployments.service,
          version: deployments.version,
        })
        .from(deployments)
        .where(
          and(
            eq(deployments.tenantId, tenantId),
            eq(deployments.environment, environment),
            eq(deployments.active, true),
          ),
        );

      for (const deployment of activeDeployments) {
        deploymentVersions.set(deployment.service, deployment.version);
      }
    }

    // Get contracts with minimal data (environment field is for reference only, not filtering)
    const whereContractConditions = [eq(contracts.tenantId, tenantId)];
    if (status && status !== "all") {
      whereContractConditions.push(eq(contracts.status, status));
    }

    const allContractsRaw = await db
      .select({
        id: contracts.id,
        providerName: contracts.providerName,
        consumerName: contracts.consumerName,
        environment: contracts.environment,
        status: contracts.status,
        specType: contracts.specType,
        providerVersion: contracts.providerVersion,
        consumerVersion: contracts.consumerVersion,
      })
      .from(contracts)
      .where(and(...whereContractConditions));

    // Filter to only include the latest version combination for each consumer-provider pair
    const contractMap = new Map<string, typeof allContractsRaw[0]>();

    for (const contract of allContractsRaw) {
      const key = `${contract.consumerName}:${contract.providerName}:${contract.environment}`;
      const existing = contractMap.get(key);

      if (!existing) {
        contractMap.set(key, contract);
      } else {
        // Compare versions to keep the latest combination
        const existingVersion = `${existing.consumerVersion || '0.0.0'}:${existing.providerVersion || '0.0.0'}`;
        const currentVersion = `${contract.consumerVersion || '0.0.0'}:${contract.providerVersion || '0.0.0'}`;

        // Simple string comparison for now - could be improved with semver
        if (currentVersion > existingVersion) {
          contractMap.set(key, contract);
        }
      }
    }

    const allContracts = Array.from(contractMap.values());

    // Get operations from contract interactions grouped by provider
    const operationsMap: Record<string, SystemViewOperation[]> = {};
    const providerOperations: Record<
      string,
      Map<
        string,
        {
          count: number;
          lastUsed: Date;
          method: string;
          operationName: string;
          interactionIds: string[];
        }
      >
    > = {};

    for (const contract of allContracts) {
      // Get interactions for this specific contract
      const contractInteractions = await db
        .select({
          id: interactions.id,
          operation: interactions.operation,
          request: interactions.request,
          timestamp: interactions.timestamp,
        })
        .from(interactions)
        .where(
          and(
            eq(interactions.tenantId, tenantId),
            eq(interactions.contractId, contract.id),
          ),
        )
        .orderBy(desc(interactions.timestamp))
        .limit(100); // Limit to recent interactions per contract

      if (contractInteractions.length === 0) continue;

      const providerName = contract.providerName;
      if (!providerOperations[providerName]) {
        providerOperations[providerName] = new Map();
      }

      // Process interactions and aggregate at provider level
      for (const interaction of contractInteractions) {
        // Use the operation field directly (e.g., "Query.getRulersByCastle")
        const operationName = interaction.operation;

        // Skip if operation is empty or looks like an HTTP method+path
        if (
          !operationName ||
          operationName.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/)
        ) {
          continue;
        }

        // Extract method from request or infer from operation name
        let method = "GET"; // default
        try {
          const request = interaction.request as any;
          if (request?.method) {
            method = request.method.toUpperCase();
          }
        } catch (error) {
          // Fallback: infer method from operation name for GraphQL
          if (operationName.startsWith("Query.")) {
            method = "QUERY";
          } else if (operationName.startsWith("Mutation.")) {
            method = "MUTATION";
          } else if (operationName.startsWith("Subscription.")) {
            method = "SUBSCRIPTION";
          }
        }

        const operationKey = `${method}:${operationName}`;
        const existing = providerOperations[providerName].get(operationKey);

        if (existing) {
          existing.count += 1;
          existing.interactionIds.push(interaction.id);
          if (interaction.timestamp > existing.lastUsed) {
            existing.lastUsed = interaction.timestamp;
          }
        } else {
          providerOperations[providerName].set(operationKey, {
            count: 1,
            lastUsed: interaction.timestamp,
            method,
            operationName,
            interactionIds: [interaction.id],
          });
        }
      }
    }

    // Convert aggregated operations to final format
    for (const [providerName, operationCounts] of Object.entries(
      providerOperations,
    )) {
      operationsMap[providerName] = Array.from(operationCounts.entries())
        .map(([operationKey, data], index) => {
          return {
            id: `${providerName}-${index}`,
            method: data.method,
            path: data.operationName,
            count: data.count,
            lastUsed: data.lastUsed,
            interactionIds: data.interactionIds,
          };
        })
        .sort((a, b) => b.count - a.count) // Sort by usage count
        .slice(0, 10); // Limit to top 10 operations per provider
    }

    // Build response data with contracts and operations
    const systemViewData: SystemViewData = {
      services: allServices.map((service) => {
        // Derive roles from contract participation
        const isProvider = allContracts.some(c => c.providerName === service.name)
        const isConsumer = allContracts.some(c => c.consumerName === service.name)
        const contractCount = allContracts.filter(c =>
          c.providerName === service.name || c.consumerName === service.name
        ).length

        return {
          id: service.id,
          name: service.name,
          specType: service.specType,
          description: service.description || undefined,
          deployedVersion: deploymentVersions.get(service.name),
          roles: {
            isProvider,
            isConsumer,
            contractCount
          }
        }
      }),
      contracts: allContracts.map((contract) => ({
        id: contract.id,
        providerName: contract.providerName,
        consumerName: contract.consumerName,
        environment: contract.environment,
        status: contract.status as 'active' | 'archived' | 'deprecated',
        verificationStatus: null, // Skip verification for now
        interactionCount: 0, // We'll calculate this separately if needed
        specType: contract.specType,
      })),
      operations: operationsMap,
    };

    console.log(
      `📊 System view: ${allServices.length} services, ${allContracts.length} contracts, ${Object.keys(operationsMap).length} providers with operations`,
    );

    return c.json(systemViewData);
  } catch (error) {
    console.error("Failed to fetch system view data:", error);
    return c.json({ error: "Failed to fetch system view data" }, 500);
  }
});
