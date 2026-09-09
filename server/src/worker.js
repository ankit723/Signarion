import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Worker } from "bullmq";
import nodemailer from "nodemailer";

import { createLogger } from "./utils/logger.js";
import { createQueueConnection, closeRedis, QUEUE_PREFIX } from "./utils/redis.js";
import Workspace from "./models/workspace.model.js";
import { crawlEntireWebsite } from "./utils/scraper.js";
import { generateICPFromScrapedData } from "./utils/icpGenerator.js";
import { EMAIL_QUEUE_NAME, ICP_QUEUE_NAME } from "./utils/queueNames.js";

const log = createLogger("worker");

if (!process.env.REDIS_URL) {
  log.error("REDIS_URL is not set — the worker has nothing to connect to. Exiting.");
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * MongoDB
 * ------------------------------------------------------------------ */
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
    // Every job needs Mongo — exit so ECS restarts the task rather than
    // silently failing jobs forever.
    log.error("MongoDB connection failed — exiting so ECS restarts the task", { error });
    process.exit(1);
  }
};

mongoose.connection.on("error", (error) => log.error("mongo connection error", { error }));
mongoose.connection.on("disconnected", () => log.warn("mongo disconnected"));
mongoose.connection.on("reconnected", () => log.info("mongo reconnected"));

await connectMongo();

/* ------------------------------------------------------------------ *
 * Email worker
 * ------------------------------------------------------------------ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

try {
  await transporter.verify();
  log.info("SMTP transport verified", {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
  });
} catch (error) {
  // Not fatal — credentials may come good later, and failing jobs will say so.
  log.error("SMTP verification failed — email jobs will fail until this is fixed", { error });
}

// Each Worker gets its own connection. BullMQ workers hold a *blocking*
// connection, so sharing one ioredis instance across workers makes them
// serialise behind each other.
const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const startedAt = Date.now();
    const { to, subject, html } = job.data ?? {};
    log.info("email job started", { jobId: job.id, to, subject, attempt: job.attemptsMade + 1 });

    if (!to || !subject) {
      throw new Error(`Malformed email job: missing ${!to ? "to" : "subject"}`);
    }

    try {
      const info = await transporter.sendMail({
        from: `"App Auth" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      log.info("email sent", {
        jobId: job.id,
        to,
        messageId: info?.messageId,
        durationMs: Date.now() - startedAt,
      });
      return { messageId: info?.messageId };
    } catch (error) {
      log.error("email send failed", {
        jobId: job.id,
        to,
        subject,
        attempt: job.attemptsMade + 1,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error; // Let BullMQ retry.
    }
  },
  {
    connection: createQueueConnection("emailWorker"),
    // Must match the Queue's prefix in emailQueue.js or the worker watches
    // a different set of keys and never sees a job.
    prefix: QUEUE_PREFIX,
    concurrency: Number(process.env.EMAIL_CONCURRENCY) || 5,
  },
);

/* ------------------------------------------------------------------ *
 * ICP worker
 * ------------------------------------------------------------------ */
const patchJob = async (workspaceId, patch) => {
  try {
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`icpJob.${k}`, v])) },
    );
    log.debug("icpJob patched", { workspaceId, patch: Object.keys(patch) });
  } catch (error) {
    // Never let a status write take down the job that's actually doing work.
    log.error("failed to patch icpJob status", { workspaceId, patch: Object.keys(patch), error });
  }
};

