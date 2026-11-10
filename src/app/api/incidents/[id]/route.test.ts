import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";


const { getIncidentById } = vi.hoisted(() => ({
  getIncidentById: vi.fn()
}));

vi.mock("@/lib/services/incident.service", () => ({
  getIncidentById
}));


describe("GET /api/incidents/[id]", () => {
  const incidentId = "incident-123";

  const incident = {
    id: incidentId,
    title: "Production API is unavailable",
    status: "OPEN",
    monitor: {
      id: "monitor-123",
      name: "Production API",
      url: "https://api.example.com"
    },
    events: [
      {
        id: "event-1",
        type: "OPENED",
        message: "Incident opened after 3 consecutive failures."
      }
    ]
  };

  const createContext = () => ({
    params: Promise.resolve({ id: incidentId })
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getIncidentById.mockResolvedValue(incident);
  });

  it("returns the incident successfully", async () => {
    const response = await GET(
      new Request(`http://localhost/api/incidents/${incidentId}`), createContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: incident
    });
    expect(getIncidentById).toHaveBeenCalledWith(incidentId);
  });

  it("returns 404 when the incident does not exist", async () => {
    getIncidentById.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/incidents/${incidentId}`), createContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "Incident not found"
    });
  });

  it("returns 500 when the incident service fails", async () => {
    const error = new Error("Database connection failed");
    getIncidentById.mockRejectedValue(error);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new Request(`http://localhost/api/incidents/${incidentId}`), createContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to retrieve incident"
    });
    expect(consoleError).toHaveBeenCalledWith("Failed to retrieve incident:", error);

    consoleError.mockRestore();
  });
});
