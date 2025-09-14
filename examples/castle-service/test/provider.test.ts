import { createProvider } from "@entente/provider";
import { serve } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetCastles } from "../src/db.js";
import app from "../src/index.js";

describe("Castle Service Provider Verification", () => {
  let server: ReturnType<typeof serve>;
  const testPort = 4001;

  beforeEach(async () => {
    resetCastles();

    server = serve({
      fetch: app.fetch,
      port: testPort,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (server) {
      server.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  it("should verify provider against recorded consumer interactions", async () => {
    const provider = createProvider({
      serviceUrl: process.env.ENTENTE_SERVICE_URL || "http://localhost:3000",
      apiKey: process.env.ENTENTE_API_KEY || "test-key",
      provider: "castle-service",
    });

    console.log(process.env);

    const results = await provider.verify({
      baseUrl: `http://localhost:${testPort}`,
      environment: "test", // Verification context (where verification runs)
      stateHandlers: {
        listCastles: async () => {
          console.log("🔄 Resetting castles to default state");
          resetCastles();
        },
        getCastle: async () => {
          console.log("🔄 Resetting castles to default state");
          resetCastles();
        },
        createCastle: async () => {
          console.log("🔄 Resetting castles to default state");
          resetCastles();
        },
        deleteCastle: async () => {
          console.log("🔄 Resetting castles to default state");
          resetCastles();
        },
      },
      cleanup: async () => {
        resetCastles();
      },
    });

    console.log(`\n📊 Provider verification completed`);
    console.log(`📋 Total interactions tested: ${results.results.length}`);

    const successfulResults = results.results.filter((r) => r.success);
    const failedResults = results.results.filter((r) => !r.success);

    console.log(`✅ Successful verifications: ${successfulResults.length}`);
    console.log(`❌ Failed verifications: ${failedResults.length}`);

    if (failedResults.length > 0) {
      console.log("\n❌ Failed verifications:");
      failedResults.forEach((result) => {
        console.log(`  - ${result.interactionId}: ${result.error}`);
      });
    }

    // Better assertions
    expect(results.results).toBeDefined();
    expect(results.results.length).toBeGreaterThan(0);

    // All verifications should pass if the provider correctly implements the contract
    if (failedResults.length > 0) {
      console.log(
        "\n⚠️  Some verifications failed - this indicates the provider doesn't match consumer expectations",
      );
    }

    expect(successfulResults.length).toBeGreaterThan(0);
    expect(failedResults.length).toBe(0);
  });
});
