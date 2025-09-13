import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { envMiddleware } from "./middleware/env.js";
import { databaseMiddleware } from "./middleware/database.js";
import { authMiddleware } from "./middleware/auth.js";

import { specsRouter } from "./routes/specs.js";
import { interactionsRouter } from "./routes/interactions.js";
import { fixturesRouter } from "./routes/fixtures.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { verificationRouter } from "./routes/verification.js";
import { keysRouter } from "./routes/keys.js";
import { authRouter } from "./routes/auth.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", envMiddleware);
app.use("*", databaseMiddleware);
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "https://entente.your-domain.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check (no auth required)
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (no auth required for login)
app.route("/auth", authRouter);

// Protected API routes (require authentication)
app.use("/api/keys/*", authMiddleware);
app.use("/api/specs/*", authMiddleware);
app.use("/api/interactions/*", authMiddleware);
app.use("/api/fixtures/*", authMiddleware);
app.use("/api/deployments/*", authMiddleware);
app.use("/api/verification/*", authMiddleware);

app.route("/api/keys", keysRouter);
app.route("/api/specs", specsRouter);
app.route("/api/interactions", interactionsRouter);
app.route("/api/fixtures", fixturesRouter);
app.route("/api/deployments", deploymentsRouter);
app.route("/api/verification", verificationRouter);

// Can I Deploy endpoint (protected)
app.get("/api/can-i-deploy", authMiddleware, async (c) => {
  const consumer = c.req.query("consumer");
  const version = c.req.query("version");
  const environment = c.req.query("environment");

  if (!consumer || !version || !environment) {
    return c.json({ error: "Missing required parameters" }, 400);
  }

  // TODO: Implement can-i-deploy logic
  // This would check if the consumer version is compatible with all active providers

  return c.json({
    canDeploy: true,
    compatibleProviders: [
      {
        service: "order-service",
        version: "2.1.0",
        verified: true,
        interactionCount: 15,
      },
    ],
    message: "All provider verifications passed",
  });
});

// Export for Cloudflare Workers
export default app;
