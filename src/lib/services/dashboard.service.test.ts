import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardOverview } from "@/lib/services/dashboard.service";

const { monitorFindMany, incidentCount, incidentFindMany } = vi.hoisted(
  () => ({
    monitorFindMany: vi.fn(),
    incidentCount: vi.fn(),
    incidentFindMany: vi.fn()
  })
);

vi.mock("@/lib/db", () => ({
  prisma: {
    monitor: {
      findMany: monitorFindMany
    },
    incident: {
      count: incidentCount,
      findMany: incidentFindMany
    }
  }
}));


describe("getDashboardOverview", () => {
  const checkedAt = new Date("2026-11-09T10:00:00.000Z");

  const recentIncidents = [
    {
      id: "incident-1",
      title: "API is unavailable",
      status: "OPEN",
      monitor: {
        id: "monitor-1",
        name: "Production API",
        url: "https://api.example.com"
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    monitorFindMany.mockResolvedValue([
      {
        id: "monitor-1",
        name: "Operational API",
        url: "https://operational.example.com",
        enabled: true,
        checks: [
          {
            success: true,
            statusCode: 200,
            latencyMs: 120,
            checkedAt
          }
        ]
      },
      {
        id: "monitor-2",
        name: "Failing API",
        url: "https://failing.example.com",
        enabled: true,
        checks: [
          {
            success: false,
            statusCode: 500,
            latencyMs: 300,
            checkedAt
          }
        ]
      },
      {
        id: "monitor-3",
        name: "Unchecked API",
        url: "https://unchecked.example.com",
        enabled: true,
        checks: []
      },
      {
        id: "monitor-4",
        name: "Disabled API",
        url: "https://disabled.example.com",
        enabled: false,
        checks: [
          {
            success: false,
            statusCode: 503,
            latencyMs: 500,
            checkedAt
          }
        ]
      }
    ]);

    incidentCount.mockResolvedValue(2);
    incidentFindMany.mockResolvedValue(recentIncidents);
  });

  it("calculates dashboard summary counts correctly", async () => {
    const result = await getDashboardOverview();

    expect(result.summary).toEqual({
      totalMonitors: 4,
      operational: 1,
      failing: 1,
      unchecked: 1,
      openIncidents: 2
    });
  });

  it("includes disabled monitors in total but excludes them from status counts", async () => {
    const result = await getDashboardOverview();

    expect(result.summary.totalMonitors).toBe(4);
    expect(result.summary.operational).toBe(1);
    expect(result.summary.failing).toBe(1);
    expect(result.summary.unchecked).toBe(1);
  });

  it("maps monitor data and latest checks into the response", async () => {
    const result = await getDashboardOverview();

    expect(result.monitors).toEqual([
      {
        id: "monitor-1",
        name: "Operational API",
        url: "https://operational.example.com",
        enabled: true,
        latestCheck: {
          success: true,
          statusCode: 200,
          latencyMs: 120,
          checkedAt
        }
      },
      {
        id: "monitor-2",
        name: "Failing API",
        url: "https://failing.example.com",
        enabled: true,
        latestCheck: {
          success: false,
          statusCode: 500,
          latencyMs: 300,
          checkedAt
        }
      },
      {
        id: "monitor-3",
        name: "Unchecked API",
        url: "https://unchecked.example.com",
        enabled: true,
        latestCheck: null
      },
      {
        id: "monitor-4",
        name: "Disabled API",
        url: "https://disabled.example.com",
        enabled: false,
        latestCheck: {
          success: false,
          statusCode: 503,
          latencyMs: 500,
          checkedAt
        }
      }
    ]);
  });

  it("returns recent incidents", async () => {
    const result = await getDashboardOverview();

    expect(result.recentIncidents).toEqual(recentIncidents);
  });

  it("queries only open incidents for the incident count", async () => {
    await getDashboardOverview();

    expect(incidentCount).toHaveBeenCalledWith({
      where: { status: "OPEN" }
    });
  });

  it("returns zero counts and empty arrays when there is no data", async () => {
    monitorFindMany.mockResolvedValue([]);
    incidentCount.mockResolvedValue(0);
    incidentFindMany.mockResolvedValue([]);

    const result = await getDashboardOverview();

    expect(result).toEqual({
      summary: {
        totalMonitors: 0,
        operational: 0,
        failing: 0,
        unchecked: 0,
        openIncidents: 0
      },
      monitors: [],
      recentIncidents: []
    });
  });

  it("propagates database errors", async () => {
    monitorFindMany.mockRejectedValue(new Error("Database connection failed"));

    await expect(getDashboardOverview()).rejects.toThrow("Database connection failed");
  });
});
