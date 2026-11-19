
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PATCH, DELETE } from "./route";

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
    getMonitorById: vi.fn(),
    updateMonitor: vi.fn(),
    deleteMonitor: vi.fn(),
    authenticateApiRequest: vi.fn(),
    MonitorQuotaExceededError: MockMonitorQuotaExceededError,
  };
});

vi.mock("@/lib/services/monitor.service", () => ({
  getMonitorById: mocks.getMonitorById,
  updateMonitor: mocks.updateMonitor,
  deleteMonitor: mocks.deleteMonitor,
  MonitorQuotaExceededError: mocks.MonitorQuotaExceededError,
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
}));

vi.mock("@/lib/security/csrf", () => ({
  validateRequestOrigin: vi.fn(() => null),
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
  enabled: true,
};

const context = {
  params: Promise.resolve({ id: monitorId }),
};

const createRequest = (method: string, body?: string) => {
  return new NextRequest(
    `http://localhost:3000/api/monitors/${monitorId}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body } : {}),
    }
  );
};

const mockUnauthenticatedUser = () => {
  mocks.authenticateApiRequest.mockResolvedValue({
    user: null,
    response: NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    ),
  });
};

describe("Individual Monitor API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: {
        id: TEST_USER_ID,
      },
      response: null,
    });
  });

  describe("GET /api/monitors/[id]", () => {
    it("returns a monitor when it exists", async () => {
      mocks.getMonitorById.mockResolvedValue(existingMonitor);

      const response = await GET(
        createRequest("GET"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(existingMonitor);

      expect(mocks.getMonitorById).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID
      );
    });

    it("returns 404 when the monitor does not exist", async () => {
      mocks.getMonitorById.mockResolvedValue(null);

      const response = await GET(
        createRequest("GET"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Monitor not found");
    });

    it("returns 401 when the user is unauthenticated", async () => {
      mockUnauthenticatedUser();

      const response = await GET(
        createRequest("GET"),
        context
      );

      expect(response.status).toBe(401);
      expect(mocks.getMonitorById).not.toHaveBeenCalled();
    });

    it("returns 500 when retrieving the monitor fails", async () => {
      mocks.getMonitorById.mockRejectedValue(
        new Error("Database Connection Failed")
      );

      const response = await GET(
        createRequest("GET"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to retrieve monitor");
    });
  });

  describe("PATCH /api/monitors/[id]", () => {
    it("updates a monitor with valid input", async () => {
      const updateData = {
        name: "Updated API",
        intervalSeconds: 120,
      };

      const updatedMonitor = {
        ...existingMonitor,
        ...updateData,
      };

      mocks.updateMonitor.mockResolvedValue(updatedMonitor);

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(updateData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(updatedMonitor);

      expect(mocks.updateMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID,
        updateData
      );
    });

    it("preserves omitted fields during a partial update", async () => {
      const updateData = {
        name: "Updated API",
      };

      const updatedMonitor = {
        ...existingMonitor,
        ...updateData,
      };

      mocks.updateMonitor.mockResolvedValue(updatedMonitor);

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(updateData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(updatedMonitor);

      expect(mocks.updateMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID,
        {
          name: "Updated API",
        }
      );
    });

    it("returns 401 when the user is unauthenticated", async () => {
      mockUnauthenticatedUser();

      const response = await PATCH(
        createRequest(
          "PATCH",
          JSON.stringify({ name: "Updated API" })
        ),
        context
      );

      expect(response.status).toBe(401);
      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON", async () => {
      const response = await PATCH(
        createRequest("PATCH", "{invalid-json"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Request body must be valid JSON"
      );

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty request body", async () => {
      const response = await PATCH(
        createRequest("PATCH", JSON.stringify({})),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Request body must be a non-empty JSON object"
      );

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid update data", async () => {
      const invalidData = {
        intervalSeconds: 2,
      };

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(invalidData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Invalid monitor configuration"
      );

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 404 when updating a nonexistent monitor", async () => {
      mocks.updateMonitor.mockResolvedValue(null);

      const updateData = {
        name: "Updated API",
      };

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(updateData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Monitor not found");

      expect(mocks.updateMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID,
        updateData
      );
    });

    it("returns 409 when the enabled monitor quota is exceeded", async () => {
      mocks.updateMonitor.mockRejectedValue(
        new mocks.MonitorQuotaExceededError("ENABLED")
      );

      const updateData = {
        enabled: true,
      };

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(updateData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(409);

      expect(body).toEqual({
        error: "You can have a maximum of 20 enabled monitors.",
        quota: "ENABLED",
      });

      expect(mocks.updateMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID,
        updateData
      );
    });

    it("returns 500 when updating the monitor fails unexpectedly", async () => {
      mocks.updateMonitor.mockRejectedValue(
        new Error("Database Update Failed")
      );

      const updateData = {
        name: "Updated API",
      };

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await PATCH(
        createRequest("PATCH", JSON.stringify(updateData)),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to update monitor");

      expect(mocks.updateMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID,
        updateData
      );

      consoleSpy.mockRestore();
    });
  });

  describe("DELETE /api/monitors/[id]", () => {
    it("returns 401 when the user is unauthenticated", async () => {
      mockUnauthenticatedUser();

      const response = await DELETE(
        createRequest("DELETE"),
        context
      );

      expect(response.status).toBe(401);
      expect(mocks.deleteMonitor).not.toHaveBeenCalled();
    });

    it("deletes an existing monitor", async () => {
      mocks.deleteMonitor.mockResolvedValue(true);

      const response = await DELETE(
        createRequest("DELETE"),
        context
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");

      expect(mocks.deleteMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID
      );
    });

    it("returns 404 when deleting a nonexistent monitor", async () => {
      mocks.deleteMonitor.mockResolvedValue(false);

      const response = await DELETE(
        createRequest("DELETE"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Monitor not found");

      expect(mocks.deleteMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID
      );
    });

    it("returns 500 when deleting the monitor fails", async () => {
      mocks.deleteMonitor.mockRejectedValue(
        new Error("Database deletion failed")
      );

      const response = await DELETE(
        createRequest("DELETE"),
        context
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to delete monitor");

      expect(mocks.deleteMonitor).toHaveBeenCalledWith(
        monitorId,
        TEST_USER_ID
      );
    });
  });
});
