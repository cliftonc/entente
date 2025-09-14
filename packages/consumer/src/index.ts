import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createFixtureManager,
  extractOperationFromPath,
  extractOperationFromSpec,
  generateFixtureHash,
  generateInteractionHash,
  prioritizeFixtures,
} from "@entente/fixtures";
import type {
  ClientConfig,
  ClientInteraction,
  Fixture,
  HTTPRequest,
  HTTPResponse,
  MockOptions,
  OpenAPISpec,
} from "@entente/types";
import { getGitSha } from "./git-utils.js";

export interface EntenteClient {
  createMock: (
    service: string,
    version: string,
    options?: MockOptions,
  ) => Promise<EntenteMock>;
  uploadSpec: (
    service: string,
    version: string,
    spec: OpenAPISpec,
    metadata: {
      branch?: string;
      environment: string;
    },
  ) => Promise<void>;
}

export interface EntenteMock {
  url: string;
  port: number;
  close: () => Promise<void>;
  getFixtures: () => Fixture[];
  proposeFixture: (
    operation: string,
    data: { request?: unknown; response: unknown },
  ) => Promise<void>;
}

interface FixtureCollector {
  collect: (
    operation: string,
    data: { request?: unknown; response: unknown },
  ) => Promise<void>;
  uploadCollected: () => Promise<void>;
  getCollectedCount: () => number;
}

export interface InteractionRecorder {
  record: (
    interaction: Omit<ClientInteraction, "id" | "timestamp" | "clientInfo">,
  ) => Promise<void>;
  flush: () => Promise<void>;
}

const getPackageInfo = (): { name: string; version: string } => {
  try {
    // Look for package.json starting from current working directory
    const packageJsonPath = resolve(process.cwd(), "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    return {
      name: packageJson.name || "unknown-service",
      version: packageJson.version || "0.0.0",
    };
  } catch (error) {
    // Fallback if package.json can't be read
    return {
      name: "unknown-service",
      version: "0.0.0",
    };
  }
};

