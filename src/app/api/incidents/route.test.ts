import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const { listIncidents } = vi.hoisted(() => ({
  listIncidents: vi.fn()
}));

vi.mock("@/lib/services/incident.service", () => ({
  listIncidents
}));


describe("GET /api/incidents", () => {
  const incidents = [
    {
      id: "incident-1",
      title: "Production API is unavailable",
      status: "OPEN"
    },
    {
      id: "incident-2",
      title: "Staging API recovered",
      status: "RESOLVED"
    }
  ];

  const createRequest = (query = "") => new NextRequest(`http://localhost/api/incidents${query}`);

  beforeEach(() => {
    vi.clearAllMocks();
    listIncidents.mockResolvedValue(incidents);
  });

  it("returns incidents with default parameters", async () => {
    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: incidents,
      count: 2
    });
    expect(listIncidents).toHaveBeenCalledWith(undefined, 50);
  });

  it.each(["OPEN", "RESOLVED"] as const)(
    "accepts the %s status filter",
    async (status) => {
      listIncidents.mockResolvedValue(incidents.filter((incident) => incident.status === status));

      const response = await GET(createRequest(`?status=${status}`));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listIncidents).toHaveBeenCalledWith(status, 50);
      expect(body.count).toBe(1);
    }
  );

  it("accepts a custom limit", async () => {
    const response = await GET(createRequest("?limit=10"));

    expect(response.status).toBe(200);
    expect(listIncidents).toHaveBeenCalledWith(undefined, 10);
  });

  it("accepts status and limit together", async () => {
    const response = await GET(createRequest("?status=OPEN&limit=25"));

    expect(response.status).toBe(200);
    expect(listIncidents).toHaveBeenCalledWith("OPEN", 25);
  });

  it("returns 400 for an invalid status", async () => {
    const response = await GET(createRequest("?status=PENDING"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid status",
      allowedStatuses: ["OPEN", "RESOLVED"]
    });
    expect(listIncidents).not.toHaveBeenCalled();
  });

  it.each(["abc", "1.5", "-1", "1e2", ""])(
    "rejects invalid limit value %s",
    async (limit) => {
      const response = await GET(
        createRequest(`?limit=${limit}`)
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        error: "Limit must be a positive integer"
      });
      expect(listIncidents).not.toHaveBeenCalled();
    }
  );

  it.each(["0", "101", "999999999999999999999"])(
    "rejects limit outside the allowed range: %s",
    async (limit) => {
      const response = await GET(createRequest(`?limit=${limit}`));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        error: "Limit must be between 1 and 100"
      });
      expect(listIncidents).not.toHaveBeenCalled();
    }
  );

  it.each(["1", "100"])(
    "accepts the boundary limit %s",
    async (limit) => {
      const response = await GET(
        createRequest(`?limit=${limit}`)
      );

      expect(response.status).toBe(200);
      expect(listIncidents).toHaveBeenCalledWith(undefined, Number(limit));
    }
  );

  it("returns an empty array and zero count when no incidents exist", async () => {
    listIncidents.mockResolvedValue([]);

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [],
      count: 0
    });
  });

  it("returns 500 when the incident service fails", async () => {
    const error = new Error("Database connection failed");
    listIncidents.mockRejectedValue(error);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to retrieve incidents"
    });
    expect(consoleError).toHaveBeenCalledWith("Failed to retrieve incidents:", error);

    consoleError.mockRestore();
  });
});
