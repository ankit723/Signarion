import { Queue } from "bullmq";
import { createQueueConnection, QUEUE_PREFIX } from "./redis.js";
import { createLogger, throttle } from "./logger.js";
import { EMAIL_QUEUE_NAME } from "./queueNames.js";

const log = createLogger("emailQueue");

export { EMAIL_QUEUE_NAME };

/** BullMQ re-emits the connection error on every retry — throttle it. */
const logQueueError = (() => {
  const emit = throttle((message, meta) => log.error(message, meta));
  return (err) => emit("queue error", { error: err?.message, detail: err });
})();

const connection = createQueueConnection("emailQueue");

/**
 * `null` when REDIS_URL is missing. Guard with `isEmailQueueAvailable()` rather
 * than letting BullMQ silently fall back to localhost:6379 — in ECS that means
 * a connection that can never succeed and a request that never answers.
 */
export const emailQueue = connection
  ? new Queue(EMAIL_QUEUE_NAME, {
      connection,
      prefix: QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : null;

if (emailQueue) {
  emailQueue.on("error", logQueueError);
  log.info("email queue initialised", { queue: EMAIL_QUEUE_NAME, prefix: QUEUE_PREFIX });
} else {
  log.error("email queue disabled — REDIS_URL is not set");
}

export const isEmailQueueAvailable = () => Boolean(emailQueue);

/**
 * Enqueues an email. Returns `{ ok, jobId, error }` instead of throwing so a
 * Redis problem can't turn "account created" into a 500 for the user.
 */
export const enqueueEmail = async ({ to, subject, html }, context = {}) => {
  if (!emailQueue) {
    log.error("cannot enqueue email — queue unavailable", { to, subject, ...context });
    return { ok: false, error: "Email queue unavailable" };
  }

  try {
    const startedAt = Date.now();
    const job = await emailQueue.add("sendEmail", { to, subject, html });
    log.info("email enqueued", {
      jobId: job.id,
      to,
      subject,
      durationMs: Date.now() - startedAt,
      ...context,
    });
    return { ok: true, jobId: job.id };
  } catch (error) {
    log.error("failed to enqueue email", { to, subject, error, ...context });
    return { ok: false, error: error?.message ?? "Unknown error" };
  }
};
