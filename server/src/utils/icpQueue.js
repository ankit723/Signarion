import { Queue } from "bullmq";
import { createQueueConnection, QUEUE_PREFIX } from "./redis.js";
import { createLogger, throttle } from "./logger.js";
import { ICP_QUEUE_NAME } from "./queueNames.js";

const log = createLogger("icpQueue");

export { ICP_QUEUE_NAME };

/** BullMQ re-emits the connection error on every retry — throttle it. */
const logQueueError = (() => {
  const emit = throttle((message, meta) => log.error(message, meta));
  return (err) => emit("queue error", { error: err?.message, detail: err });
})();

const connection = createQueueConnection("icpQueue");

/** `null` when REDIS_URL is missing — see the note in emailQueue.js. */
export const icpQueue = connection
  ? new Queue(ICP_QUEUE_NAME, { connection, prefix: QUEUE_PREFIX })
  : null;

if (icpQueue) {
  icpQueue.on("error", logQueueError);
  log.info("icp queue initialised", { queue: ICP_QUEUE_NAME, prefix: QUEUE_PREFIX });
} else {
  log.error("icp queue disabled — REDIS_URL is not set");
}

export const isIcpQueueAvailable = () => Boolean(icpQueue);

export async function enqueueIcpJob(workspaceId, domain) {
  if (!icpQueue) {
    log.error("cannot enqueue ICP job — queue unavailable", { workspaceId, domain });
    throw new Error("ICP queue unavailable (REDIS_URL is not set)");
  }

  try {
    const startedAt = Date.now();
    const job = await icpQueue.add(
      "analyze",
      { workspaceId: String(workspaceId), domain },
      {
        jobId: String(workspaceId),
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 1,
      },
    );
    log.info("ICP job enqueued", {
      jobId: job.id,
      workspaceId: String(workspaceId),
      domain,
      durationMs: Date.now() - startedAt,
    });
    return job;
  } catch (error) {
    log.error("failed to enqueue ICP job", { workspaceId: String(workspaceId), domain, error });
    throw error;
  }
}

/** Removes a job without ever throwing — callers only care that it's gone. */
export async function removeIcpJob(workspaceId) {
  if (!icpQueue) return false;
  try {
    await icpQueue.remove(String(workspaceId));
    log.info("ICP job removed", { workspaceId: String(workspaceId) });
    return true;
  } catch (error) {
    log.warn("failed to remove ICP job", { workspaceId: String(workspaceId), error: error?.message });
    return false;
  }
}
