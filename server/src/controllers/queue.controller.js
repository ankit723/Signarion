import emailQueue from "../utils/emailQueue.js";
import { icpQueue } from "../utils/icpQueue.js";

const QUEUES = {
  email: emailQueue,
  icp: icpQueue,
};

const STATES = ["waiting", "active", "completed", "failed", "delayed", "paused"];

const getQueue = (name) => QUEUES[name] ?? null;

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
  try {
    const queues = await Promise.all(
      Object.entries(QUEUES).map(async ([name, queue]) => ({
        name,
        counts: await queue.getJobCounts(...STATES),
      })),
    );
    res.status(200).json({ queues });
  } catch (error) {
    console.error("Failed to summarize queues:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Job list for one queue, optionally filtered to a single status. */
export const listQueueJobs = async (req, res) => {
  try {
    const { queueName } = req.params;
    const queue = getQueue(queueName);
    if (!queue) return res.status(404).json({ error: "Unknown queue" });

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

    res.status(200).json({ queue: queueName, counts, jobs: formattedJobs });
  } catch (error) {
    console.error("Failed to fetch queue jobs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const retryQueueJob = async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const queue = getQueue(queueName);
    if (!queue) return res.status(404).json({ error: "Unknown queue" });

    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await job.retry();
    res.status(200).json({ message: "Job queued for retry" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const removeQueueJob = async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const queue = getQueue(queueName);
    if (!queue) return res.status(404).json({ error: "Unknown queue" });

    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await job.remove();
    res.status(200).json({ message: "Job removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
