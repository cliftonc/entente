import type {
  HTTPRequest,
  HTTPResponse,
  ProviderConfig,
  VerificationTask,
  VerificationResult,
  VerificationResults,
  VerifyOptions,
  ClientInteraction,
  Fixture,
  FixtureProposal,
} from "@entente/types";
import { createFixtureManager, prioritizeFixtures } from "@entente/fixtures";

export interface EntenteProvider {
  verify: (
    options: VerifyOptions,
  ) => Promise<VerificationResults & { fixtureProposals: number }>;
  getVerificationTasks: (environment?: string) => Promise<VerificationTask[]>;
}

export const createProvider = (config: ProviderConfig): EntenteProvider => {
  const fixtureManager = createFixtureManager(config.serviceUrl, config.apiKey);

  return {
    verify: async (
      options: VerifyOptions,
    ): Promise<VerificationResults & { fixtureProposals: number }> => {
      // Get verification tasks from central service
      const tasks = await getVerificationTasks(
        config.serviceUrl,
        config.provider,
        options.environment,
      );

      const allResults: VerificationResult[] = [];
      const fixtureProposals: FixtureProposal[] = [];

      for (const task of tasks) {
        console.log(
          `Verifying ${task.interactions.length} interactions for ${task.consumer}@${task.consumerVersion}`,
        );

        for (const interaction of task.interactions) {
          try {
            // Try fixture-based setup first, then fallback to state handlers
            let setupSuccessful = false;

            if (options.fixtureBasedSetup) {
              setupSuccessful = await setupFromFixtures(
                config.serviceUrl,
                config.provider,
                config.providerVersion,
                interaction.operation,
              );
            }

            if (!setupSuccessful && options.stateHandlers) {
              const stateHandler = options.stateHandlers[interaction.operation];
              if (stateHandler) {
                await stateHandler();
                setupSuccessful = true;
              }
            }

            // Replay the recorded request against real provider
            const actualResponse = await replayRequest(
              options.baseUrl,
              interaction.request,
            );

            // Validate response matches recorded response structure
            const isValid = validateResponse(
              interaction.response,
              actualResponse,
            );

            allResults.push({
              interactionId: interaction.id,
              success: isValid,
              error: isValid ? undefined : "Response structure mismatch",
              actualResponse,
            });

            // If verification is successful and we want to propose fixtures
            if (
              isValid &&
              options.proposeFixtures &&
              actualResponse.status >= 200 &&
              actualResponse.status < 300
            ) {
              const fixtureProposal: FixtureProposal = {
                service: config.provider,
                serviceVersion: config.providerVersion,
                operation: interaction.operation,
                source: "provider",
                priority: 2, // Provider fixtures have higher priority than consumer
                data: {
                  request: interaction.request,
                  response: actualResponse,
                  state: await extractStateInformation(interaction.operation),
                },
                createdFrom: {
                  type: "test_output",
                  timestamp: new Date(),
                  generatedBy: "provider-verification",
                  testRun: process.env.BUILD_ID || "local",
                },
                notes:
                  "Provider fixture generated from successful verification",
              };

              fixtureProposals.push(fixtureProposal);
            }
          } catch (error) {
            allResults.push({
              interactionId: interaction.id,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              actualResponse: undefined,
            });
          }

          // Cleanup after each interaction
          if (options.cleanup) {
            await options.cleanup();
          }
        }
      }

      // Submit fixture proposals if any were created
      if (fixtureProposals.length > 0) {
        console.log(
          `📋 Proposing ${fixtureProposals.length} fixtures from successful verifications...`,
        );
        await submitFixtureProposals(config.serviceUrl, fixtureProposals);
      }

      // Submit results back to central service
      await submitResults(config.serviceUrl, config.provider, {
        taskId: tasks[0]?.id || "unknown",
        providerVersion: config.providerVersion,
        results: allResults,
      });

      return {
        taskId: tasks[0]?.id || "unknown",
        providerVersion: config.providerVersion,
        results: allResults,
        fixtureProposals: fixtureProposals.length,
      };
    },

    getVerificationTasks: (
      environment?: string,
    ): Promise<VerificationTask[]> => {
      return getVerificationTasks(
        config.serviceUrl,
        config.provider,
        environment,
      );
    },
  };
};

