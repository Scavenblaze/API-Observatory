import type {
  CreateMonitorInput,
  UpdateMonitorInput,
} from "@/lib/validators/monitor.schema";

import { prisma } from "@/lib/db";
import {
  removeMonitorSchedule,
  scheduleMonitor,
} from "../queues/monitor.scheduler";

export const MONITOR_QUOTAS = {
  MAX_TOTAL_MONITORS: 50,
  MAX_ENABLED_MONITORS: 20,
} as const;

export class MonitorQuotaExceededError extends Error {
  constructor(
    public readonly quota: "TOTAL" | "ENABLED"
  ) {
    const message =
      quota === "TOTAL"
        ? `You can create a maximum of ${MONITOR_QUOTAS.MAX_TOTAL_MONITORS} monitors.`
        : `You can have a maximum of ${MONITOR_QUOTAS.MAX_ENABLED_MONITORS} enabled monitors.`;

    super(message);
    this.name = "MonitorQuotaExceededError";
  }
}

type CreateMonitorServiceInput = CreateMonitorInput & {
  userId: string;
};

export async function createMonitor(
  input: CreateMonitorServiceInput
) {
  const monitor = await prisma.$transaction(async (tx) => {
    // Serialize quota-changing operations for this user.
    await tx.$queryRaw`
      SELECT
        pg_advisory_xact_lock(
          hashtextextended(${input.userId}, 0)
        )::text AS lock
    `;

    const totalCount = await tx.monitor.count({
      where: {
        userId: input.userId,
      },
    });

    if (totalCount >= MONITOR_QUOTAS.MAX_TOTAL_MONITORS) {
      throw new MonitorQuotaExceededError("TOTAL");
    }

    if (input.enabled) {
      const enabledCount = await tx.monitor.count({
        where: {
          userId: input.userId,
          enabled: true,
        },
      });

      if (
        enabledCount >= MONITOR_QUOTAS.MAX_ENABLED_MONITORS
      ) {
        throw new MonitorQuotaExceededError("ENABLED");
      }
    }

    return tx.monitor.create({
      data: {
        name: input.name,
        url: input.url,
        method: input.method,
        intervalSeconds: input.intervalSeconds,
        timeoutMs: input.timeoutMs,
        expectedStatus: input.expectedStatus,
        latencyThresholdMs: input.latencyThresholdMs,
        enabled: input.enabled,
        userId: input.userId,
      },
    });
  });

  // Schedule only after the database transaction commits.
  if (monitor.enabled) {
    await scheduleMonitor(
      monitor.id,
      monitor.intervalSeconds
    );
  }

  return monitor;
}

export async function listMonitors(userId: string) {
  return prisma.monitor.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getMonitorById(
  id: string,
  userId: string
) {
  return prisma.monitor.findFirst({
    where: {
      id,
      userId,
    },
  });
}

export async function updateMonitor(
  id: string,
  userId: string,
  data: UpdateMonitorInput
) {
  const monitor = await prisma.$transaction(async (tx) => {
    // Serialize quota-changing operations for this user.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${userId}, 0)
      )
    `;

    const existingMonitor = await tx.monitor.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingMonitor) {
      return null;
    }

    // Check the enabled quota only when enabling a disabled monitor.
    if (data.enabled === true && !existingMonitor.enabled) {
      const enabledCount = await tx.monitor.count({
        where: {
          userId,
          enabled: true,
        },
      });

      if (
        enabledCount >= MONITOR_QUOTAS.MAX_ENABLED_MONITORS
      ) {
        throw new MonitorQuotaExceededError("ENABLED");
      }
    }

    await tx.monitor.updateMany({
      where: {
        id,
        userId,
      },
      data,
    });

    return tx.monitor.findFirst({
      where: {
        id,
        userId,
      },
    });
  });

  if (!monitor) {
    return null;
  }

  // Synchronize the scheduler after the database transaction commits.
  if (monitor.enabled) {
    await scheduleMonitor(
      monitor.id,
      monitor.intervalSeconds
    );
  } else {
    await removeMonitorSchedule(monitor.id);
  }

  return monitor;
}

export async function deleteMonitor(
  id: string,
  userId: string
) {
  const result = await prisma.monitor.deleteMany({
    where: {
      id,
      userId,
    },
  });

  if (result.count === 0) {
    return false;
  }

  await removeMonitorSchedule(id);

  return true;
}
