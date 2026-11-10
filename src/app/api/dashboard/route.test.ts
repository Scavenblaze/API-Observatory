import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getDashboardOverview } = vi.hoisted(() => ({
  getDashboardOverview: vi.fn()
}));

vi.mock("@/lib/services/dashboard.service", () => ({
  getDashboardOverview
}));



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
    getDashboardOverview.mockResolvedValue(overview);
  });

  it("returns the dashboard overview successfully", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: overview
    });
    expect(getDashboardOverview).toHaveBeenCalledOnce();
  });

  it("returns 500 when the dashboard service fails", async () => {
    const error = new Error("Database connection failed");
    getDashboardOverview.mockRejectedValue(error);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to retrieve dashboard overview"
    });

    expect(consoleError).toHaveBeenCalledWith("Failed to retrieve dashboard overview:", error);

    consoleError.mockRestore();
  });
});
