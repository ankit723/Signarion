/**
 * Queue names live here on their own so the worker can import them without
 * pulling in emailQueue.js / icpQueue.js — those construct BullMQ `Queue`
 * objects (and therefore extra Redis connections) that the worker process
 * has no use for.
 */
export const EMAIL_QUEUE_NAME = "emailQueue";
export const ICP_QUEUE_NAME = "icpQueue";
