import { Router } from "express";
import authenticate from "../middlewares/auth.middleware.js";
import requireAdmin from "../middlewares/admin.middleware.js";
import {
  listQueueJobs,
  listQueues,
  removeQueueJob,
  retryQueueJob,
} from "../controllers/queue.controller.js";

const queueRoutes = Router();

queueRoutes.get("/", authenticate, requireAdmin, listQueues);
queueRoutes.get("/:queueName/jobs", authenticate, requireAdmin, listQueueJobs);
queueRoutes.post("/:queueName/jobs/:jobId/retry", authenticate, requireAdmin, retryQueueJob);
queueRoutes.delete("/:queueName/jobs/:jobId", authenticate, requireAdmin, removeQueueJob);

export default queueRoutes;
