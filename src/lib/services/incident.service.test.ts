import { beforeEach, describe, expect, it, vi } from "vitest";
import { processIncidentState, listIncidents, getIncidentById } from "./incident.service";

const mocks = vi.hoisted(() => ({
  healthCheckFindMany: vi.fn(),
  incidentFindFirst: vi.fn(),
  incidentCreate: vi.fn(),
  incidentUpdate: vi.fn(),
  incidentFindMany: vi.fn(),
  incidentFindUnique: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    healthCheck: {
      findMany: mocks.healthCheckFindMany,
    },
    incident: {
      findFirst: mocks.incidentFindFirst,
      create: mocks.incidentCreate,
      update: mocks.incidentUpdate,
      findMany: mocks.incidentFindMany,
      findUnique: mocks.incidentFindUnique
    }
  }
}));


describe("Incident Engine", () => {
  const monitorId = "monitor-123";
  const monitorName = "Production API";

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.incidentFindFirst.mockResolvedValue(null);
    mocks.incidentCreate.mockResolvedValue({});
    mocks.incidentUpdate.mockResolvedValue({});
    mocks.incidentFindMany.mockResolvedValue([]);
    mocks.incidentFindUnique.mockResolvedValue(null);
  });

// Incident lifecycle tests

  describe("processIncidentState", () => {
    it("creates an incident after three consecutive failures", async () => {
      const oldestFailure = new Date("2026-11-08T10:00:00Z");

      mocks.healthCheckFindMany.mockResolvedValue([
        {
          success: false,
          checkedAt: new Date("2026-11-08T10:02:00Z")
        },
        {
          success: false,
          checkedAt: new Date("2026-11-08T10:01:00Z")
        },
        {
          success: false,
          checkedAt: oldestFailure
        }
      ]);

      await processIncidentState(monitorId, monitorName);

      expect(mocks.incidentCreate).toHaveBeenCalledWith({
        data: {
          monitorId,
          title: "Production API is unavailable",
          description: "3 consecutive health checks failed.",
          startedAt: oldestFailure,
          events: {
            create: {
              type: "OPENED",
              message:
                "Incident opened after 3 consecutive failed health checks."
            }
          }
        }
      });

      expect(mocks.incidentUpdate).not.toHaveBeenCalled();
    });

    it("does not create a duplicate incident when one is already open", async () => {
      mocks.healthCheckFindMany.mockResolvedValue([
        { success: false, checkedAt: new Date() },
        { success: false, checkedAt: new Date() },
        { success: false, checkedAt: new Date() },
      ]);

      mocks.incidentFindFirst.mockResolvedValue({
        id: "incident-123",
        status: "OPEN"
      });

      await processIncidentState(monitorId, monitorName);

      expect(mocks.incidentCreate).not.toHaveBeenCalled();
      expect(mocks.incidentUpdate).not.toHaveBeenCalled();
    });

    it("resolves an open incident after two consecutive successes", async () => {
      const openIncident = {
        id: "incident-123",
        status: "OPEN"
      };

      mocks.healthCheckFindMany.mockResolvedValue([
        { success: true, checkedAt: new Date() },
        { success: true, checkedAt: new Date() },
        { success: false, checkedAt: new Date() }
      ]);

      mocks.incidentFindFirst.mockResolvedValue(openIncident);

      await processIncidentState(monitorId, monitorName);

      expect(mocks.incidentUpdate).toHaveBeenCalledWith({
        where: {
          id: "incident-123"
        },
        data: {
          status: "RESOLVED",
          resolvedAt: expect.any(Date),
          events: {
            create: {
              type: "RESOLVED",
              message:
                "Incident resolved after 2 consecutive successful health checks."
            }
          }
        }
      });

      expect(mocks.incidentCreate).not.toHaveBeenCalled();
    });

    it("does nothing when successful checks exist but there is no open incident", async () => {
      mocks.healthCheckFindMany.mockResolvedValue([
        { success: true, checkedAt: new Date() },
        { success: true, checkedAt: new Date() },
        { success: true, checkedAt: new Date() }
      ]);

      mocks.incidentFindFirst.mockResolvedValue(null);

      await processIncidentState(monitorId, monitorName);

      expect(mocks.incidentCreate).not.toHaveBeenCalled();
      expect(mocks.incidentUpdate).not.toHaveBeenCalled();
    });

    it("does not create an incident when fewer than three checks exist", async () => {
      mocks.healthCheckFindMany.mockResolvedValue([
        { success: false, checkedAt: new Date() },
        { success: false, checkedAt: new Date() }
      ]);

      await processIncidentState(monitorId, monitorName);

      expect(mocks.incidentCreate).not.toHaveBeenCalled();
      expect(mocks.incidentUpdate).not.toHaveBeenCalled();
    });
  });

// Incident listing tests

  describe("listIncidents", () => {
    it("returns incidents with monitor details and event counts", async () => {
      const incidents = [
        {
          id: "incident-1",
          title: "Production API is unavailable",
          status: "OPEN",
          monitor: {
            id: monitorId,
            name: monitorName,
            url: "https://api.example.com"
          },
          _count: {
            events: 2
          }
        }
      ];

      mocks.incidentFindMany.mockResolvedValue(incidents);

      const result = await listIncidents();

      expect(result).toEqual(incidents);

      expect(mocks.incidentFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startedAt: "desc" },
        take: 50,
        include: {
          monitor: {
            select: {
              id: true,
              name: true,
              url: true
            }
          },
          _count: {
            select: {
              events: true
            }
          }
        }
      });
    });

    it("filters incidents by status", async () => {
      mocks.incidentFindMany.mockResolvedValue([]);

      await listIncidents("OPEN");

      expect(mocks.incidentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "OPEN" }
        })
      );
    });

    it("supports a custom limit", async () => {
      mocks.incidentFindMany.mockResolvedValue([]);

      await listIncidents(undefined, 10);

      expect(mocks.incidentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });

    it("returns an empty array when no incidents exist", async () => {
      mocks.incidentFindMany.mockResolvedValue([]);

      const result = await listIncidents();

      expect(result).toEqual([]);
    });
  });

// Individual incident retrieval tests

  describe("getIncidentById", () => {
    it("returns an incident with monitor details and chronological events", async () => {
      const incident = {
        id: "incident-123",
        title: "Production API is unavailable",
        status: "OPEN",
        monitor: {
          id: monitorId,
          name: monitorName,
          url: "https://api.example.com"
        },
        events: [
          {
            id: "event-1",
            type: "OPENED",
            message: "Incident opened"
          },
          {
            id: "event-2",
            type: "RESOLVED",
            message: "Incident resolved"
          }
        ]
      };

      mocks.incidentFindUnique.mockResolvedValue(incident);

      const result = await getIncidentById("incident-123");

      expect(result).toEqual(incident);

      expect(mocks.incidentFindUnique).toHaveBeenCalledWith({
        where: {
          id: "incident-123"
        },
        include: {
          monitor: {
            select: {
              id: true,
              name: true,
              url: true
            },
          },
          events: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      });
    });

    it("returns null when the incident does not exist", async () => {
      mocks.incidentFindUnique.mockResolvedValue(null);

      const result = await getIncidentById("nonexistent-id");

      expect(result).toBeNull();

      expect(mocks.incidentFindUnique).toHaveBeenCalledWith({
        where: {
          id: "nonexistent-id"
        },
        include: {
          monitor: {
            select: {
              id: true,
              name: true,
              url: true
            },
          },
          events: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      });
    });
  });
});
