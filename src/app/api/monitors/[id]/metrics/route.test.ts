import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const { getMonitorMetrics } = vi.hoisted(() => ({
  getMonitorMetrics: vi.fn()
}));

vi.mock("@/lib/services/metrics.service", () => ({
  getMonitorMetrics
}));


describe("GET /api/monitors/[id]/metrics", () => {
  const monitorId = "monitor-123";

  const metrics = {
    monitorId,
    period: "24h",
    totalChecks: 100,
    successfulChecks: 95,
    failedChecks: 5,
    availabilityPercentage: 95,
    averageLatencyMs: 320,
    p50LatencyMs: 300,
    p95LatencyMs: 450,
    p99LatencyMs: 490
  };

  const createRequest = (url: string) => new NextRequest(url);

  const createContext = () => ({
    params: Promise.resolve({ id: monitorId })
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getMonitorMetrics.mockResolvedValue(metrics);
  });

  it("returns metrics using the default 24h period", async () => {
    const request = createRequest(`http://localhost/api/monitors/${monitorId}/metrics`);

    const response = await GET(request, createContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: metrics });
    expect(getMonitorMetrics).toHaveBeenCalledWith(monitorId, "24h");
  });

  it.each(["1h", "24h", "7d", "30d"] as const)(
    "accepts the %s period",
    async (period) => {
      getMonitorMetrics.mockResolvedValue({
        ...metrics,
        period
      });

      const request = createRequest(`http://localhost/api/monitors/${monitorId}/metrics?period=${period}`);

      const response = await GET(request, createContext());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.period).toBe(period);
      expect(getMonitorMetrics).toHaveBeenCalledWith(monitorId, period);
    }
  );

  it("returns 400 for an unsupported period", async () => {
    const request = createRequest(`http://localhost/api/monitors/${monitorId}/metrics?period=2h`);

    const response = await GET(request, createContext());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid period",
      allowedPeriods: ["1h", "24h", "7d", "30d"],
    });
    expect(getMonitorMetrics).not.toHaveBeenCalled();
  });

  it("returns 404 when the monitor does not exist", async () => {
    getMonitorMetrics.mockResolvedValue(null);

    const request = createRequest(`http://localhost/api/monitors/${monitorId}/metrics`);

    const response = await GET(request, createContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Monitor not found" });
  });

  it("returns 500 when the metrics service throws an error", async () => {
    const error = new Error("Database connection failed");
    getMonitorMetrics.mockRejectedValue(error);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = createRequest(`http://localhost/api/monitors/${monitorId}/metrics`);

    const response = await GET(request, createContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to retrieve monitor metrics"
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to retrieve monitor metrics:",
      error
    );

    consoleError.mockRestore();
  });
});
