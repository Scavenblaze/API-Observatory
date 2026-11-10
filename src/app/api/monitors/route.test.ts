import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";


const mocks = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  listMonitors: vi.fn(),
}));

vi.mock("@/lib/services/monitor.service", () => ({
  createMonitor: mocks.createMonitor,
  listMonitors: mocks.listMonitors,
}));


const validMonitor = {
  name: "Production API",
  url: "https://example.com",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true
};

const createRequest = (body: string) => {
  return new NextRequest("http://localhost/api/monitors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
}

describe("Monitor Collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/monitors", () => {
    it("returns all monitors", async () => {
      const monitors = [
        { id: "monitor-1", name: "Production API" },
        { id: "monitor-2", name: "Staging API" }
      ];

      mocks.listMonitors.mockResolvedValue(monitors);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: monitors,
        count: 2
      });
    });

    it("returns 500 when retrieving monitors fails", async () => {
      mocks.listMonitors.mockRejectedValue(new Error("Database error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: "Failed to retrieve monitors"
      });

      consoleSpy.mockRestore();
    });
  });

  describe("POST /api/monitors", () => {
    it("creates a monitor with valid input", async () => {
      const createdMonitor = {
        id: "monitor-123",
        ...validMonitor
      };

      mocks.createMonitor.mockResolvedValue(createdMonitor);

      const response = await POST(createRequest(JSON.stringify(validMonitor)));

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data).toEqual(createdMonitor);

      expect(mocks.createMonitor).toHaveBeenCalledWith(validMonitor);
    });

    it("returns 400 for invalid JSON", async () => {
      const response = await POST(createRequest("{invalid-json"));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Request body must be valid JSON");
      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid monitor configuration", async () => {
      const invalidMonitor = {
        ...validMonitor,
        url: "ftp://example.com"
      };

      const response = await POST(createRequest(JSON.stringify(invalidMonitor)));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Invalid monitor configuration");
      expect(body.details.length).toBeGreaterThan(0);

      expect(mocks.createMonitor).not.toHaveBeenCalled();
    });

    it("returns 500 when monitor creation fails", async () => {
      mocks.createMonitor.mockRejectedValue(new Error("Database error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST(createRequest(JSON.stringify(validMonitor)));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("Failed to create monitor");

      consoleSpy.mockRestore();
    });
  });
});
