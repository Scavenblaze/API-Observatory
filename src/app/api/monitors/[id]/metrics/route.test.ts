import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getMonitorMetrics: vi.fn(),
  getMonitorById: vi.fn(),
  authenticateApiRequest: vi.fn()
}));

vi.mock("@/lib/services/metrics.service", () => ({
  getMonitorMetrics: mocks.getMonitorMetrics
}));

vi.mock("@/lib/services/monitor.service", () => ({
  getMonitorById: mocks.getMonitorById
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest
}));

const monitorId = "monitor-123";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const existingMonitor = {
  id: monitorId,
  name: "Production API"
};

const metrics = {
  monitorId,
  period: "24h",
  totalChecks: 100,
  successfulChecks: 98,
  failedChecks: 2,
  availabilityPercentage: 98,
  averageLatencyMs: 250,
  p50LatencyMs: 230,
  p95LatencyMs: 450,
  p99LatencyMs: 600
};

const context = {
  params: Promise.resolve({ id: monitorId })
};

const createRequest = (period?: string) => {
  const url = new URL(`http://localhost:3000/api/monitors/${monitorId}/metrics`);

  if(period !== undefined){
    url.searchParams.set("period", period);
  }

  return new NextRequest(url);
};

describe("GET /api/monitors/[id]/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: TEST_USER_ID },
      response: null
    });

    mocks.getMonitorById.mockResolvedValue(existingMonitor);
    mocks.getMonitorMetrics.mockResolvedValue(metrics);
  });

  it("returns metrics for an owned monitor using the default period", async () => {
    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(metrics);

    expect(mocks.getMonitorById).toHaveBeenCalledWith(monitorId, TEST_USER_ID);

    expect(mocks.getMonitorMetrics).toHaveBeenCalledWith(monitorId, "24h");
  });

  it.each(["1h", "24h", "7d", "30d"])(
    "accepts the %s period",
    async (period) => {
      const response = await GET(createRequest(period), context);

      expect(response.status).toBe(200);
      expect(mocks.getMonitorMetrics).toHaveBeenCalledWith(monitorId, period);
    }
  );

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    });

    const response = await GET(createRequest(), context);

    expect(response.status).toBe(401);
    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.getMonitorMetrics).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid period", async () => {
    const response = await GET(createRequest("5d"), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid period");
    expect(body.allowedPeriods).toEqual(["1h", "24h", "7d", "30d"]);

    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.getMonitorMetrics).not.toHaveBeenCalled();
  });

  it("returns 404 when the monitor does not belong to the user", async () => {
    mocks.getMonitorById.mockResolvedValue(null);

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");

    expect(mocks.getMonitorMetrics).not.toHaveBeenCalled();
  });

  it("returns 404 when metrics are unavailable", async () => {
    mocks.getMonitorMetrics.mockResolvedValue(null);

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");
  });

  it("returns 500 when monitor ownership lookup fails", async () => {
    mocks.getMonitorById.mockRejectedValue(new Error("Database Connection Failed"));

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve monitor metrics");

    expect(mocks.getMonitorMetrics).not.toHaveBeenCalled();
  });

  it("returns 500 when metrics retrieval fails", async () => {
    mocks.getMonitorMetrics.mockRejectedValue(new Error("Metrics Query Failed"));

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve monitor metrics");
  });
});