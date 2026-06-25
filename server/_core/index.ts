import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStandaloneAuthRoutes } from "../standaloneAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runMigrations } from "../migrate";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Run DB migrations before starting the server
  await runMigrations();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerStandaloneAuthRoutes(app);

  // One-time setup endpoint — creates missing tables directly via mysql2
  app.post("/api/setup-db", async (req, res) => {
    const secret = req.headers["x-setup-secret"];
    if (secret !== "gppathfinder-setup-2024") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const statements = [
        `CREATE TABLE IF NOT EXISTS \`sessions\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`userId\` int NOT NULL,
          \`scenarioId\` int NOT NULL,
          \`status\` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
          \`startedAt\` timestamp NOT NULL DEFAULT (now()),
          \`completedAt\` timestamp,
          \`durationSeconds\` int,
          PRIMARY KEY(\`id\`)
        )`,
        `CREATE TABLE IF NOT EXISTS \`messages\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`sessionId\` int NOT NULL,
          \`role\` enum('user','assistant') NOT NULL,
          \`content\` text NOT NULL,
          \`createdAt\` timestamp NOT NULL DEFAULT (now()),
          PRIMARY KEY(\`id\`)
        )`,
        `CREATE TABLE IF NOT EXISTS \`scores\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`sessionId\` int NOT NULL,
          \`userId\` int NOT NULL,
          \`scenarioId\` int NOT NULL,
          \`activeListeningEmpathy\` float NOT NULL,
          \`informationGathering\` float NOT NULL,
          \`policyAdherence\` float NOT NULL,
          \`communicationClarity\` float NOT NULL,
          \`deEscalation\` float NOT NULL,
          \`overallScore\` float NOT NULL,
          \`overallGrade\` varchar(2) NOT NULL,
          \`wentWell\` text NOT NULL,
          \`areasForImprovement\` text NOT NULL,
          \`detailedFeedback\` json NOT NULL,
          \`createdAt\` timestamp NOT NULL DEFAULT (now()),
          PRIMARY KEY(\`id\`),
          UNIQUE KEY \`scores_sessionId_unique\` (\`sessionId\`)
        )`,
      ];
      const results: string[] = [];
      for (const stmt of statements) {
        await conn.execute(stmt);
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/);
        results.push(`Created/verified: ${match?.[1]}`);
      }
      await conn.end();
      return res.json({ success: true, results });
    } catch (err: any) {
      console.error("[setup-db] Error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
