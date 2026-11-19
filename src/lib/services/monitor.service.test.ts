
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMonitor,
  listMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  MonitorQuotaExceededError,
  MONITOR_QUOTAS,
} from "./monitor.service";

const mocks = vi.hoisted(() => ({
  monitorCreate: vi.fn(),
  monitorFindMany: vi.fn(),
  monitorFindFirst: vi.fn(),
  monitorCount: vi.fn(),
  monitorUpdateMany: vi.fn(),
  monitorDeleteMany: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  scheduleMonitor: vi.fn(),
  removeMonitorSchedule: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    monitor: {
      findMany: mocks.monitorFindMany,
      findFirst: mocks.monitorFindFirst,
      deleteMany: mocks.monitorDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("../queues/monitor.scheduler", () => ({
  scheduleMonitor: mocks.scheduleMonitor,
  removeMonitorSchedule: mocks.removeMonitorSchedule,
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const monitorInput = {
  name: "Production API",
  url: "https://example.com",
  method: "GET" as const,
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true,
  userId: TEST_USER_ID,
};

const monitor = {
  id: "monitor-123",
  ...monitorInput,
};

const tx = {
  $queryRaw: mocks.queryRaw,
  monitor: {
    create: mocks.monitorCreate,
    findFirst: mocks.monitorFindFirst,
    count: mocks.monitorCount,
    updateMany: mocks.monitorUpdateMany,
  },
};

describe("Monitor Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (transactionClient: typeof tx) => unknown) =>
        callback(tx)
    );

    mocks.queryRaw.mockResolvedValue([]);
    mocks.scheduleMonitor.mockResolvedValue(undefined);
    mocks.removeMonitorSchedule.mockResolvedValue(undefined);
  });

  describe("createMonitor", () => {
    it("creates an enabled monitor and schedules recurring checks", async () => {
      mocks.monitorCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mocks.monitorCreate.mockResolvedValue(monitor);

      const result = await createMonitor(monitorInput);

      expect(result).toEqual(monitor);
      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(mocks.queryRaw).toHaveBeenCalledOnce();

      expect(mocks.monitorCount).toHaveBeenNthCalledWith(1, {
        where: {
          userId: TEST_USER_ID,
        },
      });

      expect(mocks.monitorCount).toHaveBeenNthCalledWith(2, {
        where: {
          userId: TEST_USER_ID,
          enabled: true,
        },
      });

      expect(mocks.monitorCreate).toHaveBeenCalledWith({
        data: monitorInput,
      });

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(
        monitor.id,
        monitor.intervalSeconds
      );

      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });

    it("creates a disabled monitor without checking enabled quota or scheduling it", async () => {
      const disabledInput = {
        ...monitorInput,
        enabled: false,
      };

      const disabledMonitor = {
        ...monitor,
        enabled: false,
      };

      mocks.monitorCount.mockResolvedValueOnce(0);
      mocks.monitorCreate.mockResolvedValue(disabledMonitor);

      const result = await createMonitor(disabledInput);

      expect(result).toEqual(disabledMonitor);
      expect(mocks.monitorCount).toHaveBeenCalledOnce();

      expect(mocks.monitorCount).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
        },
      });

      expect(mocks.monitorCreate).toHaveBeenCalledWith({
        data: disabledInput,
      });

      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });

    it("rejects creation when the total monitor quota is reached", async () => {
      mocks.monitorCount.mockResolvedValueOnce(
        MONITOR_QUOTAS.MAX_TOTAL_MONITORS
      );

      await expect(
        createMonitor(monitorInput)
      ).rejects.toMatchObject({
        name: "MonitorQuotaExceededError",
        quota: "TOTAL",
      });

      expect(mocks.monitorCreate).not.toHaveBeenCalled();
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });

    it("rejects creation when the enabled monitor quota is reached", async () => {
      mocks.monitorCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(
          MONITOR_QUOTAS.MAX_ENABLED_MONITORS
        );

      await expect(
        createMonitor(monitorInput)
      ).rejects.toMatchObject({
        name: "MonitorQuotaExceededError",
        quota: "ENABLED",
      });

      expect(mocks.monitorCreate).not.toHaveBeenCalled();
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });

    it("allows disabled monitor creation when enabled quota is reached", async () => {
      const disabledInput = {
        ...monitorInput,
        enabled: false,
      };

      const disabledMonitor = {
        ...monitor,
        enabled: false,
      };

      mocks.monitorCount.mockResolvedValueOnce(
        MONITOR_QUOTAS.MAX_ENABLED_MONITORS
      );

      mocks.monitorCreate.mockResolvedValue(disabledMonitor);

      const result = await createMonitor(disabledInput);

      expect(result).toEqual(disabledMonitor);
      expect(mocks.monitorCreate).toHaveBeenCalledOnce();
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });

    it("exports the expected quota limits", () => {
      expect(MONITOR_QUOTAS).toEqual({
        MAX_TOTAL_MONITORS: 50,
        MAX_ENABLED_MONITORS: 20,
      });
    });
  });

  describe("listMonitors", () => {
    it("returns monitors ordered by creation date", async () => {
      mocks.monitorFindMany.mockResolvedValue([monitor]);

      const result = await listMonitors(TEST_USER_ID);

      expect(result).toEqual([monitor]);

      expect(mocks.monitorFindMany).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });
  });

  describe("getMonitorById", () => {
    it("retrieves a monitor belonging to the user", async () => {
      mocks.monitorFindFirst.mockResolvedValue(monitor);

      const result = await getMonitorById(
        monitor.id,
        TEST_USER_ID
      );

      expect(result).toEqual(monitor);

      expect(mocks.monitorFindFirst).toHaveBeenCalledWith({
        where: {
          id: monitor.id,
          userId: TEST_USER_ID,
        },
      });
    });

    it("returns null when the monitor does not belong to the user", async () => {
      mocks.monitorFindFirst.mockResolvedValue(null);

      const result = await getMonitorById(
        monitor.id,
        TEST_USER_ID
      );

      expect(result).toBeNull();
    });
  });

  describe("updateMonitor", () => {
    it("updates only supplied fields and schedules the updated monitor", async () => {
      const updateData = {
        intervalSeconds: 120,
      };

      const updatedMonitor = {
        ...monitor,
        intervalSeconds: 120,
      };

      mocks.monitorFindFirst
        .mockResolvedValueOnce(monitor)
        .mockResolvedValueOnce(updatedMonitor);

      mocks.monitorUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await updateMonitor(
        monitor.id,
        TEST_USER_ID,
        updateData
      );

      expect(result).toEqual(updatedMonitor);
      expect(mocks.queryRaw).toHaveBeenCalledOnce();

      expect(mocks.monitorFindFirst).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            id: monitor.id,
            userId: TEST_USER_ID,
          },
        }
      );

      expect(mocks.monitorUpdateMany).toHaveBeenCalledWith({
        where: {
          id: monitor.id,
          userId: TEST_USER_ID,
        },
        data: updateData,
      });

      expect(mocks.monitorFindFirst).toHaveBeenNthCalledWith(
        2,
        {
          where: {
            id: monitor.id,
            userId: TEST_USER_ID,
          },
        }
      );

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(
        monitor.id,
        120
      );

      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });

    it("does not overwrite omitted fields during a partial update", async () => {
      const updateData = {
        name: "Updated API",
      };

      const updatedMonitor = {
        ...monitor,
        name: "Updated API",
      };

      mocks.monitorFindFirst
        .mockResolvedValueOnce(monitor)
        .mockResolvedValueOnce(updatedMonitor);

      mocks.monitorUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await updateMonitor(
        monitor.id,
        TEST_USER_ID,
        updateData
      );

      expect(result).toEqual(updatedMonitor);

      expect(mocks.monitorUpdateMany).toHaveBeenCalledWith({
        where: {
          id: monitor.id,
          userId: TEST_USER_ID,
        },
        data: {
          name: "Updated API",
        },
      });

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(
        monitor.id,
        monitor.intervalSeconds
      );
    });

    it("does not check enabled quota when updating an already enabled monitor", async () => {
      const updatedMonitor = {
        ...monitor,
        name: "Updated API",
      };

      mocks.monitorFindFirst
        .mockResolvedValueOnce(monitor)
        .mockResolvedValueOnce(updatedMonitor);

      mocks.monitorUpdateMany.mockResolvedValue({
        count: 1,
      });

      await updateMonitor(monitor.id, TEST_USER_ID, {
        name: "Updated API",
      });

      expect(mocks.monitorCount).not.toHaveBeenCalled();
    });

    it("rejects enabling a monitor when enabled quota is reached", async () => {
      const disabledMonitor = {
        ...monitor,
        enabled: false,
      };

      mocks.monitorFindFirst.mockResolvedValueOnce(
        disabledMonitor
      );

      mocks.monitorCount.mockResolvedValueOnce(
        MONITOR_QUOTAS.MAX_ENABLED_MONITORS
      );

      await expect(
        updateMonitor(monitor.id, TEST_USER_ID, {
          enabled: true,
        })
      ).rejects.toMatchObject({
        name: "MonitorQuotaExceededError",
        quota: "ENABLED",
      });

      expect(mocks.monitorUpdateMany).not.toHaveBeenCalled();
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });

    it("enables a disabled monitor when enabled quota allows it", async () => {
      const disabledMonitor = {
        ...monitor,
        enabled: false,
      };

      const enabledMonitor = {
        ...monitor,
        enabled: true,
      };

      mocks.monitorFindFirst
        .mockResolvedValueOnce(disabledMonitor)
        .mockResolvedValueOnce(enabledMonitor);

      mocks.monitorCount.mockResolvedValueOnce(5);

      mocks.monitorUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await updateMonitor(
        monitor.id,
        TEST_USER_ID,
        {
          enabled: true,
        }
      );

      expect(result).toEqual(enabledMonitor);

      expect(mocks.monitorCount).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          enabled: true,
        },
      });

      expect(mocks.monitorUpdateMany).toHaveBeenCalledWith({
        where: {
          id: monitor.id,
          userId: TEST_USER_ID,
        },
        data: {
          enabled: true,
        },
      });

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(
        monitor.id,
        monitor.intervalSeconds
      );
    });

    it("removes the schedule when a monitor is disabled", async () => {
      const disabledMonitor = {
        ...monitor,
        enabled: false,
      };

      mocks.monitorFindFirst
        .mockResolvedValueOnce(monitor)
        .mockResolvedValueOnce(disabledMonitor);

      mocks.monitorUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await updateMonitor(
        monitor.id,
        TEST_USER_ID,
        {
          enabled: false,
        }
      );

      expect(result).toEqual(disabledMonitor);

      expect(mocks.removeMonitorSchedule).toHaveBeenCalledWith(
        monitor.id
      );

      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });

    it("returns null when the monitor does not belong to the user", async () => {
      mocks.monitorFindFirst.mockResolvedValueOnce(null);

      const result = await updateMonitor(
        monitor.id,
        TEST_USER_ID,
        {
          intervalSeconds: 120,
        }
      );

      expect(result).toBeNull();

      expect(mocks.monitorFindFirst).toHaveBeenCalledOnce();
      expect(mocks.monitorUpdateMany).not.toHaveBeenCalled();
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });
  });

  describe("deleteMonitor", () => {
    it("deletes a monitor and removes its schedule", async () => {
      mocks.monitorDeleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await deleteMonitor(
        monitor.id,
        TEST_USER_ID
      );

      expect(result).toBe(true);

      expect(mocks.monitorDeleteMany).toHaveBeenCalledWith({
        where: {
          id: monitor.id,
          userId: TEST_USER_ID,
        },
      });

      expect(mocks.removeMonitorSchedule).toHaveBeenCalledWith(
        monitor.id
      );
    });

    it("returns false when the monitor does not belong to the user", async () => {
      mocks.monitorDeleteMany.mockResolvedValue({
        count: 0,
      });

      const result = await deleteMonitor(
        monitor.id,
        TEST_USER_ID
      );

      expect(result).toBe(false);

      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });
  });

  describe("MonitorQuotaExceededError", () => {
    it("creates a total quota error with the correct message", () => {
      const error = new MonitorQuotaExceededError("TOTAL");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MonitorQuotaExceededError");
      expect(error.quota).toBe("TOTAL");
      expect(error.message).toContain(
        String(MONITOR_QUOTAS.MAX_TOTAL_MONITORS)
      );
    });

    it("creates an enabled quota error with the correct message", () => {
      const error = new MonitorQuotaExceededError("ENABLED");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MonitorQuotaExceededError");
      expect(error.quota).toBe("ENABLED");
      expect(error.message).toContain(
        String(MONITOR_QUOTAS.MAX_ENABLED_MONITORS)
      );
    });
  });
});
