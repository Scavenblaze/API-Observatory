import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  listHealthChecks: vi.fn(),
  getMonitorById: vi.fn(),
  authenticateApiRequest: vi.fn()
}));

vi.mock("@/lib/services/health-check.service", () => ({
  listHealthChecks: mocks.listHealthChecks
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

const healthChecks = [
  {
    id: "check-1",
    monitorId,
    statusCode: 200,
    latencyMs: 150,
    success: true
  },
  {
    id: "check-2",
    monitorId,
    statusCode: 500,
    latencyMs: 300,
    success: false
  }
];

const context = {
  params: Promise.resolve({ id: monitorId })
};

const createRequest = (limit?: string) => {
  const url = new URL(
    `http://localhost:3000/api/monitors/${monitorId}/checks`
  );

  if(limit !== undefined){
    url.searchParams.set("limit", limit);
  }

  return new NextRequest(url);
};

describe("GET /api/monitors/[id]/checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: TEST_USER_ID },
      response: null
    });

    mocks.getMonitorById.mockResolvedValue(existingMonitor);
    mocks.listHealthChecks.mockResolvedValue(healthChecks);
  });

  it("returns health checks for an owned monitor", async () => {
    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(healthChecks);
    expect(body.count).toBe(2);

    expect(mocks.getMonitorById).toHaveBeenCalledWith(monitorId, TEST_USER_ID);
    expect(mocks.listHealthChecks).toHaveBeenCalledWith(monitorId, 50);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    });

    const response = await GET(createRequest(), context);

    expect(response.status).toBe(401);
    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.listHealthChecks).not.toHaveBeenCalled();
  });

  it("returns 404 when the monitor does not belong to the user", async () => {
    mocks.getMonitorById.mockResolvedValue(null);

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");

    expect(mocks.listHealthChecks).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit is not a positive integer", async () => {
    const response = await GET(createRequest("abc"), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be a positive integer");

    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.listHealthChecks).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit is zero", async () => {
    const response = await GET(createRequest("0"), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be between 1 and 100");
  });

  it("returns 400 when the limit exceeds 100", async () => {
    const response = await GET(createRequest("101"), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be between 1 and 100");
  });

  it("uses the requested limit", async () => {
    const response = await GET(createRequest("25"), context);

    expect(response.status).toBe(200);
    expect(mocks.listHealthChecks).toHaveBeenCalledWith(monitorId, 25);
  });

  it("returns 404 if the monitor disappears before history retrieval", async () => {
    mocks.listHealthChecks.mockResolvedValue(null);

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");
  });

  it("returns 500 when retrieving the monitor fails", async () => {
    mocks.getMonitorById.mockRejectedValue(new Error("Database Connection Failed"));

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve health checks");

    expect(mocks.listHealthChecks).not.toHaveBeenCalled();
  });

  it("returns 500 when retrieving health checks fails", async () => {
    mocks.listHealthChecks.mockRejectedValue(new Error("Database Query Failed"));

    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve health checks");
  });
});
