"use client";

import { useEffect, useState } from "react";

type Monitor = {
  id: string;
  name: string;
  url: string;
  method: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  latencyThresholdMs: number;
  enabled: boolean;
  createdAt: string;
};

type Metrics = {
  monitorId: string;
  period: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  availabilityPercentage: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
};

type HealthCheck = {
  id: string;
  checkedAt: string;
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
};

export default function MonitorOverview({ monitorId }: { monitorId: string; }){
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try{
        const [monitorRes, metricsRes, checksRes] = await Promise.all([
          fetch(`/api/monitors/${monitorId}`),
          fetch(`/api/monitors/${monitorId}/metrics?period=24h`),
          fetch(`/api/monitors/${monitorId}/checks?limit=20`)
        ]);

        const [monitorData, metricsData, checksData] = await Promise.all([
          monitorRes.json(),
          metricsRes.json(),
          checksRes.json()
        ]);

        if(!monitorRes.ok){
          throw new Error(monitorData.error || "Failed to load monitor");
        }

        if(!metricsRes.ok){
          throw new Error(metricsData.error || "Failed to load metrics");
        }

        if(!checksRes.ok){
          throw new Error(checksData.error || "Failed to load checks");
        }

        if (cancelled) return;

        setMonitor(monitorData.data);
        setMetrics(metricsData.data);
        setChecks(checksData.data);
      } catch(err){
        if(!cancelled){
          setError(err instanceof Error ? err.message : "Failed to load monitor data");
        }
      } finally{
        if(!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  if(loading){
    return <p>Loading monitor details...</p>;
  }

  if(error){
    return <p className="text-red-600">{error}</p>;
  }

  if(!monitor || !metrics){
    return <p>Monitor data unavailable.</p>;
  }

  const metricCards = [
    { label: "Availability", value: `${metrics.availabilityPercentage}%` },
    { label: "Total Checks", value: metrics.totalChecks },
    { label: "Successful Checks", value: metrics.successfulChecks },
    { label: "Failed Checks", value: metrics.failedChecks },
    { label: "Average Latency", value: `${metrics.averageLatencyMs} ms` },
    { label: "P50 Latency", value: `${metrics.p50LatencyMs} ms` },
    { label: "P95 Latency", value: `${metrics.p95LatencyMs} ms` },
    { label: "P99 Latency", value: `${metrics.p99LatencyMs} ms` }
  ];

  return(
    <div className="space-y-8">
      <section className="rounded-lg border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{monitor.name}</h2>
            <p className="break-all text-sm text-gray-500">{monitor.url}</p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm ${
              monitor.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {monitor.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>Method: <strong>{monitor.method}</strong></p>
          <p>Interval: <strong>{monitor.intervalSeconds}s</strong></p>
          <p>Timeout: <strong>{monitor.timeoutMs}ms</strong></p>
          <p>Expected status: <strong>{monitor.expectedStatus}</strong></p>
          <p>Latency threshold: <strong>{monitor.latencyThresholdMs}ms</strong></p>
          <p>
            Created:{" "}
            <strong>{new Date(monitor.createdAt).toLocaleString()}</strong>
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Metrics — Last 24 Hours
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric) => (
            <div key={metric.label} className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent Health Checks</h2>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Result</th>
                <th className="p-3">Status Code</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>

            <tbody>
              {checks.map((check) => (
                <tr key={check.id} className="border-t">
                  <td className="whitespace-nowrap p-3">
                    {new Date(check.checkedAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        check.success ? "text-green-600" : "text-red-600"
                      }
                    >
                      {check.success ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td className="p-3">{check.statusCode ?? "—"}</td>
                  <td className="p-3">{check.latencyMs} ms</td>
                  <td className="max-w-xs truncate p-3">
                    {check.errorMessage ?? check.errorType ?? "—"}
                  </td>
                </tr>
              ))}

              {checks.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No health checks recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
