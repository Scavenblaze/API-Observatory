import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(),
  authenticateApiRequest: vi.fn()
}));

vi.mock("@/lib/services/dashboard.service", () => ({
  getDashboardOverview: mocks.getDashboardOverview
}));

vi.mock("@/lib/supabase/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /api/dashboard", () => {
  const overview = {
    summary: {
      totalMonitors: 4,
      operational: 2,
      failing: 1,
      unchecked: 1,
      openIncidents: 2
    },
    monitors: [],
    recentIncidents: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticateApiRequest.mockResolvedValue({
      user: {
        id: TEST_USER_ID
      },
      response: null
    });

    mocks.getDashboardOverview.mockResolvedValue(overview);
  });

  it("returns the dashboard overview successfully", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: overview
    });

    expect(mocks.getDashboardOverview).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.getDashboardOverview).toHaveBeenCalledOnce();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");

    expect(mocks.getDashboardOverview).not.toHaveBeenCalled();
  });

  it("returns 500 when the dashboard service fails", async () => {
    const error = new Error("Database connection failed");

    mocks.getDashboardOverview.mockRejectedValue(error);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try{
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: "Failed to retrieve dashboard overview"
      });

      expect(consoleError).toHaveBeenCalledWith("Failed to retrieve dashboard overview:", error);

      expect(mocks.getDashboardOverview).toHaveBeenCalledWith(TEST_USER_ID);
    } finally{
      consoleError.mockRestore();
    }
  });
});
