/** Mirrors server/src/controllers/queue.controller.js. */

export type QueueName = "email" | "icp";

export type JobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused"
  | "unknown";

export type QueueCounts = Partial<Record<JobState, number>>;

export interface QueueSummary {
  name: QueueName;
  counts: QueueCounts;
}

export interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
  state: JobState;
  progress: unknown;
  attemptsMade: number;
  failedReason: string | null;
  timestamp: number | null;
  processedOn: number | null;
  finishedOn: number | null;
}
