import emailQueue from "../utils/emailQueue.js";

export const getEmailQueueDetails = async (req, res) => {
  try {
    const jobCounts = await emailQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    const jobs = await emailQueue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    ]);

    const formattedJobs = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        state: await job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      }))
    );

    return res.status(200).json({
      success: true,
      queue: "emailQueue",
      counts: jobCounts,
      jobs: formattedJobs,
    });
  } catch (error) {
    console.error("Failed to fetch queue details:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch queue details",
      error: error.message,
    });
  }
};