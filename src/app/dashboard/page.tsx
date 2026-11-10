"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface LatestCheck{
  success: boolean;
  statusCode: number | null;
  latencyMs: number;
  checkedAt: string;
}

interface Monitor{
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  latestCheck: LatestCheck | null;
}

interface Incident{
  id: string;
  title: string;
  status: "OPEN" | "RESOLVED";
  startedAt: string;
  resolvedAt: string | null;
  monitor: {
    id: string;
    name: string;
    url: string;
  };
}

interface DashboardData{
  summary: {
    totalMonitors: number;
    operational: number;
    failing: number;
    unchecked: number;
    openIncidents: number;
  };
  monitors: Monitor[];
  recentIncidents: Incident[];
}

const formatDate = (date: string | null) => {
  if(!date) return "—";

  return new Date(date).toLocaleString();
}

const getMonitorStatus = (monitor: Monitor) => {
  if(!monitor.enabled) return "Disabled";
  if(!monitor.latestCheck) return "Unchecked";

  return monitor.latestCheck.success ? "Operational" : "Failing";
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Operational: "bg-green-100 text-green-700",
    Failing: "bg-red-100 text-red-700",
    Disabled: "bg-gray-100 text-gray-600",
    Unchecked: "bg-yellow-100 text-yellow-700",
    OPEN: "bg-red-100 text-red-700",
    RESOLVED: "bg-green-100 text-green-700"
  };

  return(
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

const SummaryCard = ({title, value, description}: {
  title: string;
  value: number;
  description: string;
}) => {
  return(
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>

      <p className="mt-2 text-3xl font-semibold text-gray-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-500">
        {description}
      </p>
    </div>
  );
}

export default function DashboardPage(){
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try{
      setError(null);

      const response = await fetch("/api/dashboard", {
        cache: "no-store"
      });

      if(!response.ok){
        throw new Error("Failed to load dashboard data");
      }

      const result = await response.json();

      setDashboard(result.data);
    } catch(error){
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally{
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  if(loading){
    return(
      <main className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-500">Loading dashboard...</p>
      </main>
    );
  }

  if(error || !dashboard){
    return(
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="rounded-xl border border-red-200 bg-white p-6">
          <p className="text-red-600">
            {error ?? "Unable to load dashboard"}
          </p>

          <button onClick={() => void loadDashboard()} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { summary, monitors, recentIncidents } = dashboard;

  return(
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              API Reliability Observatory
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitor your APIs and track their reliability.
            </p>
          </div>

          <button
          onClick={() => void loadDashboard()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer">
            Refresh
          </button> 
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
          title="Total Monitors"
          value={summary.totalMonitors}
          description="Registered monitors"
          />

          <SummaryCard
          title="Operational"
          value={summary.operational}
          description="Latest check succeeded"
          />

          <SummaryCard
          title="Failing"
          value={summary.failing}
          description="Latest check failed"
          />

          <SummaryCard
          title="Unchecked"
          value={summary.unchecked}
          description="No health checks recorded"
          />

          <SummaryCard
          title="Open Incidents"
          value={summary.openIncidents}
          description="Incidents requiring attention"
          />
        </section>

        {/* Monitors */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <div>
              <h2 className="font-semibold text-gray-900">
                Monitors
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Current health status of monitored endpoints.
              </p>
            </div>

            <Link
            href="/monitors"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>

          {monitors.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              No monitors have been created yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Monitor</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">HTTP Status</th>
                    <th className="px-5 py-3">Latency</th>
                    <th className="px-5 py-3">Last Checked</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {monitors.map((monitor) => (
                    <tr
                    key={monitor.id}
                    className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                        href={`/monitors/${monitor.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600">
                          {monitor.name}
                        </Link>

                        <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                          {monitor.url}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={getMonitorStatus(monitor)}/>
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {monitor.latestCheck?.statusCode ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {monitor.latestCheck ? `${monitor.latestCheck.latencyMs} ms` : "—" }
                      </td>

                      <td className="px-5 py-4 text-gray-500">
                        {formatDate(
                          monitor.latestCheck?.checkedAt ?? null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent incidents */}
        <section className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <div>
              <h2 className="font-semibold text-gray-900">
                Recent Incidents
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Latest detected outages and recoveries.
              </p>
            </div>

            <Link
              href="/incidents"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>

          {recentIncidents.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              No incidents recorded.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {incident.title}
                    </Link>

                    <p className="mt-1 text-sm text-gray-500">
                      {incident.monitor.name}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Started: {formatDate(incident.startedAt)}
                    </p>
                  </div>

                  <StatusBadge status={incident.status} />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
