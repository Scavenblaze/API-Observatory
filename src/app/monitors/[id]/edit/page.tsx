"use client";

import { useEffect, useState, SubmitEvent } from "react";
import { useParams, useRouter } from "next/navigation";

type MonitorFormData = {
  name: string;
  url: string;
  method: "GET" | "HEAD";
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  latencyThresholdMs: number;
  enabled: boolean;
};

const initialForm: MonitorFormData = {
  name: "",
  url: "",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000,
  enabled: true
};

export default function EditMonitorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [form, setForm] = useState<MonitorFormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadMonitor = async () => {
      try{
        const response = await fetch(`/api/monitors/${id}`);
        const result = await response.json();

        if(!response.ok){
          throw new Error(result.error || "Failed to load monitor");
        }

        setForm({
          name: result.data.name,
          url: result.data.url,
          method: result.data.method,
          intervalSeconds: result.data.intervalSeconds,
          timeoutMs: result.data.timeoutMs,
          expectedStatus: result.data.expectedStatus,
          latencyThresholdMs: result.data.latencyThresholdMs,
          enabled: result.data.enabled
        });
      } catch(err){
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally{
        setLoading(false);
      }
    }

    loadMonitor();
  }, [id]);

  function updateField<K extends keyof MonitorFormData>(field: K, value: MonitorFormData[K]){
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    try{
      const response = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();

      if(!response.ok){
        throw new Error(result.error || "Failed to update monitor");
      }

      router.push("/monitors");
      router.refresh();
    } catch(err){
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally{
      setSaving(false);
    }
  }

  if(loading){
    return <main className="p-6">Loading monitor...</main>;
  }

  if(error && !form.name){
    return (
      <main className="space-y-4 p-6">
        <p className="text-red-600">{error}</p>
        <button onClick={() => router.back()} className="underline">
          Go back
        </button>
      </main>
    );
  }

  return(
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Monitor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update the configuration for this monitor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Monitor Name
          </label>
          <input
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            URL
          </label>
          <input
            required
            type="url"
            value={form.url}
            onChange={(e) => updateField("url", e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            HTTP Method
          </label>
          <select
            value={form.method}
            onChange={(e) =>
              updateField("method", e.target.value as "GET" | "HEAD")
            }
            className="w-full rounded border p-2"
          >
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Check Interval (seconds)
          </label>
          <input
            required
            type="number"
            min={10}
            max={86400}
            value={form.intervalSeconds}
            onChange={(e) =>
              updateField("intervalSeconds", Number(e.target.value))
            }
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Timeout (milliseconds)
          </label>
          <input
            required
            type="number"
            min={1000}
            max={30000}
            value={form.timeoutMs}
            onChange={(e) =>
              updateField("timeoutMs", Number(e.target.value))
            }
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Expected Status Code
          </label>
          <input
            required
            type="number"
            min={100}
            max={599}
            value={form.expectedStatus}
            onChange={(e) =>
              updateField("expectedStatus", Number(e.target.value))
            }
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Latency Threshold (milliseconds)
          </label>
          <input
            required
            type="number"
            min={1}
            max={30000}
            value={form.latencyThresholdMs}
            onChange={(e) =>
              updateField("latencyThresholdMs", Number(e.target.value))
            }
            className="w-full rounded border p-2"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
          />
          <span className="text-sm font-medium">Enable monitor</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/monitors")}
            className="rounded border px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
