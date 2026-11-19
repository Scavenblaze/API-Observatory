
import { prisma } from "@/lib/db";
import { monitorQueue } from "./monitor.queue";
import { scheduleMonitor } from "./monitor.scheduler";

const SCHEDULER_PREFIX = "monitor:";

export async function reconcileMonitorSchedules() {
  console.log("Starting monitor scheduler reconciliation...");

  // PostgreSQL is the source of truth.
  const enabledMonitors = await prisma.monitor.findMany({
    where: {
      enabled: true,
    },
    select: {
      id: true,
      intervalSeconds: true,
    },
  });

  // Retrieve all existing BullMQ schedulers.
  const existingSchedulers = await monitorQueue.getJobSchedulers(
    0,
    -1,
    true
  );

  const expectedSchedulerIds = new Set(
    enabledMonitors.map(
      (monitor) => `${SCHEDULER_PREFIX}${monitor.id}`
    )
  );

  let removedCount = 0;
  let scheduledCount = 0;

  // Remove schedulers that don't correspond to enabled monitors.
  for (const scheduler of existingSchedulers) {
    if (
      scheduler.key.startsWith(SCHEDULER_PREFIX) &&
      !expectedSchedulerIds.has(scheduler.key)
    ) {
      await monitorQueue.removeJobScheduler(scheduler.key);
      removedCount++;
    }
  }

  // Create missing schedules and update existing ones.
  for (const monitor of enabledMonitors) {
    await scheduleMonitor(
      monitor.id,
      monitor.intervalSeconds
    );

    scheduledCount++;
  }

  console.log("Monitor scheduler reconciliation completed.", {
    enabledMonitors: enabledMonitors.length,
    scheduledCount,
    removedCount,
  });

  return {
    enabledMonitors: enabledMonitors.length,
    scheduledCount,
    removedCount,
  };
}
