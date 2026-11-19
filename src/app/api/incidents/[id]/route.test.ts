import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getIncidentById: vi.fn(),
  authenticateApiRequest: vi.fn()
}));

vi.mock("@/lib/services/incident.service", () => ({
  getIncidentById: mocks.getIncidentById
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest
}));

const incidentId = "incident-123";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const existingIncident = {
  id: incidentId,
  status: "OPEN",
  monitorId: "monitor-123",
  monitor: {
    id: "monitor-123",
    name: "Production API"
  },
  events: [
    {
      id: "event-1",
      type: "OPENED"
    }
  ]
};

const context = {
  params: Promise.resolve({ id: incidentId })
};

describe("GET /api/incidents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: TEST_USER_ID },
      response: null
    });

    mocks.getIncidentById.mockResolvedValue(existingIncident);
  });

  it("returns an incident belonging to the authenticated user", async () => {
    const response = await GET(new Request("http://localhost:3000"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(existingIncident);

    expect(mocks.getIncidentById).toHaveBeenCalledWith(incidentId, TEST_USER_ID);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    });

    const response = await GET(new Request("http://localhost:3000"), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");

    expect(mocks.getIncidentById).not.toHaveBeenCalled();
  });

  it("returns 404 when the incident does not exist", async () => {
    mocks.getIncidentById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000"), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Incident not found");
  });

  it("returns 404 when the incident belongs to another user", async () => {
    mocks.getIncidentById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000"), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Incident not found");

    expect(mocks.getIncidentById).toHaveBeenCalledWith(incidentId, TEST_USER_ID);
  });

  it("returns 500 when retrieving the incident fails", async () => {
    mocks.getIncidentById.mockRejectedValue(new Error("Database Query Failed"));

    const response = await GET(new Request("http://localhost:3000"), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve incident");
  });
});
