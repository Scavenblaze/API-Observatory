"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type IncidentEvent = {
  id: string;
  type: "OPENED" | "RESOLVED";
  message: string;
  createdAt: string;
};

type Incident = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "RESOLVED";
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  monitor: {
    id: string;
    name: string;
    url: string;
  };
  events: IncidentEvent[];
};

export default function IncidentDetailsPage(){
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadIncident = async() => {
      try{
        const response = await fetch(`/api/incidents/${id}`);
        const result = await response.json();

        if(!response.ok){
          throw new Error(result.error || "Failed to load incident");
        }

        if(!cancelled){
          setIncident(result.data);
        }
      } catch(err){
        if(!cancelled){
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally{
        if(!cancelled){
          setLoading(false);
        }
      }
    }

    loadIncident();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if(loading){
    return <main className="p-6">Loading incident...</main>;
  }

  if(error || !incident){
    return(
      <main className="space-y-4 p-6">
        <p className="text-red-600">
          {error || "Incident not found"}
        </p>
        <button
          onClick={() => router.push("/incidents")}
          className="text-blue-600 hover:underline"
        >
          Back to incidents
        </button>
      </main>
    );
  }

  const durationMs = (incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : Date.now()) - new Date(incident.startedAt).getTime();

  const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  const duration = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;

  return(
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <button
        onClick={() => router.push("/incidents")}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to incidents
      </button>

      {/* Incident Header */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{incident.title}</h1>

          <span
            className={`rounded-full px-3 py-1 text-sm ${
              incident.status === "OPEN"
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {incident.status}
          </span>
        </div>

        {incident.description && (
          <p className="text-gray-600">{incident.description}</p>
        )}
      </section>

      {/* Incident Information */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Affected Monitor</p>
          <p className="mt-2 font-semibold">{incident.monitor.name}</p>
          <p className="mt-1 break-all text-sm text-gray-500">
            {incident.monitor.url}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Incident Duration</p>
          <p className="mt-2 text-2xl font-semibold">{duration}</p>
          <p className="mt-1 text-sm text-gray-500">
            {incident.status === "OPEN" ? "Currently ongoing" : "Time until resolution"}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Started At</p>
          <p className="mt-2 font-medium">
            {new Date(incident.startedAt).toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Resolved At</p>
          <p className="mt-2 font-medium">
            {incident.resolvedAt
              ? new Date(incident.resolvedAt).toLocaleString()
              : "Not resolved"}
          </p>
        </div>
      </section>

      {/* Event Timeline */}
      <section>
        <h2 className="mb-6 text-xl font-semibold">Incident Timeline</h2>

        {incident.events.length === 0 ? (
          <p className="text-gray-500">No events recorded.</p>
        ) : (
          <div className="relative space-y-6 border-l-2 border-gray-200 pl-6">
            {incident.events.map((event) => (
              <div key={event.id} className="relative">
                <span
                  className={`absolute -left-7.75 top-1 h-3 w-3 rounded-full ${
                    event.type === "OPENED" ? "bg-red-500" : "bg-green-500"
                  }`}
                />

                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {event.type === "OPENED"
                        ? "Incident Opened"
                        : "Incident Resolved"}
                    </span>

                    <time className="text-sm text-gray-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>

                  <p className="mt-2 text-sm text-gray-600">
                    {event.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
