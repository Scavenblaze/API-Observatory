import { prisma } from "@/lib/db";

export async function getDashboardOverview(){
  const [monitors, openIncidentCount, recentIncidents] = await Promise.all([
    prisma.monitor.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        checks: {
          orderBy: {
            checkedAt: "desc",
          },
          take: 1,
          select: {
            success: true,
            statusCode: true,
            latencyMs: true,
            checkedAt: true
          }
        }
      }
    }),

    prisma.incident.count({
      where: {
        status: "OPEN"
      }
    }),

    prisma.incident.findMany({
      orderBy: {
        startedAt: "desc"
      },
      take: 5,
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
            url: true
          }
        }
      }
    })
  ]);

  // Only enabled monitors contribute to operational status.
  const enabledMonitors = monitors.filter((monitor) => monitor.enabled);

  const operational = enabledMonitors.filter((monitor) => monitor.checks[0]?.success === true).length;

  const failing = enabledMonitors.filter((monitor) => monitor.checks[0]?.success === false).length;

  const unchecked = enabledMonitors.filter((monitor) => monitor.checks.length === 0).length;

  return {
    summary: {
      totalMonitors: monitors.length,
      operational,
      failing,
      unchecked,
      openIncidents: openIncidentCount
    },

    monitors: monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      enabled: monitor.enabled,
      latestCheck: monitor.checks[0] ?? null
    })),

    recentIncidents
  };
}
