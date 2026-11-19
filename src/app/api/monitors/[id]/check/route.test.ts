import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  runHealthCheck: vi.fn(),
  getMonitorById: vi.fn(),
  authenticateApiRequest: vi.fn(),
  rateLimit: vi.fn()
}));

vi.mock("@/lib/services/health-check.service", () => ({
  runHealthCheck: mocks.runHealthCheck
}));

vi.mock("@/lib/services/monitor.service", () => ({
  getMonitorById: mocks.getMonitorById
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit
}));

vi.mock("@/lib/security/csrf", () => ({
  validateRequestOrigin: vi.fn(() => null)
}));

const monitorId = "monitor-123";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const existingMonitor = {
  id: monitorId,
  name: "Production API",
  url: "https://example.com",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true
};

const healthCheckResult = {
  id: "check-123",
  monitorId,
  statusCode: 200,
  latencyMs: 150,
  success: true,
  errorType: null,
  errorMessage: null
};

const context = {
  params: Promise.resolve({ id: monitorId })
};

const createRequest = () => new NextRequest(`http://localhost:3000/api/monitors/${monitorId}/check`,
    {
      method: "POST"
    }
  );

describe("POST /api/monitors/[id]/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: {
        id: TEST_USER_ID
      },
      response: null
    });

    mocks.rateLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetSeconds: 60
    });

    mocks.getMonitorById.mockResolvedValue(existingMonitor);
    mocks.runHealthCheck.mockResolvedValue(healthCheckResult);
  });

  it("runs a manual health check successfully", async () => {
    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual(healthCheckResult);

    expect(mocks.rateLimit).toHaveBeenCalledWith(`rate-limit:manual-check:${TEST_USER_ID}`, 5, 60);

    expect(mocks.getMonitorById).toHaveBeenCalledWith(monitorId, TEST_USER_ID);

    expect(mocks.runHealthCheck).toHaveBeenCalledWith(monitorId);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    });

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");

    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.runHealthCheck).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetSeconds: 30
    });

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(429);

    expect(body).toEqual({
      error: "Too many manual health check requests",
      limit: 5,
      remaining: 0,
      retryAfter: 30
    });

    expect(response.headers.get("Retry-After")).toBe("30");

    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.runHealthCheck).not.toHaveBeenCalled();
  });

  it("returns 503 when the rate-limiting service fails", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("Redis connection failed"));

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Rate limiting service unavailable");

    expect(mocks.getMonitorById).not.toHaveBeenCalled();
    expect(mocks.runHealthCheck).not.toHaveBeenCalled();
  });

  it("returns 404 when the monitor does not belong to the user", async () => {
    mocks.getMonitorById.mockResolvedValue(null);

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");

    expect(mocks.getMonitorById).toHaveBeenCalledWith(monitorId, TEST_USER_ID);

    expect(mocks.runHealthCheck).not.toHaveBeenCalled();
  });

  it("returns 404 when the monitor no longer exists", async () => {
    mocks.runHealthCheck.mockResolvedValue(null);

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Monitor not found");

    expect(mocks.runHealthCheck).toHaveBeenCalledWith(monitorId);
  });

  it("returns 409 when the monitor is disabled", async () => {
    mocks.runHealthCheck.mockRejectedValue(new Error("MONITOR_DISABLED"));

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Cannot run a health check for a disabled monitor");
  });

  it("returns 500 when retrieving the monitor fails", async () => {
    mocks.getMonitorById.mockRejectedValue(new Error("Database Connection Failed"));

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to run health check");

    expect(mocks.runHealthCheck).not.toHaveBeenCalled();
  });

  it("returns 500 when running the health check fails", async () => {
    mocks.runHealthCheck.mockRejectedValue(new Error("Unexpected health check failure"));

    const response = await POST(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to run health check");
  });
});
