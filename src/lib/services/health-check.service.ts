import { prisma } from "@/lib/db";
import { checkMonitor } from "@/lib/monitoring/check-monitor";
import { processIncidentState } from "@/lib/services/incident.service";

export async function runHealthCheck(monitorId: string){
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId }
  });

  if(!monitor){
    return null;
  }

  if(!monitor.enabled){
    throw new Error("MONITOR_DISABLED");
  }

  const result = await checkMonitor({
    url: monitor.url,
    method: monitor.method as "GET" | "HEAD",
    timeoutMs: monitor.timeoutMs,
    expectedStatus: monitor.expectedStatus,
    latencyThresholdMs: monitor.latencyThresholdMs
  });

  const healthCheck = await prisma.healthCheck.create({
    data: {
      monitorId: monitor.id,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      success: result.success,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
      responseSize: result.responseSize
    }
  });

  try{
    await processIncidentState(monitor.id, monitor.name);
  } catch(error){
    console.error("Incident processing failed:", error);
  }

  return healthCheck;
}

export async function listHealthChecks(monitorId: string, limit = 50){
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { id: true }
  });

  if(!monitor){
    return null;
  }

  return prisma.healthCheck.findMany({
    where: { monitorId },
    orderBy: { checkedAt: "desc" },
    take: limit
  });
}