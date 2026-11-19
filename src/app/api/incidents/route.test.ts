import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  listIncidents: vi.fn(),
  authenticateApiRequest: vi.fn()
}));

vi.mock("@/lib/services/incident.service", () => ({
  listIncidents: mocks.listIncidents
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const incidents = [
  {
    id: "incident-1",
    status: "OPEN",
    monitorId: "monitor-1"
  },
  {
    id: "incident-2",
    status: "RESOLVED",
    monitorId: "monitor-2"
  }
];

const createRequest = (params?: Record<string, string>) => {
  const url = new URL("http://localhost:3000/api/incidents");

  if(params){
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new NextRequest(url);
};

describe("GET /api/incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: { id: TEST_USER_ID },
      response: null
    });

    mocks.listIncidents.mockResolvedValue(incidents);
  });

  it("returns incidents for the authenticated user", async () => {
    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(incidents);
    expect(body.count).toBe(2);

    expect(mocks.listIncidents).toHaveBeenCalledWith(TEST_USER_ID, undefined, 50);
  });

  it("filters incidents by status", async () => {
    const response = await GET(createRequest({ status: "OPEN" }));

    expect(response.status).toBe(200);

    expect(mocks.listIncidents).toHaveBeenCalledWith(TEST_USER_ID, "OPEN", 50);
  });

  it("accepts RESOLVED as a valid status", async () => {
    const response = await GET(createRequest({ status: "RESOLVED" }));

    expect(response.status).toBe(200);

    expect(mocks.listIncidents).toHaveBeenCalledWith(TEST_USER_ID, "RESOLVED", 50);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(mocks.listIncidents).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid status", async () => {
    const response = await GET(createRequest({ status: "CLOSED" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid status");
    expect(body.allowedStatuses).toEqual(["OPEN", "RESOLVED"]);

    expect(mocks.listIncidents).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit is not a positive integer", async () => {
    const response = await GET(createRequest({ limit: "abc" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be a positive integer");

    expect(mocks.listIncidents).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit is zero", async () => {
    const response = await GET(createRequest({ limit: "0" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be between 1 and 100");

    expect(mocks.listIncidents).not.toHaveBeenCalled();
  });

  it("returns 400 when the limit exceeds 100", async () => {
    const response = await GET(createRequest({ limit: "101" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Limit must be between 1 and 100");

    expect(mocks.listIncidents).not.toHaveBeenCalled();
  });

  it("uses the requested limit", async () => {
    const response = await GET(createRequest({ limit: "25" }));

    expect(response.status).toBe(200);

    expect(mocks.listIncidents).toHaveBeenCalledWith(TEST_USER_ID, undefined, 25);
  });

  it("supports filtering by status and limit together", async () => {
    const response = await GET(
      createRequest({
        status: "OPEN",
        limit: "10"
      })
    );

    expect(response.status).toBe(200);

    expect(mocks.listIncidents).toHaveBeenCalledWith(TEST_USER_ID, "OPEN", 10);
  });

  it("returns 500 when retrieving incidents fails", async () => {
    mocks.listIncidents.mockRejectedValue(new Error("Database Query Failed"));

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve incidents");
  });
});
