import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  getMonitorById: vi.fn(),
  updateMonitor: vi.fn(),
  deleteMonitor: vi.fn(),
}));

vi.mock("@/lib/services/monitor.service", () => ({
  getMonitorById: mocks.getMonitorById,
  updateMonitor: mocks.updateMonitor,
  deleteMonitor: mocks.deleteMonitor,
}));

const monitorId = "monitor-123";

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

const context = {
  params: Promise.resolve({ id: monitorId })
};

const createRequest = (method: string, body?: string) => {
  return new NextRequest(
    `http://localhost/api/monitors/${monitorId}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body } : {})
    }
  );
}

describe("Individual Monitor API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/monitors/[id]", () => {
    it("returns a monitor when it exists", async () => {
      mocks.getMonitorById.mockResolvedValue(existingMonitor);

      const response = await GET(createRequest("GET"), context);

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(existingMonitor);
      expect(mocks.getMonitorById).toHaveBeenCalledWith(monitorId);
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

    it("returns 500 when retrieving the monitor fails", async () => {
      mocks.getMonitorById.mockRejectedValue(new Error("Database Connection Failed"));
      
      const response = await GET(createRequest("GET"), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to retrieve monitor");
    });
  });

  describe("PATCH /api/monitors/[id]", () => {
    it("updates a monitor with valid input", async () => {
      const updateData = {
        name: "Updated API",
        intervalSeconds: 120
      };

      const updatedMonitor = {
        ...existingMonitor,
        ...updateData
      };

      mocks.getMonitorById.mockResolvedValue(existingMonitor);
      mocks.updateMonitor.mockResolvedValue(updatedMonitor);

      const response = await PATCH(createRequest("PATCH", JSON.stringify(updateData)), context);

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(updatedMonitor);

      expect(mocks.updateMonitor).toHaveBeenCalledWith(monitorId, updateData);
    });

    it("returns 400 for invalid JSON", async () => {
      const response = await PATCH(createRequest("PATCH", "{invalid-json"), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Request body must be valid JSON");

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty request body", async () => {
      const response = await PATCH(createRequest("PATCH", JSON.stringify({})), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Request body must be a non-empty JSON object");
    });

    it("returns 400 for invalid update data", async () => {
      const invalidData = {
        intervalSeconds: 2
      };

      const response = await PATCH(createRequest("PATCH", JSON.stringify(invalidData)), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Invalid monitor configuration");

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 404 when updating a nonexistent monitor", async () => {
      mocks.getMonitorById.mockResolvedValue(null);

      const response = await PATCH(createRequest("PATCH", JSON.stringify({ name: "Updated API" })), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Monitor not found");

      expect(mocks.updateMonitor).not.toHaveBeenCalled();
    });

    it("returns 500 when updating the monitor fails", async () => {
      mocks.getMonitorById.mockResolvedValue(existingMonitor);
      mocks.updateMonitor.mockRejectedValue(new Error("Database Update Failed"));

      const response = await PATCH(createRequest("PATCH", JSON.stringify({ name: "Updated API" })), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to update monitor");
      expect(mocks.updateMonitor).toHaveBeenCalledWith(monitorId, {name: "Updated API"});
    });
  });

  describe("DELETE /api/monitors/[id]", () => {
    it("deletes an existing monitor", async () => {
      mocks.getMonitorById.mockResolvedValue(existingMonitor);
      mocks.deleteMonitor.mockResolvedValue(existingMonitor);

      const response = await DELETE(createRequest("DELETE"), context);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");

      expect(mocks.deleteMonitor).toHaveBeenCalledWith(monitorId);
    });

    it("returns 404 when deleting a nonexistent monitor", async () => {
      mocks.getMonitorById.mockResolvedValue(null);

      const response = await DELETE(createRequest("DELETE"), context);

      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Monitor not found");

      expect(mocks.deleteMonitor).not.toHaveBeenCalled();
    });

    it("returns 500 when deleting the monitor fails", async () => {
      mocks.getMonitorById.mockResolvedValue(existingMonitor);
      mocks.deleteMonitor.mockRejectedValue(new Error("Database deletiong failed"));

      const response = await DELETE(createRequest("DELETE"), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to delete monitor");
      expect(mocks.deleteMonitor).toHaveBeenCalledWith(monitorId);
    });
  });
});
