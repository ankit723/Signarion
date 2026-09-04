/**
 * Background ICP generation. Kicked off by PUT /api/workspace/:id, this queue
 * runs the crawl + model on a BullMQ worker (in-process, same pattern as the
 * email queue) so it survives the client disconnecting or navigating away.
 *
 * The worker only ever writes to `workspace.icpJob` — it never touches the live
 * `workspace.icp`. The user reviews `icpJob.draft` and saves it via PATCH.
 */
import { Queue, Worker } from "bullmq";

import redis from "./redis.js";
import Workspace from "../models/workspace.model.js";
import { crawlEntireWebsite } from "./scraper.js";
import { generateICPFromScrapedData } from "./icpGenerator.js";

export const ICP_QUEUE_NAME = "icpQueue";

export const icpQueue = new Queue(ICP_QUEUE_NAME, { connection: redis });

/** Patch a subset of `workspace.icpJob` without disturbing the rest. */
const patchJob = (workspaceId, patch) =>
  Workspace.updateOne(
    { _id: workspaceId },
    { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`icpJob.${k}`, v])) }
  );

const worker = new Worker(
  ICP_QUEUE_NAME,
  async (job) => {
    const { workspaceId, domain } = job.data;

    await patchJob(workspaceId, { status: "running", stage: "Crawling the website", error: null });

    const crawl = await crawlEntireWebsite(`https://${domain}`, { maxPages: 25 });

    await patchJob(workspaceId, { stage: "Building the customer profile" });

    const icp = await generateICPFromScrapedData(crawl.aggregatedContent, domain);

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
  },
  { connection: redis, concurrency: 2 }
);

worker.on("failed", (job, err) => {
  if (!job) return;
  console.error(`[icpQueue] job ${job.id} failed:`, err?.message);
  void patchJob(job.data.workspaceId, {
    status: "failed",
    stage: null,
    error: (err?.message || "The analysis failed.").slice(0, 500),
    finishedAt: new Date(),
  });
});

worker.on("error", (err) => console.error("[icpQueue] worker error:", err?.message));

/**
 * Enqueue an analysis. `jobId` is the workspace id, so a second call while one
 * is still queued is a no-op; `removeOnComplete` frees the id for re-analysis.
 */
export function enqueueIcpJob(workspaceId, domain) {
  return icpQueue.add(
    "analyze",
    { workspaceId: String(workspaceId), domain },
    {
      jobId: String(workspaceId),
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 1,
    }
  );
}
