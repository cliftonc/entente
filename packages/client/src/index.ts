import type {
  ClientConfig,
  ClientInteraction,
  Fixture,
  HTTPRequest,
  HTTPResponse,
  MockOptions,
  OpenAPISpec,
} from "@entente/types";
import {
  createFixtureManager,
  extractOperationFromPath,
  prioritizeFixtures,
} from "@entente/fixtures";

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

export interface InteractionRecorder {
  record: (
    interaction: Omit<ClientInteraction, "id" | "timestamp" | "clientInfo">,
  ) => Promise<void>;
  flush: () => Promise<void>;
}

export const createClient = (config: ClientConfig): EntenteClient => {
  const fixtureManager = createFixtureManager(config.serviceUrl, config.apiKey);

  return {
    createMock: async (
      service: string,
      version: string,
      options?: MockOptions,
    ): Promise<EntenteMock> => {
      // Fetch OpenAPI spec from central service
      const spec = await fetchSpec(
        config.serviceUrl,
        service,
        version,
        options?.branch,
      );

      // Fetch existing fixtures if requested
      let fixtures: Fixture[] = [];
      if (options?.useFixtures !== false) {
        fixtures = await fetchFixtures(config.serviceUrl, service, version);
      }

      // Create mock server with fixture support
      const mockServer = await createMockServer({
        spec,
        fixtures,
        port: options?.port || 0,
        validateRequest: options?.validateRequests ?? true,
        validateResponse: options?.validateResponses ?? true,
      });

      // Set up recording if enabled
      let recorder: InteractionRecorder | undefined;
      if (config.recordingEnabled) {
        recorder = createInteractionRecorder(config);
      }

      return createEntenteMock({
        service,
        version,
        mockServer,
        recorder,
        fixtures,
        fixtureManager,
        hasFixtures: fixtures.length > 0,
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
      const response = await fetch(`${config.serviceUrl}/specs/${service}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec,
          metadata: {
            service,
            version,
            branch: metadata.branch || "main",
            environment: metadata.environment,
            uploadedBy: config.consumer,
            uploadedAt: new Date(),
          },
        }),
      });

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
  service: string,
  version: string,
  branch = "main",
): Promise<OpenAPISpec> => {
  const params = new URLSearchParams({ version, branch });
  const response = await fetch(`${serviceUrl}/specs/${service}?${params}`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch spec for ${service}@${version}: ${response.statusText}`,
    );
  }

  return response.json();
};

const fetchFixtures = async (
  serviceUrl: string,
  service: string,
  version: string,
): Promise<Fixture[]> => {
  try {
    // Get all approved fixtures for this service version
    const response = await fetch(
      `${serviceUrl}/fixtures/service/${service}?version=${version}&status=approved`,
    );

    if (response.ok) {
      const fixtures = await response.json();
      return prioritizeFixtures(fixtures);
    }

    console.warn(
      `No fixtures available for ${service}@${version}, will use dynamic mocking`,
    );
    return [];
  } catch (error) {
    console.warn(`Failed to fetch fixtures for ${service}@${version}:`, error);
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
  // Implementation would inject fixtures into OpenAPI spec as examples
  // and configure Prism to use them
  console.log(
    `Creating fixture-based mock server with ${fixtures.length} fixtures`,
  );

  return createBasicMockServer(port);
};

const createSchemaMockServer = async (
  spec: OpenAPISpec,
  port: number,
): Promise<MockServer> => {
  // Implementation would use Prism in dynamic mode
  console.log("Creating schema-based mock server for first run");

  return createBasicMockServer(port);
};

const createBasicMockServer = async (port: number): Promise<MockServer> => {
  // Simplified mock server implementation
  // In practice, this would spawn Prism or similar

  const actualPort = port || 3000 + Math.floor(Math.random() * 1000);
  const handlers: Array<
    (req: MockRequest, res: MockResponse) => Promise<void>
  > = [];

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    close: async () => {
      // Close server
    },
    onRequest: (handler) => {
      handlers.push(handler);
    },
  };
};

const createEntenteMock = (config: {
  service: string;
  version: string;
  mockServer: MockServer;
  recorder?: InteractionRecorder;
  fixtures: Fixture[];
  fixtureManager: ReturnType<typeof createFixtureManager>;
  hasFixtures: boolean;
}): EntenteMock => {
  // Set up recording if enabled
  if (config.recorder) {
    config.mockServer.onRequest(async (request, response) => {
      await config.recorder!.record({
        service: config.service,
        serviceVersion: config.version,
        consumer: "", // Will be filled in by recorder
        consumerVersion: "",
        environment: "",
        operation: extractOperationFromPath(request.method, request.path),
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

  // Set up fixture generation if no fixtures exist
  if (!config.hasFixtures && process.env.CI) {
    config.mockServer.onRequest(async (request, response) => {
      // Only propose fixtures for successful responses
      if (response.status >= 200 && response.status < 300) {
        const operation = extractOperationFromPath(
          request.method,
          request.path,
        );

        console.log(
          `📋 No fixtures found for ${operation}, proposing fixture from response...`,
        );

        await config.fixtureManager.propose({
          service: config.service,
          serviceVersion: config.version,
          operation,
          source: "consumer",
          data: {
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
          },
          createdFrom: {
            type: "test_output",
            timestamp: new Date(),
            generatedBy: "consumer-test",
            testRun: process.env.BUILD_ID || "local",
          },
          notes: "Auto-generated fixture from consumer test",
        });
      }
    });
  }

  return {
    url: config.mockServer.url,
    port: config.mockServer.port,
    close: async () => {
      await config.mockServer.close();

      if (config.recorder) {
        await config.recorder.flush();
      }
    },
    getFixtures: () => config.fixtures,
    proposeFixture: async (
      operation: string,
      data: { request?: unknown; response: unknown },
    ) => {
      await config.fixtureManager.propose({
        service: config.service,
        serviceVersion: config.version,
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
  config: ClientConfig,
): InteractionRecorder => {
  const pendingInteractions: ClientInteraction[] = [];
  const flush = async () => {
    if (pendingInteractions.length === 0) return;

    try {
      for (const interaction of pendingInteractions) {
        await fetch(`${config.serviceUrl}/interactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(interaction),
        });
      }

      pendingInteractions.length = 0; // Clear array
    } catch (error) {
      console.error("Failed to flush interactions:", error);
    }
  };

  return {
    record: async (
      interaction: Omit<ClientInteraction, "id" | "timestamp" | "clientInfo">,
    ) => {
      const fullInteraction: ClientInteraction = {
        ...interaction,
        id: generateId(),
        timestamp: new Date(),
        consumer: config.consumer,
        consumerVersion: config.consumerVersion,
        environment: config.environment,
        clientInfo: {
          library: "@entente/client",
          version: "0.1.0",
          buildId: process.env.BUILD_ID,
          commit: process.env.COMMIT_SHA,
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
