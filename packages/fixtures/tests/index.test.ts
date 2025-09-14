import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFixtureManager,
  validateFixtureData,
  prioritizeFixtures,
  extractOperationFromPath,
  generateFixtureHash,
  generateInteractionHash,
} from "../src/index";
import type { Fixture, FixtureProposal } from "@entente/types";

// Mock fetch globally
global.fetch = vi.fn();

describe("createFixtureManager", () => {
  const mockServiceUrl = "https://api.test.com";
  const mockApiKey = "test-api-key";
  const mockFetch = fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any);
  });

  it("creates a fixture manager with all required methods", () => {
    const manager = createFixtureManager(mockServiceUrl, mockApiKey);

    expect(manager).toHaveProperty("approve");
    expect(manager).toHaveProperty("update");
    expect(manager).toHaveProperty("getPending");
    expect(manager).toHaveProperty("getByOperation");
    expect(manager).toHaveProperty("propose");
    expect(manager).toHaveProperty("bulkApprove");
    expect(manager).toHaveProperty("deprecate");
  });

  describe("approve", () => {
    it("makes correct API call to approve fixture", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);
      const mockFixture: Fixture = {
        id: "fixture-123",
        service: "test-service",
        version: "1.0.0",
        operation: "getUser",
        status: "approved",
        priority: 1,
        source: "consumer",
        data: { response: { id: 1, name: "Test" } },
        createdAt: new Date(),
        approvedBy: "test-user",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockFixture),
      } as any);

      const result = await manager.approve(
        "fixture-123",
        "test-user",
        "Looks good",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures/fixture-123/approve",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approvedBy: "test-user",
            notes: "Looks good",
          }),
        },
      );
      expect(result).toEqual(mockFixture);
    });

    it("throws error on API failure", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      await expect(
        manager.approve("nonexistent", "user", "note"),
      ).rejects.toThrow("Fixture API error: 404 Not Found");
    });
  });

  describe("getPending", () => {
    it("fetches pending fixtures without service filter", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);
      const mockFixtures: Fixture[] = [];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockFixtures),
      } as any);

      await manager.getPending();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures/pending?status=draft",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("fetches pending fixtures with service filter", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);

      await manager.getPending("test-service");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures/pending?status=draft&service=test-service",
        expect.any(Object),
      );
    });
  });

  describe("getByOperation", () => {
    it("fetches fixtures by operation with default status", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);

      await manager.getByOperation("test-service", "1.0.0", "getUser");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures/getUser?service=test-service&version=1.0.0&status=approved",
        expect.any(Object),
      );
    });

    it("fetches fixtures by operation with custom status", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);

      await manager.getByOperation("test-service", "1.0.0", "getUser", "draft");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures/getUser?service=test-service&version=1.0.0&status=draft",
        expect.any(Object),
      );
    });
  });

  describe("propose", () => {
    it("creates new fixture proposal", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);
      const proposal: FixtureProposal = {
        service: "test-service",
        version: "1.0.0",
        operation: "getUser",
        data: { response: { id: 1 } },
        source: "consumer",
        priority: 1,
      };

      await manager.propose(proposal);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/fixtures",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(proposal),
        },
      );
    });
  });

  describe("bulkApprove", () => {
    it("approves all fixtures from test run", async () => {
      const manager = createFixtureManager(mockServiceUrl, mockApiKey);
      const mockFixtures: Fixture[] = [
        {
          id: "fixture-1",
          service: "test-service",
          version: "1.0.0",
          operation: "getUser",
          status: "draft",
          priority: 1,
          source: "consumer",
          data: { response: { id: 1 } },
          createdAt: new Date(),
        },
        {
          id: "fixture-2",
          service: "test-service",
          version: "1.0.0",
          operation: "getUser",
          status: "approved",
          priority: 1,
          source: "consumer",
          data: { response: { id: 2 } },
          createdAt: new Date(),
        },
      ];

      // Mock the getFixturesByTestRun call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockFixtures),
        } as any)
        // Mock the approve call for the draft fixture
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        } as any);

      const count = await manager.bulkApprove("test-run-123", "ci-bot");

      expect(count).toBe(1); // Only 1 draft fixture should be approved
      expect(mockFetch).toHaveBeenCalledTimes(2); // One for get, one for approve
    });
  });
});

describe("validateFixtureData", () => {
  it("validates valid fixture data", () => {
    expect(
      validateFixtureData({
        response: { id: 1, name: "Test" },
        request: { id: 1 },
      }),
    ).toBe(true);
  });

  it("validates fixture data without request", () => {
    expect(validateFixtureData({ response: { id: 1 } })).toBe(true);
  });

  it("rejects data without response", () => {
    expect(validateFixtureData({ request: { id: 1 } })).toBe(false);
  });

  it("rejects non-object data", () => {
    expect(validateFixtureData("invalid")).toBe(false);
    expect(validateFixtureData(null)).toBe(false);
    expect(validateFixtureData(123)).toBe(false);
  });

  it("rejects invalid request type", () => {
    expect(
      validateFixtureData({
        response: { id: 1 },
        request: "invalid",
      }),
    ).toBe(false);
  });
});

