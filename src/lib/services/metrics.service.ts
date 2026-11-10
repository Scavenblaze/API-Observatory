import { prisma } from "@/lib/db";

export type MetricsPeriod = "1h" | "24h" | "7d" | "30d";

interface MetricsResult{
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  availabilityPercentage: number;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

const PERIOD_IN_MS: Record<MetricsPeriod, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

export async function getMonitorMetrics(monitorId: string, period: MetricsPeriod = "24h"){
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { id: true }
  });

  if(!monitor){
    return null;
  }

  const since = new Date(Date.now() - PERIOD_IN_MS[period]);

  const rows = await prisma.$queryRaw<MetricsResult[]>
  `
    SELECT
      COUNT(*)::int AS "totalChecks",

      COUNT(*) FILTER (WHERE "success" = TRUE)::int AS "successfulChecks",

      COUNT(*) FILTER (WHERE "success" = FALSE)::int AS "failedChecks",

      COALESCE(
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE "success" = TRUE)
          / NULLIF(COUNT(*), 0),
          2
        ),
        0
      )::float8 AS "availabilityPercentage",

      ROUND(
        AVG("latencyMs") FILTER (WHERE "success" = TRUE)
      )::int AS "averageLatencyMs",

      (
        percentile_cont(0.50)
        WITHIN GROUP (ORDER BY "latencyMs")
        FILTER (WHERE "success" = TRUE)
      )::int AS "p50LatencyMs",

      (
        percentile_cont(0.95)
        WITHIN GROUP (ORDER BY "latencyMs")
        FILTER (WHERE "success" = TRUE)
      )::int AS "p95LatencyMs",

      (
        percentile_cont(0.99)
        WITHIN GROUP (ORDER BY "latencyMs")
        FILTER (WHERE "success" = TRUE)
      )::int AS "p99LatencyMs"

    FROM "HealthCheck"
    WHERE "monitorId" = ${monitorId} AND "checkedAt" >= ${since}
  `;

  return{
    monitorId,
    period,
    ...rows[0]
  };
}