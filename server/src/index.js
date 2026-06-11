import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

import { db, runMigrations } from "./db.js";
import { authPlugin } from "./auth/middleware.js";
import authRoutes from "./routes/auth.js";
import appRoutes from "./routes/app.js";
import adminRoutes from "./routes/admin.js";
import matrixRoutes from "./routes/matrix.js";
import { startBot } from "./services/tgbot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataDir = process.env.DATA_DIR || join(__dirname, "..", "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

runMigrations();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
  trustProxy: true,
  bodyLimit: 1 * 1024 * 1024,
});

await app.register(cors, { origin: true, credentials: true });
await app.register(rateLimit, {
  max: 60, timeWindow: "1 minute",
  allowList: (req) => req.url.startsWith("/api/admin/"),
});

// Auth plugin — direct call (not register) to avoid Fastify encapsulation
await authPlugin(app);

app.get("/api/health", async () => ({ ok: true, t: Date.now() }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(appRoutes, { prefix: "/api" });
await app.register(adminRoutes, { prefix: "/api/admin" });
await app.register(matrixRoutes, { prefix: "/api/matrix" });

// Serve built frontend
const webRoot = join(__dirname, "public");
if (existsSync(webRoot)) {
  await app.register(fastifyStatic, {
    root: webRoot,
    prefix: "/",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found" });
    return reply.sendFile("index.html");
  });
} else {
  app.log.warn("[server] /public not found — frontend not served");
}

startBot();

const port = Number(process.env.PORT || 9797);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`TAO VPN listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    app.log.info(`${sig} received, closing...`);
    try { await app.close(); db.close(); } catch (e) { console.error(e); }
    process.exit(0);
  });
}