export const createClient = (config: ClientConfig): EntenteClient => {
  // Get package info for fallbacks
  const packageInfo = getPackageInfo();

  // Create resolved config with fallbacks
  const resolvedConfig = {
    ...config,
    consumer: config.consumer || packageInfo.name,
    consumerVersion: config.consumerVersion || packageInfo.version,
  };

  // Check if we're using fallback values and warn user
  const usingFallbackName =
    !config.consumer && packageInfo.name === "unknown-service";
  const usingFallbackVersion =
    !config.consumerVersion && packageInfo.version === "0.0.0";

  if (usingFallbackName || usingFallbackVersion) {
    console.warn(
      `⚠️  Entente client using fallback values - operations will be skipped. Please provide consumer name/version or ensure package.json exists.`,
    );
    console.warn(
      `   Consumer: ${resolvedConfig.consumer}${usingFallbackName ? " (fallback)" : ""}`,
    );
    console.warn(
      `   Version: ${resolvedConfig.consumerVersion}${usingFallbackVersion ? " (fallback)" : ""}`,
    );
  }

  const fixtureManager = createFixtureManager(
    resolvedConfig.serviceUrl,
    resolvedConfig.apiKey,
  );

  return {
    createMock: async (
      service: string,
      version: string,
      options?: MockOptions,
    ): Promise<EntenteMock> => {
      // NOTE: This creates a mock for testing but does NOT register dependencies.
      // Dependencies should be registered at deployment time using the CLI:
      // entente deploy-consumer -n my-app -v 1.0.0 -e production -D order-service:2.1.0

      // Fetch OpenAPI spec from central service
      const spec = await fetchSpec(
        resolvedConfig.serviceUrl,
        resolvedConfig.apiKey,
        service,
        version,
        options?.branch,
      );

      // Fetch existing fixtures if requested
      let fixtures: Fixture[] = [];
      if (options?.useFixtures !== false) {
        fixtures = await fetchFixtures(
          resolvedConfig.serviceUrl,
          resolvedConfig.apiKey,
          service,
          version,
          options?.localFixtures,
        );
      }

      // Create mock server with fixture support
      const mockServer = await createMockServer({
        spec,
        fixtures,
        port: options?.port || 0,
        validateRequest: options?.validateRequests ?? true,
        validateResponse: options?.validateResponses ?? true,
      });

      // Set up recording if enabled and not using fallback values
      let recorder: InteractionRecorder | undefined;
      if (
        resolvedConfig.recordingEnabled &&
        !usingFallbackName &&
        !usingFallbackVersion
      ) {
        recorder = createInteractionRecorder(resolvedConfig);
      } else if (
        resolvedConfig.recordingEnabled &&
        (usingFallbackName || usingFallbackVersion)
      ) {
        console.log(
          `🚫 Skipping interaction recording - consumer info unavailable`,
        );
      }

      return createEntenteMock({
        service,
        version,
        mockServer,
        recorder,
        fixtures,
        fixtureManager,
        hasFixtures: fixtures.length > 0,
        config: resolvedConfig, // Pass the resolved config for access to consumer info
        skipOperations: usingFallbackName || usingFallbackVersion, // Skip operations if using fallbacks
      });
    },

    uploadSpec: async (
      service: string,
      version: string,
      spec: OpenAPISpec,
      metadata: {
        branch?: string;
        environment: string;
      },
    ): Promise<void> => {
      // Skip upload if using fallback values
      if (usingFallbackName || usingFallbackVersion) {
        console.log(
          `🚫 Skipping spec upload for ${service}@${version} - consumer info unavailable`,
        );
        return;
      }

      const response = await fetch(
        `${resolvedConfig.serviceUrl}/api/specs/${service}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resolvedConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            spec,
            metadata: {
              service,
              version,
              branch: metadata.branch || "main",
              environment: metadata.environment,
              uploadedBy: resolvedConfig.consumer,
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
    },
  };
};

const fetchSpec = async (
  serviceUrl: string,
  apiKey: string,
  service: string,
  version: string,
  branch = "main",
): Promise<OpenAPISpec> => {
  const params = new URLSearchParams({ version, branch });
  const response = await fetch(`${serviceUrl}/api/specs/${service}?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch spec for ${service}@${version}: ${response.statusText}`,
    );
  }

  return response.json();
};

const fetchFixtures = async (
  serviceUrl: string,
  apiKey: string,
  service: string,
  version: string,
  localFixtures?: Fixture[],
): Promise<Fixture[]> => {
  try {
    // If local fixtures are provided, use them and upload to server
    if (localFixtures && localFixtures.length > 0) {
      // Upload local fixtures to the server for future use
      await uploadLocalFixtures(serviceUrl, apiKey, localFixtures);

      const prioritizedFixtures = prioritizeFixtures(localFixtures);
      return prioritizedFixtures;
    }

    // Fallback: Get all approved fixtures from server
    const response = await fetch(
      `${serviceUrl}/api/fixtures/service/${service}?version=${version}&status=approved`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      const fixtures = await response.json();
      return prioritizeFixtures(fixtures);
    }

    return [];
  } catch (error) {
    return [];
  }
};

// Mock server implementation (simplified - would integrate with Prism in real implementation)
interface MockServer {
  url: string;
  port: number;
  close: () => Promise<void>;
  onRequest: (
    handler: (req: MockRequest, res: MockResponse) => Promise<void>,
  ) => void;
}

interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
}

interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
}

const createMockServer = async (config: {
  spec: OpenAPISpec;
  fixtures: Fixture[];
  port: number;
  validateRequest: boolean;
  validateResponse: boolean;
}): Promise<MockServer> => {
  // This is a simplified implementation
  // In practice, this would use Prism or similar tool

  let server: MockServer;

  if (config.fixtures.length > 0) {
    // Use fixtures for deterministic responses
    server = await createFixtureBasedMockServer(
      config.spec,
      config.fixtures,
      config.port,
    );
  } else {
    // Use dynamic schema-based mocking
    server = await createSchemaMockServer(config.spec, config.port);
  }

  return server;
};

const createFixtureBasedMockServer = async (
  spec: OpenAPISpec,
  fixtures: Fixture[],
  port: number,
): Promise<MockServer> => {
  const mockServer = (await createBasicMockServer(port)) as MockServer & {
    _startPrism: (spec: OpenAPISpec, fixtures: Fixture[]) => Promise<void>;
  };

  // Start Prism with spec and fixtures
  await mockServer._startPrism(spec, fixtures);

  return mockServer;
};

const createSchemaMockServer = async (
  spec: OpenAPISpec,
  port: number,
): Promise<MockServer> => {
  const mockServer = (await createBasicMockServer(port)) as MockServer & {
    _startPrism: (spec: OpenAPISpec, fixtures: Fixture[]) => Promise<void>;
  };

  // Start Prism with spec but no fixtures (dynamic mode)
  await mockServer._startPrism(spec, []);

  return mockServer;
};

const createBasicMockServer = async (port: number): Promise<MockServer> => {
  // This creates a Prism mock server process
  const actualPort = port || 3000 + Math.floor(Math.random() * 1000);

  // For now, return a placeholder that will be replaced by Prism
  return createPrismMockServer(actualPort);
};

const createPrismMockServer = async (port: number): Promise<MockServer> => {
  const { createInstance, getHttpOperationsFromSpec } = await import(
    "@stoplight/prism-http"
  );

  let prismInstance: any = null;
  let httpServer: any = null;
  let operations: any = null;
  const handlers: Array<
    (req: MockRequest, res: MockResponse) => Promise<void>
  > = [];

  const startPrism = async (spec: OpenAPISpec, fixtures: Fixture[] = []) => {
    // Inject fixtures as examples into the spec
    const specWithFixtures = injectFixturesIntoSpec(spec, fixtures);

    // Get operations from the OpenAPI spec
    operations = await getHttpOperationsFromSpec(specWithFixtures);

    // Create Prism instance with proper configuration for fixtures
    prismInstance = createInstance(
      {
        mock: {
          dynamic: fixtures.length === 0, // Use dynamic mocking if no fixtures, static if we have fixtures
        },
        validateRequest: true,
        validateResponse: true,
        checkSecurity: false,
        errors: false,
      } as any,
      {
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        },
      },
    );

    // Start HTTP server that uses Prism
    const { createServer } = await import("http");
    const { URL } = await import("url");

    httpServer = createServer(async (req, res) => {
      const startTime = Date.now();

      try {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        const body =
          req.method === "POST" ||
          req.method === "PUT" ||
          req.method === "PATCH"
            ? await getRequestBody(req)
            : undefined;

        // Normalize headers for Prism
        const normalizedHeaders: Record<string, string> = {};
        Object.entries(req.headers).forEach(([key, value]) => {
          if (typeof value === "string") {
            normalizedHeaders[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            normalizedHeaders[key.toLowerCase()] = value.join(", ");
          }
        });

        // Create request object for Prism
        const prismRequest = {
          method: req.method?.toLowerCase() || "get",
          url: {
            path: url.pathname,
            query: Object.fromEntries(url.searchParams.entries()),
            baseUrl: `http://localhost:${port}`,
          },
          headers: normalizedHeaders,
          body,
        };

        let output: any = null;
        let finalStatusCode = 500;
        let finalHeaders: Record<string, string> = {
          "content-type": "application/json",
        };
        let finalBody: any = null;

        // Use Prism to handle the request
        const result = await prismInstance.request(prismRequest, operations);

        // Handle the result
        if (result.output) {
          output = result.output;
          finalStatusCode = output.statusCode || 200;
          finalHeaders = { ...finalHeaders, ...(output.headers || {}) };
          finalBody = output.body;
        } else {
          // If Prism didn't return output, try fallback fixture matching
          const fallbackResponse = await tryFallbackFixtureMatch(
            prismRequest,
            fixtures,
          );
          if (fallbackResponse) {
            finalStatusCode = fallbackResponse.status;
            finalHeaders = {
              ...finalHeaders,
              ...(fallbackResponse.headers || {}),
            };
            finalBody = fallbackResponse.body;
          } else {
            // Final fallback
            finalStatusCode = 404;
            finalBody = {
              error: "not_found",
              message: "No matching operation found",
            };
          }
        }

        // Set response headers
        Object.entries(finalHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.statusCode = finalStatusCode;

        // Handle different response body types
        let responseBody = "";
        if (finalBody !== undefined && finalBody !== null) {
          if (typeof finalBody === "string") {
            responseBody = finalBody;
          } else if (typeof finalBody === "object") {
            responseBody = JSON.stringify(finalBody);
          } else {
            responseBody = String(finalBody);
          }
        }

        // End the response
        res.end(responseBody);

        // Calculate duration and create mock objects for handlers
        const duration = Date.now() - startTime;

        const mockRequest: MockRequest = {
          method: req.method || "GET",
          path: url.pathname,
          headers: normalizedHeaders,
          query: Object.fromEntries(url.searchParams.entries()),
          body,
        };

        const mockResponse: MockResponse = {
          status: finalStatusCode,
          headers: finalHeaders,
          body: finalBody,
          duration,
        };

        // Invoke all registered handlers
        for (const handler of handlers) {
          try {
            await handler(mockRequest, mockResponse);
          } catch (handlerError) {
            // Log handler errors but don't fail the request
            console.error("Handler error:", handlerError);
          }
        }
      } catch (error: any) {
        // Calculate duration even for errors
        const duration = Date.now() - startTime;

        // Handle Prism errors gracefully
        let statusCode = 500;
        let errorResponse: any = {
          error: "InternalServerError",
          message: "An unexpected error occurred",
        };

        // Check for validation errors
        if (error.name === "ProblemJsonError" || error.type) {
          statusCode = error.status || 400;
          errorResponse = {
            error: error.type || "ValidationError",
            message: error.title || error.message,
            details: error.detail || error.validation,
          };
        } else if (error.status || error.statusCode) {
          statusCode = error.status || error.statusCode;
          errorResponse = {
            error: error.name || "RequestError",
            message: error.message,
            details: error.validation || error.detail,
          };
        }

        res.statusCode = statusCode;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(errorResponse));

        // Create mock objects for handlers even for errors
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        const normalizedHeaders: Record<string, string> = {};
        Object.entries(req.headers).forEach(([key, value]) => {
          if (typeof value === "string") {
            normalizedHeaders[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            normalizedHeaders[key.toLowerCase()] = value.join(", ");
          }
        });

        const mockRequest: MockRequest = {
          method: req.method || "GET",
          path: url.pathname,
          headers: normalizedHeaders,
          query: Object.fromEntries(url.searchParams.entries()),
          body: undefined, // Don't try to read body again on error
        };

        const mockResponse: MockResponse = {
          status: statusCode,
          headers: { "content-type": "application/json" },
          body: errorResponse,
          duration,
        };

        // Invoke all registered handlers for errors too
        for (const handler of handlers) {
          try {
            await handler(mockRequest, mockResponse);
          } catch (handlerError) {
            // Log handler errors but don't fail the request
            console.error("Handler error:", handlerError);
          }
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const getRequestBody = async (req: any): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : undefined);
        } catch (error) {
          resolve(body || undefined);
        }
      });
      req.on("error", reject);
    });
  };

  const tryFallbackFixtureMatch = async (
    request: any,
    availableFixtures: Fixture[],
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
  } | null> => {
    if (!availableFixtures || availableFixtures.length === 0) {
      return null;
    }

    // Find all matching fixtures by method and path, then prioritize
    const candidateFixtures = availableFixtures.filter((fixture) => {
      const fixtureRequest = fixture.data.request as any;

      // Match method
      if (
        fixtureRequest.method.toLowerCase() !== request.method.toLowerCase()
      ) {
        return false;
      }

      // For path matching, try exact match first, then pattern match
      const exactPathMatch = fixtureRequest.path === request.url.path;
      const patternPathMatch = pathMatches(
        fixtureRequest.path,
        request.url.path,
      );

      if (!exactPathMatch && !patternPathMatch) {
        return false;
      }

      // For POST/PUT requests, try to match body if both exist
      if (request.body && fixtureRequest.body) {
        try {
          const requestBodyStr = JSON.stringify(request.body);
          const fixtureBodyStr = JSON.stringify(fixtureRequest.body);
          return requestBodyStr === fixtureBodyStr;
        } catch {
          // If JSON comparison fails, fall back to string comparison
          return String(request.body) === String(fixtureRequest.body);
        }
      }

      return true;
    });

    if (candidateFixtures.length === 0) {
      return null;
    }

    // Prioritize exact path matches over pattern matches
    const exactMatches = candidateFixtures.filter((fixture) => {
      const fixtureRequest = fixture.data.request as any;
      return fixtureRequest.path === request.url.path;
    });

    const matchingFixture =
      exactMatches.length > 0 ? exactMatches[0] : candidateFixtures[0];

    if (!matchingFixture) {
      return null;
    }

    const fixtureResponse = matchingFixture.data.response as any;
    return {
      status: fixtureResponse.status,
      headers: fixtureResponse.headers || {
        "content-type": "application/json",
      },
      body: fixtureResponse.body,
    };
  };

  return {
    url: `http://localhost:${port}`,
    port: port,
    close: async () => {
      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
        });
        httpServer = null;
      }
      if (prismInstance) {
        prismInstance = null;
      }
    },
    onRequest: (handler) => {
      handlers.push(handler);
    },
    // Internal method to start Prism with spec and fixtures
    _startPrism: startPrism,
    // Internal method to get current operations for operation extraction
    _getOperations: () => operations,
  } as MockServer & {
    _startPrism: (spec: OpenAPISpec, fixtures: Fixture[]) => Promise<void>;
    _getOperations: () => any[];
  };
};

