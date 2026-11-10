"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Monitor = {
  id: string;
  name: string;
  url: string;
  method: string;
  intervalSeconds: number;
  enabled: boolean;
  createdAt: string;
};

export default function MonitorsPage(){
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitors = useCallback(async () => {
    try{
      setError(null);

      const response = await fetch("/api/monitors", { cache: "no-store" });

      if(!response.ok){
        throw new Error("Failed to fetch monitors");
      }

      const result = await response.json();

      if(!Array.isArray(result.data)){
        throw new Error("Invalid monitor response");
      }

      setMonitors(result.data);
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally{
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMonitors(); }, [fetchMonitors]);

  async function toggleMonitor(monitor: Monitor){
    try{
      const response = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          enabled: !monitor.enabled
        })
      });

      if(!response.ok){
        throw new Error("Failed to update monitor");
      }

      await fetchMonitors();
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function deleteMonitor(monitor: Monitor){
    const confirmed = window.confirm(`Delete "${monitor.name}"? This will also delete its health checks and incidents.`);

    if(!confirmed) return;

    try{
      const response = await fetch(`/api/monitors/${monitor.id}`, { method: "DELETE" });

      if(!response.ok){
        throw new Error("Failed to delete monitor");
      }

      await fetchMonitors();
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if(loading){
    return <p className="p-6 text-gray-500">Loading monitors...</p>;
  }

  return(
    <main className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your monitored endpoints.
          </p>
        </div>

        <Link
          href="/monitors/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Monitor
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {monitors.length === 0 ? (
        <div className="rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600">No monitors created yet.</p>
          <Link
            href="/monitors/new"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Create your first monitor
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-5 py-3">Monitor</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Interval</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {monitors.map((monitor) => (
                <tr key={monitor.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/monitors/${monitor.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {monitor.name}
                    </Link>
                    <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                      {monitor.url}
                    </p>
                  </td>

                  <td className="px-5 py-4">{monitor.method}</td>

                  <td className="px-5 py-4">
                    {monitor.intervalSeconds}s
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        monitor.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {monitor.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {new Date(monitor.createdAt).toLocaleDateString()}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleMonitor(monitor)}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        {monitor.enabled ? "Disable" : "Enable"}
                      </button>

                      <Link
                        href={`/monitors/${monitor.id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>

                      <button
                        onClick={() => deleteMonitor(monitor)}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>  
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}