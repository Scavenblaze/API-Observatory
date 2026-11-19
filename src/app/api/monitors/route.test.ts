
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => {
  class MockMonitorQuotaExceededError extends Error {
    constructor(public readonly quota: "TOTAL" | "ENABLED") {
      super(
        quota === "TOTAL"
          ? "You can create a maximum of 50 monitors."
          : "You can have a maximum of 20 enabled monitors."
      );

      this.name = "MonitorQuotaExceededError";
    }
  }

  return {
    createMonitor: vi.fn(),
    listMonitors: vi.fn(),
    authenticateApiRequest: vi.fn(),
    rateLimit: vi.fn(),
    MonitorQuotaExceededError: MockMonitorQuotaExceededError,
  };
});

vi.mock("@/lib/services/monitor.service", () => ({
  createMonitor: mocks.createMonitor,
  listMonitors: mocks.listMonitors,
  MonitorQuotaExceededError: mocks.MonitorQuotaExceededError,
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/security/csrf", () => ({
  validateRequestOrigin: vi.fn(() => null),
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const validMonitor = {
  name: "Production API",
  url: "https://example.com",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true,
};

const createRequest = (body: string) => {
  return new NextRequest("http://localhost/api/monitors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
};

describe("Monitor Collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: {
        id: TEST_USER_ID,
      },
      response: null,
    });

    mocks.rateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetSeconds: 60,
    });
  });

  describe("GET /api/monitors", () => {
    it("returns all monitors", async () => {
      const monitors = [
        { id: "monitor-1", name: "Production API" },
        { id: "monitor-2", name: "Staging API" },
      ];

      mocks.listMonitors.mockResolvedValue(monitors);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: monitors,
        count: 2,
      });

      expect(mocks.listMonitors).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("returns 401 when the user is unauthenticated", async () => {
      mocks.authenticateApiRequest.mockResolvedValue({
        user: null,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      });

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");

      expect(mocks.listMonitors).not.toHaveBeenCalled();
    });

    it("returns 500 when retrieving monitors fails", async () => {
      mocks.listMonitors.mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: "Failed to retrieve monitors",
      });

      consoleSpy.mockRestore();
    });
  });

  describe("POST /api/monitors", () => {
    it("creates a monitor with valid input", async () => {
      const createdMonitor = {
        id: "monitor-123",
        ...validMonitor,
      };

      mocks.createMonitor.mockResolvedValue(createdMonitor);

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data).toEqual(createdMonitor);

      expect(mocks.rateLimit).toHaveBeenCalledWith(
        `rate-limit:monitor-create:${TEST_USER_ID}`,
        10,
        60
      );

      expect(mocks.createMonitor).toHaveBeenCalledWith({
        ...validMonitor,
        userId: TEST_USER_ID,
      });
    });

    it("returns 401 when the user is unauthenticated", async () => {
      mocks.authenticateApiRequest.mockResolvedValue({
        user: null,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      });

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");

      expect(mocks.rateLimit).not.toHaveBeenCalled();
      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 429 when the rate limit is exceeded", async () => {
      mocks.rateLimit.mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetSeconds: 25,
      });

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(429);

      expect(body).toEqual({
        error: "Too many monitor creation requests",
        limit: 10,
        remaining: 0,
        retryAfter: 25,
      });

      expect(response.headers.get("Retry-After")).toBe("25");
      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 503 when the rate-limiting service fails", async () => {
      mocks.rateLimit.mockRejectedValue(
        new Error("Redis connection failed")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toBe(
        "Rate limiting service unavailable"
      );

      expect(mocks.createMonitor).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns 400 for invalid JSON", async () => {
      const response = await POST(
        createRequest("{invalid-json")
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Request body must be valid JSON"
      );

      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid monitor configuration", async () => {
      const invalidMonitor = {
        ...validMonitor,
        url: "ftp://example.com",
      };

      const response = await POST(
        createRequest(JSON.stringify(invalidMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Invalid monitor configuration"
      );
      expect(body.details.length).toBeGreaterThan(0);

      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 409 when the total monitor quota is exceeded", async () => {
      mocks.createMonitor.mockRejectedValue(
        new mocks.MonitorQuotaExceededError("TOTAL")
      );

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(409);

      expect(body).toEqual({
        error: "You can create a maximum of 50 monitors.",
        quota: "TOTAL",
      });
    });

    it("returns 409 when the enabled monitor quota is exceeded", async () => {
      mocks.createMonitor.mockRejectedValue(
        new mocks.MonitorQuotaExceededError("ENABLED")
      );

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(409);

      expect(body).toEqual({
        error: "You can have a maximum of 20 enabled monitors.",
        quota: "ENABLED",
      });
    });

    it("returns 500 when monitor creation fails unexpectedly", async () => {
      mocks.createMonitor.mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await POST(
        createRequest(JSON.stringify(validMonitor))
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to create monitor");

      consoleSpy.mockRestore();
    });
  });
});