const createFixtureCollector = (
  service: string,
  version: string,
  fixtureManager: ReturnType<typeof createFixtureManager>,
): FixtureCollector => {
  const collectedFixtures = new Map<
    string,
    { operation: string; data: { request?: unknown; response: unknown } }
  >();

  return {
    collect: async (
      operation: string,
      data: { request?: unknown; response: unknown },
    ) => {
      // Generate hash to check for duplicates
      const hash = await generateFixtureHash(operation, data);

      if (!collectedFixtures.has(hash)) {
        collectedFixtures.set(hash, { operation, data });
      }
    },

    uploadCollected: async () => {
      if (collectedFixtures.size === 0) {
        return;
      }

      for (const { operation, data } of collectedFixtures.values()) {
        try {
          await fixtureManager.propose({
            service,
            serviceVersion: version,
            operation,
            source: "consumer",
            data,
            createdFrom: {
              type: "test_output",
              timestamp: new Date(),
              generatedBy: "consumer-test",
              testRun: process.env.BUILD_ID || "local",
            },
            notes: "Auto-generated fixture from consumer test",
          });
        } catch (error) {}
      }

      collectedFixtures.clear();
    },

    getCollectedCount: () => collectedFixtures.size,
  };
};

const createEntenteMock = (mockConfig: {
  service: string;
  version: string;
  mockServer: MockServer;
  recorder?: InteractionRecorder;
  fixtures: Fixture[];
  fixtureManager: ReturnType<typeof createFixtureManager>;
  hasFixtures: boolean;
  config: ClientConfig & { consumer: string; consumerVersion: string }; // Resolved config with required fields
  skipOperations: boolean; // Skip operations when using fallback values
}): EntenteMock => {
  // Create fixture collector for deduplication
  const fixtureCollector = createFixtureCollector(
    mockConfig.service,
    mockConfig.version,
    mockConfig.fixtureManager,
  );

  // Set up recording if enabled
  if (mockConfig.recorder) {
    mockConfig.mockServer.onRequest(async (request, response) => {
      // Get operations from the mock server for spec-based operation extraction
      const operations =
        (mockConfig.mockServer as any)._getOperations?.() || [];
      const operation = extractOperationFromSpec(
        request.method,
        request.path,
        operations,
      );

      await mockConfig.recorder!.record({
        service: mockConfig.service,
        consumer: mockConfig.config.consumer,
        consumerVersion: mockConfig.config.consumerVersion,
        environment: mockConfig.config.environment,
        operation,
        request: {
          method: request.method,
          path: request.path,
          headers: request.headers,
          query: request.query,
          body: request.body,
        },
        response: {
          status: response.status,
          headers: response.headers,
          body: response.body,
        },
        duration: response.duration,
      });
    });
  }

  // Set up fixture collection if no fixtures exist and not skipping operations
  if (!mockConfig.hasFixtures && process.env.CI && !mockConfig.skipOperations) {
    mockConfig.mockServer.onRequest(async (request, response) => {
      // Only collect fixtures for successful responses
      if (response.status >= 200 && response.status < 300) {
        // Get operations from the mock server for spec-based operation extraction
        const operations =
          (mockConfig.mockServer as any)._getOperations?.() || [];
        const operation = extractOperationFromSpec(
          request.method,
          request.path,
          operations,
        );

        await fixtureCollector.collect(operation, {
          request: {
            method: request.method,
            path: request.path,
            headers: request.headers,
            query: request.query,
            body: request.body,
          },
          response: {
            status: response.status,
            headers: response.headers,
            body: response.body,
          },
        });
      }
    });
  } else if (
    !mockConfig.hasFixtures &&
    process.env.CI &&
    mockConfig.skipOperations
  ) {
    console.log(`🚫 Skipping fixture collection - consumer info unavailable`);
  }

  return {
    url: mockConfig.mockServer.url,
    port: mockConfig.mockServer.port,
    close: async () => {
      // Upload collected fixtures before closing
      await fixtureCollector.uploadCollected();

      await mockConfig.mockServer.close();

      if (mockConfig.recorder) {
        await mockConfig.recorder.flush();
      }
    },
    getFixtures: () => mockConfig.fixtures,
    proposeFixture: async (
      operation: string,
      data: { request?: unknown; response: unknown },
    ) => {
      if (mockConfig.skipOperations) {
        console.log(
          `🚫 Skipping fixture proposal for ${operation} - consumer info unavailable`,
        );
        return;
      }

      await mockConfig.fixtureManager.propose({
        service: mockConfig.service,
        serviceVersion: mockConfig.version,
        operation,
        source: "consumer",
        data,
        createdFrom: {
          type: "manual",
          timestamp: new Date(),
          generatedBy: "manual-proposal",
        },
        notes: "Manually proposed fixture",
      });
    },
  };
};