describe("prioritizeFixtures", () => {
  const mockFixtures: Fixture[] = [
    {
      id: "1",
      service: "test",
      version: "1.0.0",
      operation: "test",
      status: "approved",
      priority: 1,
      source: "consumer",
      data: { response: {} },
      createdAt: new Date(),
    },
    {
      id: "2",
      service: "test",
      version: "1.0.0",
      operation: "test",
      status: "approved",
      priority: 2,
      source: "provider",
      data: { response: {} },
      createdAt: new Date(),
    },
    {
      id: "3",
      service: "test",
      version: "1.0.0",
      operation: "test",
      status: "draft",
      priority: 3,
      source: "manual",
      data: { response: {} },
      createdAt: new Date(),
    },
  ];

  it("filters out non-approved fixtures", () => {
    const result = prioritizeFixtures(mockFixtures);
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.status === "approved")).toBe(true);
  });

  it("sorts by priority (higher first)", () => {
    const result = prioritizeFixtures(mockFixtures);
    expect(result[0].priority).toBe(2);
    expect(result[1].priority).toBe(1);
  });

  it("sorts by source when priority is equal", () => {
    const equalPriorityFixtures: Fixture[] = [
      { ...mockFixtures[0], priority: 1, source: "consumer" },
      { ...mockFixtures[1], priority: 1, source: "provider" },
    ];

    const result = prioritizeFixtures(equalPriorityFixtures);
    expect(result[0].source).toBe("provider");
    expect(result[1].source).toBe("consumer");
  });
});

describe("extractOperationFromPath", () => {
  it("extracts operation from simple paths", () => {
    expect(extractOperationFromPath("GET", "/orders")).toBe("getOrder");
    expect(extractOperationFromPath("POST", "/orders")).toBe("postOrder");
    expect(extractOperationFromPath("PUT", "/users")).toBe("putUser");
  });

  it("handles UUID parameters in path", () => {
    expect(
      extractOperationFromPath(
        "GET",
        "/orders/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("getOrder");
    expect(
      extractOperationFromPath(
        "DELETE",
        "/users/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("deleteUser");
  });

  it("handles numeric IDs in path", () => {
    expect(extractOperationFromPath("GET", "/orders/123")).toBe("getOrder");
    expect(extractOperationFromPath("PUT", "/users/456")).toBe("putUser");
  });

  it("handles OpenAPI path parameters", () => {
    expect(extractOperationFromPath("GET", "/orders/{id}")).toBe("getOrder");
    expect(extractOperationFromPath("DELETE", "/users/{userId}")).toBe(
      "deleteUser",
    );
  });

  it("handles nested paths", () => {
    expect(extractOperationFromPath("GET", "/users/123/orders")).toBe(
      "getUsersorder",
    );
    expect(extractOperationFromPath("POST", "/organizations/456/members")).toBe(
      "postOrganizationsmember",
    );
  });

  it("handles root path", () => {
    expect(extractOperationFromPath("GET", "/")).toBe("get");
    expect(extractOperationFromPath("POST", "")).toBe("post");
  });
});

describe("generateFixtureHash", () => {
  it("generates consistent hash for same data", async () => {
    const data = { response: { id: 1, name: "Test" } };
    const operation = "getUser";

    const hash1 = await generateFixtureHash(operation, data);
    const hash2 = await generateFixtureHash(operation, data);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
  });

  it("generates different hashes for different data", async () => {
    const data1 = { response: { id: 1, name: "Test1" } };
    const data2 = { response: { id: 2, name: "Test2" } };
    const operation = "getUser";

    const hash1 = await generateFixtureHash(operation, data1);
    const hash2 = await generateFixtureHash(operation, data2);

    expect(hash1).not.toBe(hash2);
  });

  it("normalizes volatile fields", async () => {
    const data1 = {
      response: {
        id: 1,
        name: "Test",
        timestamp: "2023-01-01T00:00:00Z",
        created_at: "2023-01-01T00:00:00Z",
      },
    };
    const data2 = {
      response: {
        id: 1,
        name: "Test",
        timestamp: "2023-01-02T00:00:00Z",
        created_at: "2023-01-02T00:00:00Z",
      },
    };
    const operation = "getUser";

    const hash1 = await generateFixtureHash(operation, data1);
    const hash2 = await generateFixtureHash(operation, data2);

    expect(hash1).toBe(hash2); // Should be same as timestamps are normalized
  });
});

describe("generateInteractionHash", () => {
  it("generates consistent hash for same interaction", async () => {
    const params = {
      service: "user-service",
      consumer: "web-app",
      consumerVersion: "1.0.0",
      operation: "getUser",
      request: { id: 1 },
      response: { id: 1, name: "Test" },
    };

    const hash1 = await generateInteractionHash(
      params.service,
      params.consumer,
      params.consumerVersion,
      params.operation,
      params.request,
      params.response,
    );
    const hash2 = await generateInteractionHash(
      params.service,
      params.consumer,
      params.consumerVersion,
      params.operation,
      params.request,
      params.response,
    );

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates different hashes for different interactions", async () => {
    const baseParams = {
      service: "user-service",
      consumer: "web-app",
      consumerVersion: "1.0.0",
      operation: "getUser",
      request: { id: 1 },
      response: { id: 1, name: "Test" },
    };

    const hash1 = await generateInteractionHash(
      baseParams.service,
      baseParams.consumer,
      baseParams.consumerVersion,
      baseParams.operation,
      baseParams.request,
      baseParams.response,
    );
    const hash2 = await generateInteractionHash(
      "different-service",
      baseParams.consumer,
      baseParams.consumerVersion,
      baseParams.operation,
      baseParams.request,
      baseParams.response,
    );

    expect(hash1).not.toBe(hash2);
  });
});