const icpWorker = new Worker(
  ICP_QUEUE_NAME,
  async (job) => {
    const startedAt = Date.now();
    const { workspaceId, domain } = job.data ?? {};
    log.info("icp job started", { jobId: job.id, workspaceId, domain, attempt: job.attemptsMade + 1 });

    if (!workspaceId || !domain) {
      throw new Error(`Malformed ICP job: missing ${!workspaceId ? "workspaceId" : "domain"}`);
    }

    await patchJob(workspaceId, { status: "running", stage: "Crawling the website", error: null });

    let crawl;
    try {
      const crawlStartedAt = Date.now();
      crawl = await crawlEntireWebsite(`https://${domain}`, { maxPages: 25 });
      log.info("crawl finished", {
        jobId: job.id,
        domain,
        pages: crawl?.pagesVisited ?? crawl?.pages?.length,
        contentChars: crawl?.aggregatedContent?.length,
        durationMs: Date.now() - crawlStartedAt,
      });
    } catch (error) {
      log.error("crawl failed", { jobId: job.id, workspaceId, domain, error });
      throw error;
    }

    await patchJob(workspaceId, { stage: "Building the customer profile" });

    let icp;
    try {
      const icpStartedAt = Date.now();
      icp = await generateICPFromScrapedData(crawl.aggregatedContent, domain);
      log.info("ICP generated", { jobId: job.id, domain, durationMs: Date.now() - icpStartedAt });
    } catch (error) {
      log.error("ICP generation failed", { jobId: job.id, workspaceId, domain, error });
      throw error;
    }

    if (crawl.brandIdentity && Object.keys(crawl.brandIdentity).length > 0) {
      icp.brand_identity = { ...(icp.brand_identity ?? {}), ...crawl.brandIdentity };
    }

    await patchJob(workspaceId, {
      status: "ready",
      stage: null,
      draft: icp,
      error: null,
      finishedAt: new Date(),
    });

    log.info("icp job completed", {
      jobId: job.id,
      workspaceId,
      domain,
      durationMs: Date.now() - startedAt,
    });
    return { workspaceId, domain };
  },
  {
    connection: createQueueConnection("icpWorker"),
    prefix: QUEUE_PREFIX,
    concurrency: Number(process.env.ICP_CONCURRENCY) || 2,
  },
);

/* ------------------------------------------------------------------ *
 * Worker lifecycle logging
 * ------------------------------------------------------------------ */
const attachWorkerLogging = (worker, name) => {
  worker.on("ready", () => log.info("worker ready", { worker: name }));
  worker.on("active", (job) => log.debug("job active", { worker: name, jobId: job.id }));
  worker.on("completed", (job) => log.info("job completed", { worker: name, jobId: job.id }));
  worker.on("stalled", (jobId) => log.warn("job stalled", { worker: name, jobId }));
  worker.on("error", (error) => log.error("worker error", { worker: name, error }));
  worker.on("ioredis:close", () => log.warn("worker redis connection closed", { worker: name }));
};

attachWorkerLogging(emailWorker, "email");
attachWorkerLogging(icpWorker, "icp");

emailWorker.on("failed", (job, err) => {
  log.error("email job failed", {
    jobId: job?.id,
    to: job?.data?.to,
    attempt: job?.attemptsMade,
    willRetry: job ? job.attemptsMade < (job.opts?.attempts ?? 1) : false,
    error: err,
  });
});

icpWorker.on("failed", async (job, err) => {
  if (!job) {
    log.error("icp job failed with no job context", { error: err });
    return;
  }
  log.error("icp job failed", {
    jobId: job.id,
    workspaceId: job.data?.workspaceId,
    domain: job.data?.domain,
    attempt: job.attemptsMade,
    error: err,
  });

  await patchJob(job.data?.workspaceId, {
    status: "failed",
    stage: null,
    error: (err?.message || "The analysis failed.").slice(0, 500),
    finishedAt: new Date(),
  });
});

/* ------------------------------------------------------------------ *
 * Shutdown & process-level safety nets
 * ------------------------------------------------------------------ */
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutdown started — letting in-flight jobs finish", { signal });

  const force = setTimeout(() => {
    log.error("graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30_000);
  force.unref();

  try {
    await Promise.allSettled([emailWorker.close(), icpWorker.close()]);
    log.info("workers closed");
    await mongoose.connection.close(false);
    await closeRedis();
    clearTimeout(force);
    log.info("shutdown complete");
    process.exit(0);
  } catch (error) {
    log.error("error during shutdown", { error });
    process.exit(1);
  }
};

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

log.info("background workers initialised and listening for jobs", {
  queues: [EMAIL_QUEUE_NAME, ICP_QUEUE_NAME],
  prefix: QUEUE_PREFIX,
});
