
import IORedis from "ioredis";
import { Worker, UnrecoverableError } from "bullmq";

import { MONITOR_QUEUE_NAME } from "../src/lib/queues/monitor.queue";
import { runHealthCheck } from "../src/lib/services/health-check.service";
import { removeMonitorSchedule } from "../src/lib/queues/monitor.scheduler";
import { closeMonitorQueue } from "../src/lib/queues/monitor.queue";
import { reconcileMonitorSchedules } from "../src/lib/queues/monitor.reconciliation";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured");
}

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export const monitorWorker = new Worker(
  MONITOR_QUEUE_NAME,
  async (job) => {
    const { monitorId } = job.data;

    if (!monitorId) {
      throw new UnrecoverableError("Missing monitorId in job data");
    }

    try {
      const result = await runHealthCheck(monitorId);

      if (!result) {
        console.warn(
          `Monitor ${monitorId} no longer exists. Removing stale scheduler.`
        );

        await removeMonitorSchedule(monitorId);

        return;
      }

      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "MONITOR_DISABLED"
      ) {
        await removeMonitorSchedule(monitorId);

        throw new UnrecoverableError("Monitor is disabled");
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    autorun: false,
  }
);

monitorWorker.on("completed", (job) => {
  console.log(`Health check completed: ${job.id}`);
});

monitorWorker.on("failed", (job, error) => {
  console.error(`Health check job ${job?.id} failed:`, error.message);
});

monitorWorker.on("error", (error) => {
  console.error("Monitor worker error:", error);
});

export async function startMonitorWorker() {
  // Repair schedules before allowing jobs to execute.
  await reconcileMonitorSchedules();

  console.log("Starting monitor job processing...");

  await monitorWorker.run();
}

export async function closeMonitorWorker() {
  await monitorWorker.close();
  await closeMonitorQueue();
  await connection.quit();
}
