import type {
  UploadOptions,
  DeploymentOptions,
  CanIDeployOptions,
  CanIDeployResult,
  OpenAPISpec,
} from "@entente/types";
import { createFixtureManager } from "@entente/fixtures";
import { getApiKey, getServerUrl } from "./config.js";
import chalk from "chalk";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.');
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error(
      'Authentication failed. Please run "entente login" to re-authenticate.',
    );
  }

  return response;
}

export const uploadSpec = async (options: UploadOptions): Promise<void> => {
  const {
    service,
    version,
    branch = "main",
    environment,
    spec: specPath,
  } = options;

  // Read OpenAPI spec from file
  const fs = await import("fs/promises");

  let spec: OpenAPISpec;
  try {
    const specContent = await fs.readFile(specPath, "utf-8");
    spec = JSON.parse(specContent);
  } catch (error) {
    throw new Error(
      `Failed to read spec file ${specPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Upload to central service
  const serviceUrl = await getServerUrl();
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/specs/${service}`,
    {
      method: "POST",
      body: JSON.stringify({
        spec,
        metadata: {
          service,
          version,
          branch,
          environment,
          uploadedBy: process.env.USER || "unknown",
          uploadedAt: new Date(),
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to upload spec: ${response.status} ${response.statusText}`,
    );
  }

  console.log(
    `✅ Successfully uploaded ${service}@${version} spec to ${environment}`,
  );
};

export const recordDeployment = async (
  options: DeploymentOptions,
): Promise<void> => {
  const {
    service,
    version,
    environment,
    deployedBy = process.env.USER || "unknown",
  } = options;

  const serviceUrl = await getServerUrl();

  // Mark new version as active
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/deployments`,
    {
      method: "POST",
      body: JSON.stringify({
        service,
        version,
        environment,
        deployedAt: new Date(),
        deployedBy,
        active: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to record deployment: ${response.status} ${response.statusText}`,
    );
  }

  console.log(
    `✅ Successfully recorded deployment of ${service}@${version} to ${environment}`,
  );
};

export const canIDeploy = async (
  options: CanIDeployOptions,
): Promise<CanIDeployResult> => {
  const { consumer, version, environment } = options;

  const serviceUrl = await getServerUrl();
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/can-i-deploy?consumer=${consumer}&version=${version}&environment=${environment}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to check deployment compatibility: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

export const approveFixtures = async (options: {
  testRun?: string;
  service?: string;
  approver: string;
}): Promise<number> => {
  const { testRun, service, approver } = options;
  const serviceUrl = await getServerUrl();
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.');
  }

  // Create fixture manager with API key for authentication
  const fixtureManager = createFixtureManager(`${serviceUrl}/api`, apiKey);

  if (testRun) {
    // Bulk approve fixtures from a test run
    return fixtureManager.bulkApprove(testRun, approver);
  } else {
    // Get pending fixtures and approve them one by one
    const pendingFixtures = await fixtureManager.getPending(service);

    let approvedCount = 0;
    for (const fixture of pendingFixtures) {
      try {
        await fixtureManager.approve(fixture.id, approver, "CLI bulk approval");
        approvedCount++;
      } catch (error) {
        console.error(`Failed to approve fixture ${fixture.id}:`, error);
      }
    }

    return approvedCount;
  }
};

export const listFixtures = async (options: {
  service?: string;
  status?: string;
}): Promise<void> => {
  const { service, status = "draft" } = options;
  const serviceUrl = await getServerUrl();
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('Not authenticated. Please run "entente login" first.');
  }

  // Create fixture manager with API key for authentication
  const fixtureManager = createFixtureManager(`${serviceUrl}/api`, apiKey);
  const fixtures = await fixtureManager.getPending(service);

  if (fixtures.length === 0) {
    console.log("No fixtures found");
    return;
  }

  console.log(`\nFound ${fixtures.length} fixture(s):\n`);

  for (const fixture of fixtures) {
    console.log(`ID: ${fixture.id}`);
    console.log(`Service: ${fixture.service}@${fixture.serviceVersion}`);
    console.log(`Operation: ${fixture.operation}`);
    console.log(`Status: ${fixture.status}`);
    console.log(`Source: ${fixture.source}`);
    console.log(`Priority: ${fixture.priority}`);
    if (fixture.notes) {
      console.log(`Notes: ${fixture.notes}`);
    }
    console.log("---");
  }
};

export const getDeploymentStatus = async (
  environment: string,
): Promise<void> => {
  const serviceUrl = await getServerUrl();
  const response = await makeAuthenticatedRequest(
    `${serviceUrl}/api/deployments/active?environment=${environment}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get deployment status: ${response.status} ${response.statusText}`,
    );
  }

  const activeVersions = await response.json();

  if (activeVersions.length === 0) {
    console.log(`No active deployments found for ${environment}`);
    return;
  }

  console.log(`\nActive deployments in ${environment}:\n`);

  for (const version of activeVersions) {
    console.log(
      `${version.service}@${version.version} (deployed ${version.deployedAt})`,
    );
  }
};
