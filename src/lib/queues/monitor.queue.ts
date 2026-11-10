import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const MONITOR_QUEUE_NAME = "monitor-checks";

export interface MonitorCheckJob{
  monitorId: string;
}

export const monitorQueue = new Queue<MonitorCheckJob>(
  MONITOR_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: {
        age: 3600,
        count: 1000
      },
      removeOnFail: {
        age: 86400
      },
    }
  }
);