export const replayRequest = async (
  baseUrl: string,
  request: HTTPRequest,
): Promise<HTTPResponse> => {
  const url = new URL(request.path, baseUrl);

  if (request.query) {
    for (const [key, value] of Object.entries(request.query)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : await response.text(),
  };
};

export const validateResponse = (
  expected: HTTPResponse,
  actual: HTTPResponse,
): boolean => {
  // Validate status code
  if (expected.status !== actual.status) {
    return false;
  }

  // Validate response body structure (not exact values)
  if (expected.body && actual.body) {
    return validateJsonStructure(expected.body, actual.body);
  }

  return true;
};

export const validateJsonStructure = (
  expected: unknown,
  actual: unknown,
): boolean => {
  // Implement deep structure validation
  // Check that actual has all required fields from expected
  // Allow extra fields in actual
  // Validate types match

  if (typeof expected !== typeof actual) {
    return false;
  }

  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      (expected.length === 0 || validateJsonStructure(expected[0], actual[0]))
    );
  }

  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      return false;
    }

    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    for (const key in expectedObj) {
      if (!(key in actualObj)) {
        return false;
      }
      if (!validateJsonStructure(expectedObj[key], actualObj[key])) {
        return false;
      }
    }
  }

  return true;
};

const getVerificationTasks = async (
  serviceUrl: string,
  provider: string,
  environment?: string,
): Promise<VerificationTask[]> => {
  const url = `${serviceUrl}/verification/${provider}${environment ? `?environment=${environment}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get verification tasks: ${response.statusText}`);
  }

  return response.json();
};

const submitResults = async (
  serviceUrl: string,
  provider: string,
  results: VerificationResults,
): Promise<void> => {
  const response = await fetch(`${serviceUrl}/verification/${provider}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(results),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to submit verification results: ${response.statusText}`,
    );
  }
};

const setupFromFixtures = async (
  serviceUrl: string,
  provider: string,
  providerVersion: string,
  operation: string,
): Promise<boolean> => {
  try {
    const fixtures = await fetchFixturesForOperation(
      serviceUrl,
      provider,
      providerVersion,
      operation,
    );

    if (fixtures.length === 0) {
      return false;
    }

    // Use the highest priority fixture
    const prioritized = prioritizeFixtures(fixtures);
    const fixture = prioritized[0];

    // Set up data based on fixture state information
    if (fixture.data.state) {
      await setupStateFromFixture(fixture.data.state);
      console.log(
        `🔧 Set up provider state using fixture ${fixture.id} for ${operation}`,
      );
      return true;
    }

    return false;
  } catch (error) {
    console.warn(
      `⚠️  Failed to setup from fixtures for ${operation}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return false;
  }
};

const fetchFixturesForOperation = async (
  serviceUrl: string,
  provider: string,
  providerVersion: string,
  operation: string,
): Promise<Fixture[]> => {
  const response = await fetch(
    `${serviceUrl}/fixtures/${operation}?service=${provider}&version=${providerVersion}&status=approved`,
  );

  if (response.ok) {
    return response.json();
  }

  return [];
};

const setupStateFromFixture = async (
  state: Record<string, unknown>,
): Promise<void> => {
  // This would be implemented based on your specific data setup needs
  // Examples:
  // - Insert data into database
  // - Set up mock responses
  // - Configure external service states

  console.log("Setting up provider state from fixture:", state);

  // Example implementation would be provided by the user:
  // if (state.orders) {
  //   for (const order of state.orders as Order[]) {
  //     await database.orders.create(order)
  //   }
  // }
};

const extractStateInformation = async (
  operation: string,
): Promise<Record<string, unknown> | undefined> => {
  // Extract current database/system state that would be needed to reproduce this response
  // This is operation-specific and would be implemented based on your system

  // Example:
  // if (operation === 'getOrder') {
  //   return {
  //     orders: await database.orders.findAll(),
  //     customers: await database.customers.findAll()
  //   }
  // }

  return undefined; // For now, return undefined - teams can implement as needed
};

const submitFixtureProposals = async (
  serviceUrl: string,
  proposals: FixtureProposal[],
): Promise<void> => {
  for (const proposal of proposals) {
    try {
      const response = await fetch(`${serviceUrl}/fixtures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proposal),
      });

      if (!response.ok) {
        console.error(
          `Failed to submit fixture proposal for ${proposal.operation}: ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error(
        `Failed to submit fixture proposal for ${proposal.operation}:`,
        error,
      );
    }
  }
};