const createInteractionRecorder = (
  config: ClientConfig & { consumer: string; consumerVersion: string },
): InteractionRecorder => {
  const pendingInteractions: ClientInteraction[] = [];
  const seenInteractionHashes = new Set<string>();
  let cachedGitSha: string | null = null;

  const flush = async () => {
    if (pendingInteractions.length === 0) return;

    try {
      // Send all interactions in one batch request
      const response = await fetch(
        `${config.serviceUrl}/api/interactions/batch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pendingInteractions),
        },
      );

      if (response.ok) {
        const result = await response.json();
        console.log(
          `✅ Batch uploaded ${pendingInteractions.length} interactions: ${result.results.recorded} recorded, ${result.results.duplicates} duplicates`,
        );
      } else {
        console.error(
          `❌ Failed to upload interactions batch: ${response.status} ${response.statusText}`,
        );
      }

      pendingInteractions.length = 0; // Clear array
      seenInteractionHashes.clear(); // Clear deduplication cache
    } catch (error) {
      console.error(`❌ Error uploading interactions batch: ${error}`);
    }
  };

  return {
    record: async (
      interaction: Omit<ClientInteraction, "id" | "timestamp" | "clientInfo">,
    ) => {
      // Generate hash for client-side deduplication
      const hash = await generateInteractionHash(
        interaction.service,
        config.consumer,
        config.consumerVersion,
        interaction.operation,
        interaction.request,
        interaction.response,
      );

      // Skip if we've already seen this interaction hash in this session
      if (seenInteractionHashes.has(hash)) {
        return;
      }

      seenInteractionHashes.add(hash);

      // Get git SHA once and cache it
      if (cachedGitSha === null) {
        cachedGitSha = getGitSha();
      }

      const fullInteraction: ClientInteraction = {
        ...interaction,
        id: generateId(),
        timestamp: new Date(),
        consumer: config.consumer,
        consumerVersion: config.consumerVersion,
        consumerGitSha: cachedGitSha || undefined,
        environment: config.environment,
        clientInfo: {
          library: "@entente/consumer",
          version: "0.1.0",
          buildId: process.env.BUILD_ID,
          commit: cachedGitSha || undefined,
        },
      };

      pendingInteractions.push(fullInteraction);

      // Auto-flush in CI to avoid losing data
      if (process.env.CI && pendingInteractions.length >= 10) {
        await flush();
      }
    },

    flush,
  };
};

const generateId = (): string => {
  return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const injectFixturesIntoSpec = (
  spec: OpenAPISpec,
  fixtures: Fixture[],
): OpenAPISpec => {
  if (fixtures.length === 0) {
    return spec;
  }

  // Create a deep copy of the spec
  const modifiedSpec = JSON.parse(JSON.stringify(spec));

  // Group fixtures by operation
  const fixturesByOperation = new Map<string, Fixture[]>();
  fixtures.forEach((fixture) => {
    const operation = fixture.operation;
    if (!fixturesByOperation.has(operation)) {
      fixturesByOperation.set(operation, []);
    }
    fixturesByOperation.get(operation)!.push(fixture);
  });

  Object.entries(modifiedSpec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem as any).forEach(([method, operation]) => {
      if (
        typeof operation === "object" &&
        operation &&
        (operation as any).operationId
      ) {
      }
    });
  });

  // Inject fixtures as examples into the spec
  Object.entries(modifiedSpec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem as any).forEach(([method, operation]) => {
      if (
        typeof operation !== "object" ||
        !operation ||
        !(operation as any).operationId
      ) {
        return;
      }

      const operationId = (operation as any).operationId;
      const operationFixtures = fixturesByOperation.get(operationId);
      if (!operationFixtures || operationFixtures.length === 0) {
        return;
      }

      // Group fixtures by status code
      const fixturesByStatus = new Map<number, Fixture[]>();
      operationFixtures.forEach((fixture) => {
        const response = fixture.data.response as any;
        const status = response.status;
        if (!fixturesByStatus.has(status)) {
          fixturesByStatus.set(status, []);
        }
        fixturesByStatus.get(status)!.push(fixture);
      });

      // Inject examples into responses
      const operationObj = operation as any;
      if (operationObj.responses) {
        fixturesByStatus.forEach((statusFixtures, status) => {
          const statusKey = status.toString();
          if (operationObj.responses[statusKey]) {
            const response = operationObj.responses[statusKey];
            if (response.content && response.content["application/json"]) {
              // Use the first fixture's response body as the primary example
              const exampleBody = (statusFixtures[0].data.response as any).body;

              // Set both example and examples for Prism compatibility
              response.content["application/json"].example = exampleBody;

              // Also set examples array with named examples for Prism to pick from
              response.content["application/json"].examples = {
                default: {
                  summary: `Default response for ${operationId}`,
                  value: exampleBody,
                },
              };

              // If there are multiple fixtures for this status, add them as additional examples
              statusFixtures.forEach((fixture, index) => {
                if (index > 0) {
                  const additionalExampleBody = (fixture.data.response as any)
                    .body;
                  response.content["application/json"].examples[
                    `example_${index}`
                  ] = {
                    summary: `Alternative response ${index + 1} for ${operationId}`,
                    value: additionalExampleBody,
                  };
                }
              });
            }
          }
        });
      }
    });
  });

  return modifiedSpec;
};

const uploadLocalFixtures = async (
  serviceUrl: string,
  apiKey: string,
  fixtures: Fixture[],
): Promise<void> => {
  try {
    for (const fixture of fixtures) {
      const response = await fetch(`${serviceUrl}/api/fixtures`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fixture),
      });

      if (!response.ok) {
      } else {
      }
    }
  } catch (error) {}
};

const findMatchingFixture = (
  fixtures: Fixture[],
  request: MockRequest,
): Fixture | undefined => {
  return fixtures.find((fixture) => {
    const fixtureRequest = fixture.data.request as any;

    // Match method
    if (fixtureRequest.method !== request.method) {
      return false;
    }

    // Match path (exact match or pattern match for path parameters)
    if (!pathMatches(fixtureRequest.path, request.path)) {
      return false;
    }

    // If request has body, compare it (for POST/PUT requests)
    if (request.body && fixtureRequest.body) {
      try {
        const requestBodyStr = JSON.stringify(request.body);
        const fixtureBodyStr = JSON.stringify(fixtureRequest.body);
        if (requestBodyStr !== fixtureBodyStr) {
          return false;
        }
      } catch {
        // If JSON comparison fails, do string comparison
        if (String(request.body) !== String(fixtureRequest.body)) {
          return false;
        }
      }
    }

    return true;
  });
};

const pathMatches = (fixturePath: string, requestPath: string): boolean => {
  // Exact match
  if (fixturePath === requestPath) {
    return true;
  }

  // Pattern match for path parameters (e.g., /castles/{id} matches /castles/123)
  const fixtureSegments = fixturePath.split("/");
  const requestSegments = requestPath.split("/");

  if (fixtureSegments.length !== requestSegments.length) {
    return false;
  }

  for (let i = 0; i < fixtureSegments.length; i++) {
    const fixtureSegment = fixtureSegments[i];
    const requestSegment = requestSegments[i];

    // If fixture segment is a parameter (contains alphanumeric chars), it matches any value
    if (
      fixtureSegment &&
      /^[a-zA-Z0-9-]+$/.test(fixtureSegment) &&
      requestSegment
    ) {
      continue;
    }

    // Otherwise, must be exact match
    if (fixtureSegment !== requestSegment) {
      return false;
    }
  }

  return true;
};

const generateResponseFromSpec = (
  spec: OpenAPISpec,
  request: MockRequest,
): MockResponse | null => {
  const path = findSpecPath(spec, request.path, request.method);
  if (!path) {
    return null;
  }

  const operation = path[request.method.toLowerCase() as keyof typeof path];
  if (!operation || typeof operation !== "object") {
    return null;
  }

  // Try to find a 200 response, or the first available response
  const responses = (operation as any).responses;
  const responseKey = responses["200"] ? "200" : Object.keys(responses)[0];
  const responseSpec = responses[responseKey];

  if (!responseSpec) {
    return null;
  }

  const status = Number.parseInt(responseKey, 10);
  const headers = { "content-type": "application/json" };

  // Try to get example from spec
  let body = null;
  if (responseSpec.content && responseSpec.content["application/json"]) {
    const jsonContent = responseSpec.content["application/json"];
    if (jsonContent.example) {
      body = jsonContent.example;
    } else if (jsonContent.schema && jsonContent.schema.example) {
      body = jsonContent.schema.example;
    }
  }

  return { status, headers, body, duration: 0 };
};

const findSpecPath = (
  spec: OpenAPISpec,
  requestPath: string,
  method: string,
): any => {
  const paths = spec.paths;

  // Try exact match first
  if (paths[requestPath]) {
    return paths[requestPath];
  }

  // Try pattern matching for path parameters
  for (const [specPath, pathItem] of Object.entries(paths)) {
    if (pathMatchesSpec(specPath, requestPath)) {
      return pathItem;
    }
  }

  return null;
};

const pathMatchesSpec = (specPath: string, requestPath: string): boolean => {
  const specSegments = specPath.split("/");
  const requestSegments = requestPath.split("/");

  if (specSegments.length !== requestSegments.length) {
    return false;
  }

  for (let i = 0; i < specSegments.length; i++) {
    const specSegment = specSegments[i];
    const requestSegment = requestSegments[i];

    // If spec segment is a parameter (e.g., {id}), it matches any value
    if (specSegment.startsWith("{") && specSegment.endsWith("}")) {
      continue;
    }

    // Otherwise, must be exact match
    if (specSegment !== requestSegment) {
      return false;
    }
  }

  return true;
};
