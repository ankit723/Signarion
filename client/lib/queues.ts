/**
 * Admin-only queue monitor. Talks to server/src/routes/queue.routes.js, which
 * is gated by `authenticate` + `requireAdmin` (see admin.middleware.js).
 */
import api, { apiError } from "@/lib/api";
import type { JobState, QueueCounts, QueueJob, QueueName, QueueSummary } from "@/types/queue";

export const queueApi = {
  async listQueues(): Promise<QueueSummary[]> {
    try {
      const { data } = await api.get<{ queues: QueueSummary[] }>("/admin/queues");
      return data.queues;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async listJobs(
    queueName: QueueName,
    status?: JobState
  ): Promise<{ counts: QueueCounts; jobs: QueueJob[] }> {
    try {
      const { data } = await api.get<{ counts: QueueCounts; jobs: QueueJob[] }>(
        `/admin/queues/${queueName}/jobs`,
        { params: status ? { status } : undefined }
      );
      return { counts: data.counts, jobs: data.jobs };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    try {
      await api.post(`/admin/queues/${queueName}/jobs/${encodeURIComponent(jobId)}/retry`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    try {
      await api.delete(`/admin/queues/${queueName}/jobs/${encodeURIComponent(jobId)}`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },
};
