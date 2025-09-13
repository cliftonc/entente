import type { Fixture, FixtureProposal, FixtureUpdate } from "@entente/types";

export interface FixtureManager {
  approve: (
    fixtureId: string,
    approver: string,
    notes?: string,
  ) => Promise<Fixture>;
  update: (fixtureId: string, updates: FixtureUpdate) => Promise<Fixture>;
  getPending: (service?: string) => Promise<Fixture[]>;
  getByOperation: (
    service: string,
    version: string,
    operation: string,
    status?: string,
  ) => Promise<Fixture[]>;
  propose: (proposal: FixtureProposal) => Promise<Fixture>;
  bulkApprove: (testRunId: string, approver: string) => Promise<number>;
  deprecate: (fixtureId: string, reason?: string) => Promise<Fixture>;
}

export const createFixtureManager = (
  serviceUrl: string,
  apiKey: string,
): FixtureManager => {
  const apiCall = async <T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> => {
    const response = await fetch(`${serviceUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(
        `Fixture API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  };

  return {
    approve: async (
      fixtureId: string,
      approver: string,
      notes?: string,
    ): Promise<Fixture> => {
      return apiCall(`/fixtures/${fixtureId}/approve`, {
        method: "POST",
        body: JSON.stringify({ approvedBy: approver, notes }),
      });
    },

    update: async (
      fixtureId: string,
      updates: FixtureUpdate,
    ): Promise<Fixture> => {
      return apiCall(`/fixtures/${fixtureId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },

    getPending: async (service?: string): Promise<Fixture[]> => {
      const params = new URLSearchParams({ status: "draft" });
      if (service) {
        params.set("service", service);
      }

      return apiCall(`/fixtures/pending?${params}`);
    },

    getByOperation: async (
      service: string,
      version: string,
      operation: string,
      status = "approved",
    ): Promise<Fixture[]> => {
      const params = new URLSearchParams({
        service,
        version,
        status,
      });

      return apiCall(`/fixtures/${operation}?${params}`);
    },

    propose: async (proposal: FixtureProposal): Promise<Fixture> => {
      return apiCall("/fixtures", {
        method: "POST",
        body: JSON.stringify(proposal),
      });
    },

    bulkApprove: async (
      testRunId: string,
      approver: string,
    ): Promise<number> => {
      // Get all fixtures from this test run
      const fixtures = await getFixturesByTestRun(serviceUrl, testRunId);
      const pendingFixtures = fixtures.filter((f) => f.status === "draft");

      let approvedCount = 0;
      for (const fixture of pendingFixtures) {
        try {
          await apiCall(`/fixtures/${fixture.id}/approve`, {
            method: "POST",
            body: JSON.stringify({
              approvedBy: approver,
              notes: `Bulk approved from successful test run ${testRunId}`,
            }),
          });
          approvedCount++;
        } catch (error) {
          console.error(`Failed to approve fixture ${fixture.id}:`, error);
        }
      }

      return approvedCount;
    },

    deprecate: async (fixtureId: string, reason?: string): Promise<Fixture> => {
      return apiCall(`/fixtures/${fixtureId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "deprecated",
          notes: reason,
        }),
      });
    },
  };
};

// Helper function to get fixtures by test run
const getFixturesByTestRun = async (
  serviceUrl: string,
  testRunId: string,
): Promise<Fixture[]> => {
  const response = await fetch(`${serviceUrl}/fixtures?testRun=${testRunId}`);

  if (!response.ok) {
    throw new Error(`Failed to get fixtures for test run ${testRunId}`);
  }

  return response.json();
};

// Utility functions for fixture management
export const validateFixtureData = (data: unknown): boolean => {
  if (!data || typeof data !== "object") {
    return false;
  }

  const fixtureData = data as Record<string, unknown>;

  // Must have response data
  if (!fixtureData.response) {
    return false;
  }

  // If request is provided, it should be an object
  if (fixtureData.request && typeof fixtureData.request !== "object") {
    return false;
  }

  // If state is provided, it should be an object
  if (fixtureData.state && typeof fixtureData.state !== "object") {
    return false;
  }

  return true;
};

export const prioritizeFixtures = (fixtures: Fixture[]): Fixture[] => {
  return fixtures
    .filter((f) => f.status === "approved")
    .sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Provider fixtures over consumer fixtures
      const sourceOrder = { provider: 3, manual: 2, consumer: 1 };
      return sourceOrder[b.source] - sourceOrder[a.source];
    });
};

export const extractOperationFromPath = (
  method: string,
  path: string,
): string => {
  // Convert HTTP method and path to operation ID
  // Examples:
  // GET /orders/{id} -> getOrder
  // POST /orders -> createOrder
  // PUT /orders/{id} -> updateOrder

  const cleanPath = path
    .replace(/\{[^}]+\}/g, "") // Remove path parameters
    .replace(/\/$/, "") // Remove trailing slash
    .split("/")
    .filter(Boolean)
    .join("");

  const methodPrefix = method.toLowerCase();

  if (cleanPath) {
    return `${methodPrefix}${cleanPath.charAt(0).toUpperCase()}${cleanPath.slice(1)}`;
  }

  return methodPrefix;
};
