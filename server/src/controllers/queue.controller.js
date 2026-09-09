import { emailQueue } from "../utils/emailQueue.js";
import { icpQueue } from "../utils/icpQueue.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("queue.controller");

// Entries are null when REDIS_URL is unset — see utils/redis.js.
const QUEUES = {
  email: emailQueue,
  icp: icpQueue,
};

const STATES = ["waiting", "active", "completed", "failed", "delayed", "paused"];

const getQueue = (name) => QUEUES[name] ?? null;

/**
 * Every handler here talks to Redis. If Redis isn't configured, answer 503 up
 * front rather than letting BullMQ sit on an unreachable connection until the
 * load balancer gives up with a 504.
 */
const requireRedis = (req, res) => {
  if (process.env.REDIS_URL) return true;
  log.error("queue admin route hit with no REDIS_URL configured", {
    requestId: req.id,
    path: req.originalUrl,
  });
  res.status(503).json({ error: "Queue backend is not configured (REDIS_URL missing)" });
  return false;
};

/** Long email bodies get trimmed for the admin list view. */
const trimJobData = (queueName, data) => {
  if (queueName === "email" && data && typeof data.html === "string" && data.html.length > 300) {
    return { ...data, html: `${data.html.slice(0, 300)}…`, htmlTruncated: true };
  }
  return data ?? null;
};

const formatJob = async (queueName, job) => ({
  id: job.id,
  name: job.name,
  data: trimJobData(queueName, job.data),
  state: await job.getState(),
  progress: job.progress ?? null,
  attemptsMade: job.attemptsMade,
  failedReason: job.failedReason ?? null,
  timestamp: job.timestamp ?? null,
  processedOn: job.processedOn ?? null,
  finishedOn: job.finishedOn ?? null,
});

/** Overview: counts per queue, no job payloads. */
export const listQueues = async (req, res) => {
  if (!requireRedis(req, res)) return;
  try {
    const queues = await Promise.all(
      Object.entries(QUEUES).map(async ([name, queue]) => {
        if (!queue) return { name, counts: null, available: false };
        try {
          return { name, counts: await queue.getJobCounts(...STATES), available: true };
        } catch (error) {
          // One broken queue shouldn't blank the whole admin view.
          log.error("failed to read job counts", { requestId: req.id, queue: name, error });
          return { name, counts: null, available: false, error: error.message };
        }
      }),
    );
    log.info("queues summarised", { requestId: req.id, queues: queues.map((q) => q.name) });
    res.status(200).json({ queues });
  } catch (error) {
    log.error("failed to summarise queues", { requestId: req.id, error });
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Job list for one queue, optionally filtered to a single status. */
export const listQueueJobs = async (req, res) => {
  if (!requireRedis(req, res)) return;
  try {
    const { queueName } = req.params;
    if (!(queueName in QUEUES)) return res.status(404).json({ error: "Unknown queue" });
    const queue = getQueue(queueName);
    if (!queue) return res.status(503).json({ error: "Queue backend is unavailable" });

    const status = STATES.includes(req.query.status) ? req.query.status : null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const states = status ? [status] : STATES;

    const [jobs, counts] = await Promise.all([
      queue.getJobs(states, 0, Math.max(limit - 1, 0)),
      queue.getJobCounts(...STATES),
    ]);

    const formattedJobs = await Promise.all(jobs.map((job) => formatJob(queueName, job)));
    // Most recent first.
    formattedJobs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    log.info("queue jobs listed", {
      requestId: req.id,
      queue: queueName,
      status,
      returned: formattedJobs.length,
    });
    res.status(200).json({ queue: queueName, counts, jobs: formattedJobs });
  } catch (error) {
    log.error("failed to fetch queue jobs", { requestId: req.id, queue: req.params?.queueName, error });
    res.status(500).json({ success: false, error: error.message });
  }
};

export const retryQueueJob = async (req, res) => {
  if (!requireRedis(req, res)) return;
  try {
    const { queueName, jobId } = req.params;
    if (!(queueName in QUEUES)) return res.status(404).json({ error: "Unknown queue" });
    const queue = getQueue(queueName);
    if (!queue) return res.status(503).json({ error: "Queue backend is unavailable" });

    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await job.retry();
    log.info("job queued for retry", { requestId: req.id, queue: queueName, jobId });
    res.status(200).json({ message: "Job queued for retry" });
  } catch (error) {
    log.error("failed to retry job", {
      requestId: req.id,
      queue: req.params?.queueName,
      jobId: req.params?.jobId,
      error,
    });
    res.status(500).json({ error: error.message });
  }
};

export const removeQueueJob = async (req, res) => {
  if (!requireRedis(req, res)) return;
  try {
    const { queueName, jobId } = req.params;
    if (!(queueName in QUEUES)) return res.status(404).json({ error: "Unknown queue" });
    const queue = getQueue(queueName);
    if (!queue) return res.status(503).json({ error: "Queue backend is unavailable" });

    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await job.remove();
    log.info("job removed", { requestId: req.id, queue: queueName, jobId });
    res.status(200).json({ message: "Job removed" });
  } catch (error) {
    log.error("failed to remove job", {
      requestId: req.id,
      queue: req.params?.queueName,
      jobId: req.params?.jobId,
      error,
    });
    res.status(500).json({ error: error.message });
  }
};
