"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Incident = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "RESOLVED";
  startedAt: string;
  resolvedAt: string | null;
  monitor: {
    name: string;
    url: string;
  };
  _count: {
    events: number;
  };
};

type Filter = "ALL" | "OPEN" | "RESOLVED";

export default function IncidentsPage(){
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError("");

    try{
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const response = await fetch(`/api/incidents${query}`);
      const result = await response.json();

      if(!response.ok){
        throw new Error(result.error || "Failed to load incidents");
      }

      setIncidents(result.data);
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally{
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadIncidents(); }, [loadIncidents]);

  return(
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and investigate service incidents.
          </p>
        </div>

        <button
          onClick={loadIncidents}
          disabled={loading}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(["ALL", "OPEN", "RESOLVED"] as Filter[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded px-4 py-2 text-sm ${
              filter === status
                ? "bg-blue-600 text-white"
                : "border hover:bg-gray-50"
            }`}
          >
            {status === "ALL" ? "All" : status === "OPEN" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <p>Loading incidents...</p>
      ) : incidents.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">
          No incidents found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4">Incident</th>
                <th className="p-4">Monitor</th>
                <th className="p-4">Status</th>
                <th className="p-4">Started</th>
                <th className="p-4">Events</th>
              </tr>
            </thead>

            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id} className="border-t">
                  <td className="p-4">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {incident.title}
                    </Link>
                    {incident.description && (
                      <p className="mt-1 max-w-xs truncate text-gray-500">
                        {incident.description}
                      </p>
                    )}
                  </td>

                  <td className="p-4">
                    <p className="font-medium">{incident.monitor.name}</p>
                    <p className="max-w-xs truncate text-gray-500">
                      {incident.monitor.url}
                    </p>
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        incident.status === "OPEN" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </td>

                  <td className="whitespace-nowrap p-4">
                    {new Date(incident.startedAt).toLocaleString()}
                  </td>

                  <td className="p-4">{incident._count.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
