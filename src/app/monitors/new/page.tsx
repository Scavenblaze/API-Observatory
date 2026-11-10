"use client";

import { SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewMonitorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    url: "",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatus: 200,
    latencyThresholdMs: 1000,
    enabled: true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: string, value: string | number | boolean) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try{
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();

      if(!response.ok){
        throw new Error(result.error ?? "Failed to create monitor");
      }

      router.push("/monitors");
      router.refresh();
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally{
      setLoading(false);
    }
  }

  return(
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link
          href="/monitors"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to monitors
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Add Monitor</h1>

        <p className="mt-1 text-sm text-gray-500">
          Configure an endpoint to monitor.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-gray-200 p-6"
      >
        <section className="space-y-4">
          <h2 className="font-semibold">Basic Configuration</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Monitor Name
            </label>
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Production API"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Endpoint URL
            </label>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://api.example.com/health"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              HTTP Method
            </label>
            <select
              value={form.method}
              onChange={(e) => updateField("method", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
          </div>
        </section>

        <hr className="border-gray-200" />

        <section className="space-y-4">
          <h2 className="font-semibold">Check Configuration</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Check Interval (seconds)
            </label>
            <input
              type="number"
              min={10}
              max={86400}
              required
              value={form.intervalSeconds}
              onChange={(e) =>
                updateField("intervalSeconds", Number(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Minimum 10 seconds.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Request Timeout (milliseconds)
            </label>
            <input
              type="number"
              min={1000}
              max={30000}
              required
              value={form.timeoutMs}
              onChange={(e) =>
                updateField("timeoutMs", Number(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Expected HTTP Status
            </label>
            <input
              type="number"
              min={100}
              max={599}
              required
              value={form.expectedStatus}
              onChange={(e) =>
                updateField("expectedStatus", Number(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Latency Threshold (milliseconds)
            </label>
            <input
              type="number"
              min={1}
              max={30000}
              required
              value={form.latencyThresholdMs}
              onChange={(e) =>
                updateField("latencyThresholdMs", Number(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Checks exceeding this latency are marked unsuccessful.
            </p>
          </div>
        </section>

        <hr className="border-gray-200" />

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">
            Enable monitoring immediately
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <Link
            href="/monitors"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Monitor"}
          </button>
        </div>
      </form>
    </main>
  );
}
