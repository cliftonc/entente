import type {
  HTTPRequest,
  HTTPResponse,
  ProviderConfig,
  VerificationTask,
  VerificationResult,
  VerificationResults,
  VerificationErrorDetails,
  VerifyOptions,
  ClientInteraction,
  Fixture,
} from "@entente/types";
import { getGitSha } from "./git-utils.js";

export interface ProviderVerificationResults {
  taskId: string | null;
  providerVersion: string;
  providerGitSha?: string | null;
  results: VerificationResult[];
}

export interface EntenteProvider {
  verify: (options: VerifyOptions) => Promise<ProviderVerificationResults>;
  getVerificationTasks: (environment?: string) => Promise<VerificationTask[]>;
}

export const createProvider = (config: ProviderConfig): EntenteProvider => {

  return {
    verify: async (
      options: VerifyOptions,
    ): Promise<ProviderVerificationResults> => {
      // Get verification tasks from central service
      const tasks = await getVerificationTasks(
        config.serviceUrl,
        config.apiKey,
        config.provider,
        options.environment,
      );

      const allResults: VerificationResult[] = [];

      for (const task of tasks) {

        for (const interaction of task.interactions) {

          try {
            // Use state handlers to set up provider state
            if (options.stateHandlers) {
              const stateHandler = options.stateHandlers[interaction.operation];
              if (stateHandler) {
                await stateHandler();
              }
            }

            // Replay the recorded request against real provider
            const actualResponse = await replayRequest(
              options.baseUrl,
              interaction.request,
            );


            // Validate response matches recorded response
            const validation = validateResponse(
              interaction.response,
              actualResponse,
            );

            allResults.push({
              interactionId: interaction.id,
              success: validation.success,
              error: validation.success ? undefined : validation.error,
              errorDetails: validation.success ? undefined : validation.errorDetails,
              actualResponse,
            });
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

      // Only submit results if we have tasks to verify
      if (tasks.length > 0) {
        // Get git SHA for provider verification
        const providerGitSha = getGitSha();

        await submitResults(config.serviceUrl, config.apiKey, config.provider, {
          taskId: tasks[0].id,
          providerVersion: config.providerVersion,
          providerGitSha,
          results: allResults,
        });

        // Update dependency status based on verification results
        for (const task of tasks) {
          const taskResults = allResults.filter(r =>
            task.interactions.some(i => i.id === r.interactionId)
          );

          const allPassed = taskResults.every(r => r.success);
          const dependencyStatus = allPassed ? 'verified' : 'failed';


          // Note: In a real implementation, we'd need the dependency ID
          // For now, this serves as a placeholder for the status update logic
          // The server-side verification results handler could update dependency status
        }
      } else {
      }

      // Get git SHA for return value too
      const providerGitSha = getGitSha();

      return {
        taskId: tasks[0]?.id || null,
        providerVersion: config.providerVersion,
        providerGitSha,
        results: allResults,
      };
    },

    getVerificationTasks: (
      environment?: string,
    ): Promise<VerificationTask[]> => {
      return getVerificationTasks(
        config.serviceUrl,
        config.apiKey,
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
): { success: boolean; error?: string; errorDetails?: VerificationErrorDetails } => {
  // Validate status code
  if (expected.status !== actual.status) {
    const error = `Status code mismatch: expected ${expected.status}, got ${actual.status}`;
    return {
      success: false,
      error,
      errorDetails: {
        type: 'status_mismatch',
        message: error,
        expected: expected.status,
        actual: actual.status
      }
    };
  }

  // Validate response body structure
  if (expected.body && actual.body) {
    const structureResult = validateJsonStructure(expected.body, actual.body, 'body');
    if (!structureResult.success) {
      return {
        success: false,
        error: `Response structure mismatch: ${structureResult.error}`,
        errorDetails: structureResult.errorDetails
      };
    }

    // For successful GET requests, also check if the data is reasonable
    if (actual.status >= 200 && actual.status < 300) {
      const contentCheck = validateResponseContent(expected.body, actual.body);
      if (!contentCheck.success) {
        return {
          success: false,
          error: contentCheck.error,
          errorDetails: {
            type: 'content_mismatch',
            message: contentCheck.error || 'Content validation failed',
            expected: expected.body,
            actual: actual.body
          }
        };
      }
    }
  }

  return { success: true };
};

export const validateJsonStructure = (
  expected: unknown,
  actual: unknown,
  fieldPath?: string,
): { success: boolean; error?: string; errorDetails?: VerificationErrorDetails } => {
  // Implement deep structure validation
  // Check that actual has all required fields from expected
  // Allow extra fields in actual
  // Validate types match


  if (typeof expected !== typeof actual) {
    const error = `Type mismatch: expected ${typeof expected}, got ${typeof actual}`;
    return {
      success: false,
      error,
      errorDetails: {
        type: 'structure_mismatch',
        message: error,
        expected: typeof expected,
        actual: typeof actual,
        field: fieldPath
      }
    };
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      const error = 'Expected array but got non-array';
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'array',
          actual: typeof actual,
          field: fieldPath
        }
      };
    }

    if (expected.length === 0) {
      return { success: true };
    }

    if (actual.length === 0) {
      const error = 'Expected non-empty array but got empty array';
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'non-empty array',
          actual: 'empty array',
          field: fieldPath
        }
      };
    }

    return validateJsonStructure(expected[0], actual[0], fieldPath ? `${fieldPath}[0]` : '[0]');
  }

  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      const error = 'Expected object but got non-object';
      return {
        success: false,
        error,
        errorDetails: {
          type: 'structure_mismatch',
          message: error,
          expected: 'object',
          actual: actual === null ? 'null' : typeof actual,
          field: fieldPath
        }
      };
    }

    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    for (const key in expectedObj) {
      if (!(key in actualObj)) {
        const currentFieldPath = fieldPath ? `${fieldPath}.${key}` : key;
        const error = `Missing required field: ${key}`;
        return {
          success: false,
          error: `Missing required field: ${key}. Expected: ${JSON.stringify(expectedObj, null, 2)}, Actual: ${JSON.stringify(actualObj, null, 2)}`,
          errorDetails: {
            type: 'structure_mismatch',
            message: error,
            expected: expectedObj,
            actual: actualObj,
            field: currentFieldPath
          }
        };
      }
      const currentFieldPath = fieldPath ? `${fieldPath}.${key}` : key;
      const fieldResult = validateJsonStructure(expectedObj[key], actualObj[key], currentFieldPath);
      if (!fieldResult.success) {
        const error = `Field validation failed for '${key}': ${fieldResult.error}`;
        return {
          success: false,
          error,
          errorDetails: fieldResult.errorDetails
        };
      }
    }
  }

  return { success: true };
};

