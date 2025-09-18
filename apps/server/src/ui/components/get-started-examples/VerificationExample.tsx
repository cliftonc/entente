import CodeBlock from '../CodeBlock'

function VerificationExample() {
  const installCode = `npm install @entente/provider`

  const verificationCode = `import { createProvider } from "@entente/provider";
import { serve } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetCastles, setCastles } from "../src/db.js";
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
  });

  afterEach(async () => {
    if (server) {
      server.close();
    }
  });

  it("should verify provider against recorded consumer interactions", async () => {
    const provider = createProvider({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      provider: "castle-service",
      useNormalizedFixtures: true,

      // Provide database setup callback
      dataSetupCallback: async (fixtures) => {
        // Extract castle entities from normalized fixtures
        const castleEntities = fixtures.entities.Castle || [];

        // Transform fixture format to Castle interface
        const castles = castleEntities.map(entity => ({
          id: entity.data.id,
          name: entity.data.name,
          region: entity.data.region,
          yearBuilt: entity.data.yearBuilt,
          description: entity.data.description,
        }));

        // Set the castle data for the virtual database
        setCastles(castles);

        console.log(\`🏰 Initialized virtual database with \${castles.length} castles from fixtures\`);
      },
    });

    const results = await provider.verify({
      baseUrl: \`http://localhost:\${testPort}\`,
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

    console.log("\n📊 Provider verification completed");
    console.log(\`📋 Total interactions tested: \${results.results.length}\`);

    const successfulResults = results.results.filter((r) => r.success);
    const failedResults = results.results.filter((r) => !r.success);

    console.log(\`✅ Successful verifications: \${successfulResults.length}\`);
    console.log(\`❌ Failed verifications: \${failedResults.length}\`);

    if (failedResults.length > 0) {
      console.log("\n❌ Failed verifications:");
      for (const result of failedResults) {
        console.log(\`  - \${result.interactionId}: \${result.error}\`);
      }
    }

    // Better assertions
    expect(results.results).toBeDefined();

    // All verifications should pass if the provider correctly implements the contract
    if (failedResults.length > 0) {
      console.log(
        "\n⚠️  Some verifications failed - this indicates the provider doesn't match consumer expectations",
      );
    }

    expect(failedResults.length).toBe(0);
  });
});`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Add Provider Verification</h4>
        <CodeBlock code={installCode} language="bash" showLineNumbers={false} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Add to your tests (
          <a
            href="https://github.com/entente-dev/entente-example-castle-service/blob/main/test/provider.test.ts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            see example
          </a>
          )
        </h4>
        <CodeBlock code={verificationCode} language="typescript" />
      </div>
    </div>
  )
}

export default VerificationExample
