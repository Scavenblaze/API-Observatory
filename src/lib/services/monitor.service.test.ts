import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMonitor, listMonitors, getMonitorById, updateMonitor, deleteMonitor } from "./monitor.service";

const mocks = vi.hoisted(() => ({
  monitorCreate: vi.fn(),
  monitorFindMany: vi.fn(),
  monitorFindUnique: vi.fn(),
  monitorUpdate: vi.fn(),
  monitorDelete: vi.fn(),
  scheduleMonitor: vi.fn(),
  removeMonitorSchedule: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    monitor: {
      create: mocks.monitorCreate,
      findMany: mocks.monitorFindMany,
      findUnique: mocks.monitorFindUnique,
      update: mocks.monitorUpdate,
      delete: mocks.monitorDelete
    }
  }
}));

vi.mock("../queues/monitor.scheduler", () => ({
  scheduleMonitor: mocks.scheduleMonitor,
  removeMonitorSchedule: mocks.removeMonitorSchedule
}));


const monitorInput = {
  name: "Production API",
  url: "https://example.com",
  method: "GET" as const,
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true
};

const monitor = {
  id: "monitor-123",
  ...monitorInput
};

describe("Monitor Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.scheduleMonitor.mockResolvedValue(undefined);
    mocks.removeMonitorSchedule.mockResolvedValue(undefined);
  });

  describe("createMonitor", () => {
    it("creates an enabled monitor and schedules recurring checks", async () => {
      mocks.monitorCreate.mockResolvedValue(monitor);

      const result = await createMonitor(monitorInput);

      expect(result).toEqual(monitor);

      expect(mocks.monitorCreate).toHaveBeenCalledWith({
        data: monitorInput
      });

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(monitor.id, monitor.intervalSeconds);

      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });

    it("does not schedule checks for a disabled monitor", async () => {
      const disabledMonitor = {
        ...monitor,
        enabled: false
      };

      mocks.monitorCreate.mockResolvedValue(disabledMonitor);

      const result = await createMonitor({
        ...monitorInput,
        enabled: false
      });

      expect(result.enabled).toBe(false);
      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });
  });

  describe("listMonitors", () => {
    it("returns monitors ordered by creation date", async () => {
      mocks.monitorFindMany.mockResolvedValue([monitor]);

      const result = await listMonitors();

      expect(result).toEqual([monitor]);

      expect(mocks.monitorFindMany).toHaveBeenCalledWith({
        orderBy: {
          createdAt: "desc"
        }
      });
    });
  });

  describe("getMonitorById", () => {
    it("retrieves a monitor by its ID", async () => {
      mocks.monitorFindUnique.mockResolvedValue(monitor);

      const result = await getMonitorById(monitor.id);

      expect(result).toEqual(monitor);

      expect(mocks.monitorFindUnique).toHaveBeenCalledWith({
        where: {
          id: monitor.id
        }
      });
    });
  });

  describe("updateMonitor", () => {
    it("updates an enabled monitor and schedules its checks", async () => {
      const updatedMonitor = {
        ...monitor,
        intervalSeconds: 120
      };

      mocks.monitorUpdate.mockResolvedValue(updatedMonitor);

      const result = await updateMonitor(monitor.id, {
        intervalSeconds: 120
      });

      expect(result).toEqual(updatedMonitor);

      expect(mocks.monitorUpdate).toHaveBeenCalledWith({
        where: { id: monitor.id },
        data: { intervalSeconds: 120 }
      });

      expect(mocks.scheduleMonitor).toHaveBeenCalledWith(monitor.id, 120);

      expect(mocks.removeMonitorSchedule).not.toHaveBeenCalled();
    });

    it("removes the schedule when a monitor is disabled", async () => {
      const disabledMonitor = {
        ...monitor,
        enabled: false
      };

      mocks.monitorUpdate.mockResolvedValue(disabledMonitor);

      const result = await updateMonitor(monitor.id, {
        enabled: false
      });

      expect(result.enabled).toBe(false);

      expect(mocks.removeMonitorSchedule).toHaveBeenCalledWith(monitor.id);

      expect(mocks.scheduleMonitor).not.toHaveBeenCalled();
    });
  });

  describe("deleteMonitor", () => {
    it("deletes a monitor and removes its schedule", async () => {
      mocks.monitorDelete.mockResolvedValue(monitor);

      const result = await deleteMonitor(monitor.id);

      expect(result).toEqual(monitor);

      expect(mocks.monitorDelete).toHaveBeenCalledWith({
        where: {
          id: monitor.id
        },
      });

      expect(mocks.removeMonitorSchedule).toHaveBeenCalledWith(monitor.id);
    });
  });
});