const getVerificationTasks = async (
  serviceUrl: string,
  apiKey: string,
  provider: string,
  environment?: string,
): Promise<VerificationTask[]> => {
  const url = `${serviceUrl}/api/verification/${provider}${environment ? `?environment=${environment}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get verification tasks: ${response.statusText}`);
  }

  return response.json();
};

const submitResults = async (
  serviceUrl: string,
  apiKey: string,
  provider: string,
  results: VerificationResults,
): Promise<void> => {
  const response = await fetch(`${serviceUrl}/api/verification/${provider}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

const validateResponseContent = (
  expected: unknown,
  actual: unknown,
): { success: boolean; error?: string } => {
  // For arrays, check that they're both arrays and have reasonable length
  if (Array.isArray(expected) && Array.isArray(actual)) {
    // Allow actual to have different items, but should be same type
    if (expected.length > 0 && actual.length === 0) {
      return {
        success: false,
        error: `Expected non-empty array but got empty array`,
      };
    }
    return { success: true };
  }

  // For objects, check key fields exist
  if (typeof expected === 'object' && expected !== null &&
      typeof actual === 'object' && actual !== null) {

    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    // Check that critical ID fields match if they exist
    if (expectedObj.id && actualObj.id) {
      // Allow different IDs for created resources, but both should exist
      if (typeof expectedObj.id !== typeof actualObj.id) {
        return {
          success: false,
          error: `ID field type mismatch: expected ${typeof expectedObj.id}, got ${typeof actualObj.id}`,
        };
      }
    }

    return { success: true };
  }

  return { success: true };
};

