import { prisma } from "@/lib/db";

const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 2;

export async function processIncidentState(monitorId: string, monitorName: string){
  //fetch recent health checks
  const recentChecks = await prisma.healthCheck.findMany({
    where: { monitorId },
    orderBy: [
      { checkedAt: "desc" },
      { id: "desc" }
    ],
    take: FAILURE_THRESHOLD,
    select: {
      success: true,
      checkedAt: true
    }
  });

  const consecutiveFailures = recentChecks.length === FAILURE_THRESHOLD && recentChecks.every((check) => !check.success);

  const consecutiveSuccesses = recentChecks.length >= RECOVERY_THRESHOLD && recentChecks.slice(0, RECOVERY_THRESHOLD).every((check) => check.success);

  const openIncident = await prisma.incident.findFirst({
    where: {
      monitorId,
      status: "OPEN"
    }
  });

  //open an incident after consecutive failures
  if(consecutiveFailures && !openIncident){
    await prisma.incident.create({
      data: {
        monitorId,
        title: `${monitorName} is unavailable`,
        description: `${FAILURE_THRESHOLD} consecutive health checks failed.`,
        startedAt: recentChecks[FAILURE_THRESHOLD - 1].checkedAt,
        events: {
          create: {
            type: "OPENED",
            message: `Incident opened after ${FAILURE_THRESHOLD} consecutive failed health checks.`
          }
        }
      }
    });

    return;
  }

  //resolve an incident after consecutive successes
  if(consecutiveSuccesses && openIncident){
    await prisma.incident.update({
      where: {
        id: openIncident.id
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        events: {
          create: {
            type: "RESOLVED",
            message: `Incident resolved after ${RECOVERY_THRESHOLD} consecutive successful health checks.`
          }
        }
      }
    });
  }
}



type IncidentStatus = "OPEN" | "RESOLVED";

export async function listIncidents(status?: IncidentStatus, limit = 50){
  return prisma.incident.findMany({
    where: status ? { status } : {},
    orderBy: {
      startedAt: "desc"
    },
    take: limit,
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
}

export async function getIncidentById(id: string){
  return prisma.incident.findUnique({
    where: { id },
    include: {
      monitor: {
        select: {
          id: true,
          name: true,
          url: true
        }
      },
      events: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}
