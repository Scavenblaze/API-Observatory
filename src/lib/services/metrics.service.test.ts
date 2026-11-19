import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMonitorMetrics } from "@/lib/services/metrics.service";

const { findUnique, queryRaw } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  queryRaw: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    monitor: {
      findUnique
    },
    $queryRaw: queryRaw
  }
}));



describe("getMonitorMetrics", () => {
  const monitorId = "monitor-123";

  const metrics = {
    totalChecks: 100,
    successfulChecks: 95,
    failedChecks: 5,
    availabilityPercentage: 95,
    averageLatencyMs: 320,
    p50LatencyMs: 300,
    p95LatencyMs: 450,
    p99LatencyMs: 490
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    findUnique.mockResolvedValue({ id: monitorId });
    queryRaw.mockResolvedValue([metrics]);
  });

  it("returns null when the monitor does not exist", async () => {
    findUnique.mockResolvedValue(null);

    const result = await getMonitorMetrics(monitorId);

    expect(result).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("uses 24h as the default period", async () => {
    const result = await getMonitorMetrics(monitorId);

    expect(result).toEqual({
      monitorId,
      period: "24h",
      ...metrics
    });
  });

  it.each([
    ["1h", 60 * 60 * 1000],
    ["24h", 24 * 60 * 60 * 1000],
    ["7d", 7 * 24 * 60 * 60 * 1000],
    ["30d", 30 * 24 * 60 * 60 * 1000]
  ] as const)(
    "calculates the correct cutoff for the %s period",
    async (period, durationMs) => {
      const now = new Date("2026-11-09T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await getMonitorMetrics(monitorId, period);

      const queryArguments = queryRaw.mock.calls[0];

      expect(queryArguments[1]).toBe(monitorId);
      expect(queryArguments[2]).toEqual(new Date(now.getTime() - durationMs)
      );
    }
  );

  it("returns all calculated metrics", async () => {
    const result = await getMonitorMetrics(monitorId, "7d");

    expect(result).toEqual({
      monitorId,
      period: "7d",
      totalChecks: 100,
      successfulChecks: 95,
      failedChecks: 5,
      availabilityPercentage: 95,
      averageLatencyMs: 320,
      p50LatencyMs: 300,
      p95LatencyMs: 450,
      p99LatencyMs: 490
    });
  });

  it("preserves null latency metrics when there are no successful checks", async () => {
    queryRaw.mockResolvedValue([
      {
        totalChecks: 5,
        successfulChecks: 0,
        failedChecks: 5,
        availabilityPercentage: 0,
        averageLatencyMs: null,
        p50LatencyMs: null,
        p95LatencyMs: null,
        p99LatencyMs: null
      }
    ]);

    const result = await getMonitorMetrics(monitorId);

    expect(result).toEqual({
      monitorId,
      period: "24h",
      totalChecks: 5,
      successfulChecks: 0,
      failedChecks: 5,
      availabilityPercentage: 0,
      averageLatencyMs: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      p99LatencyMs: null
    });
  });

  it("returns zero availability and null latency metrics for an empty dataset", async () => {
    queryRaw.mockResolvedValue([
      {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        availabilityPercentage: 0,
        averageLatencyMs: null,
        p50LatencyMs: null,
        p95LatencyMs: null,
        p99LatencyMs: null
      },
    ]);

    const result = await getMonitorMetrics(monitorId);

    expect(result).toMatchObject({
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      availabilityPercentage: 0,
      averageLatencyMs: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      p99LatencyMs: null
    });
  });
});
