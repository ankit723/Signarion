import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

dotenv.config();

import { createLogger } from "./utils/logger.js";
import { pingCache, closeRedis, isCacheReady } from "./utils/redis.js";
import authRoutes from "./routes/auth.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import invitationRoutes from "./routes/invitation.routes.js";
import queueRoutes from "./routes/queue.routes.js";

const log = createLogger("app");

const PORT = Number(process.env.PORT) || 8001;
// Must exceed the ALB idle timeout (default 60s) or the ALB will reuse a
// connection Node just closed and you get sporadic 502s.
const KEEP_ALIVE_TIMEOUT_MS = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65_000;
// Below the ALB idle timeout, so a stuck handler produces our own 503 with a
// log line rather than an opaque ALB 504.
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 45_000;

const app = express();

// Behind an ALB: without this, req.ip is the load balancer and rate limiting
// and logs all show the same address.
app.set("trust proxy", true);

app.use(
  cors({
    // `credentials: true` with origin "*" is rejected by browsers, so list the
    // real origins. CORS_ORIGINS is a comma-separated list.
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));

/* ------------------------------------------------------------------ *
 * Request logging — registered before every route (health included) so
 * nothing that reaches this process is invisible in CloudWatch.
 * ------------------------------------------------------------------ */
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || randomUUID();
  req.startedAt = Date.now();
  res.setHeader("X-Request-Id", req.id);

  log.info("request received", {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.on("finish", () => {
    const durationMs = Date.now() - req.startedAt;
    const line = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      uid: req.user?.uid,
    };
    if (res.statusCode >= 500) log.error("request failed", line);
    else if (durationMs > 5_000) log.warn("slow request", line);
    else log.info("request completed", line);
  });

  // Fires when the client (or the ALB) hangs up before we answered — the
  // fingerprint of a 504.
  res.on("close", () => {
    if (!res.writableEnded) {
      log.error("connection closed before a response was sent", {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        durationMs: Date.now() - req.startedAt,
      });
    }
  });

  next();
});

/**
 * Safety net for handlers that never resolve. Anything that would have become
 * an ALB 504 becomes a logged 503 naming the exact route.
 */
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (res.headersSent) return;
    log.error("handler timed out — responding 503", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    res.status(503).json({ error: "Request timed out", requestId: req.id });
  }, REQUEST_TIMEOUT_MS);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

/* ------------------------------------------------------------------ *
 * Probes
 * ------------------------------------------------------------------ */

/**
 * Liveness — point the ALB target group health check here. It touches no
 * dependency on purpose: a Mongo or Redis blip should not make ECS kill
 * healthy tasks and take the whole service down.
 */
app.get("/health", (req, res) =>
  res.status(200).json({
    status: "ok",
    service: process.env.SERVICE_NAME || "api",
    uptimeSeconds: Math.round(process.uptime()),
  }),
);

/** Readiness — for deploys and debugging. Reports each dependency separately. */
app.get("/ready", async (req, res) => {
  const mongoStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const checks = {
    mongo: {
      state: mongoStates[mongoose.connection.readyState] ?? "unknown",
      ok: mongoose.connection.readyState === 1,
    },
    redis: { configured: Boolean(process.env.REDIS_URL), ready: isCacheReady(), pingMs: null },
  };

  try {
    checks.redis.pingMs = await pingCache();
  } catch (error) {
    log.warn("readiness redis ping threw", { requestId: req.id, error: error?.message });
  }
  checks.redis.ok = checks.redis.pingMs !== null;

  const ok = checks.mongo.ok && (checks.redis.ok || !checks.redis.configured);
  log.info("readiness probed", { requestId: req.id, ok, checks });
  return res.status(ok ? 200 : 503).json({ ok, checks });
});

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */
app.use("/api/auth", authRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/admin/queues", queueRoutes);

app.use((req, res) => {
  log.warn("no route matched", { requestId: req.id, method: req.method, path: req.originalUrl });
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

/** Central error handler. Express 5 forwards rejected async handlers here. */
app.use((err, req, res, next) => {
  log.error("unhandled error in request pipeline", {
    requestId: req?.id,
    method: req?.method,
    path: req?.originalUrl,
    error: err,
  });

  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err?.message,
    requestId: req?.id,
  });
});

/* ------------------------------------------------------------------ *
 * Boot
 *
 * The server starts listening FIRST, then Mongo connects in the background.
 * Previously `app.listen` sat inside `mongoose.connect().then()`, so a Mongo
 * failure left a task that was "running" but listening on nothing — ECS never
 * restarted it and every request 504'd at the ALB.
 * ------------------------------------------------------------------ */
const server = app.listen(PORT, "0.0.0.0", () => {
  log.info("server listening", { port: PORT, nodeEnv: process.env.NODE_ENV });
});

server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = KEEP_ALIVE_TIMEOUT_MS + 5_000;

server.on("error", (error) => {
  log.error("http server error", { error });
  process.exit(1);
});

const connectMongo = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/auth_db";
  try {
    log.info("connecting to MongoDB", { host: uri.replace(/\/\/[^@]*@/, "//<redacted>@") });
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10_000,
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45_000,
    });
    log.info("connected to MongoDB");
  } catch (error) {
    // Fatal: exit so ECS replaces the task instead of keeping a broken one.
    log.error("MongoDB connection failed — exiting so ECS restarts the task", { error });
    process.exit(1);
  }
};

mongoose.connection.on("error", (error) => log.error("mongo connection error", { error }));
mongoose.connection.on("disconnected", () => log.warn("mongo disconnected"));
mongoose.connection.on("reconnected", () => log.info("mongo reconnected"));

void connectMongo();

/* ------------------------------------------------------------------ *
 * Shutdown & process-level safety nets
 * ------------------------------------------------------------------ */
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutdown started", { signal });

  const force = setTimeout(() => {
    log.error("graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000);
  force.unref();

  try {
    await new Promise((resolve) => server.close(resolve));
    log.info("http server closed");
    await mongoose.connection.close(false);
    log.info("mongo connection closed");
    await closeRedis();
    clearTimeout(force);
    log.info("shutdown complete");
    process.exit(0);
  } catch (error) {
    log.error("error during shutdown", { error });
    process.exit(1);
  }
};

// ECS sends SIGTERM before SIGKILL on every deploy and scale-in.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  log.error("unhandled promise rejection", {
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});

process.on("uncaughtException", (error) => {
  log.error("uncaught exception — exiting", { error });
  void shutdown("uncaughtException");
});

export default app;
