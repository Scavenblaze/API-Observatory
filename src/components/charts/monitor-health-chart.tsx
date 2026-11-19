"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type HealthCheck = {
  id: string;
  checkedAt: string;
  latencyMs: number;
  success: boolean;
  statusCode: number | null;
};

type ChartData = {
  time: string;
  latency: number | null;
  availability: number;
};

type Props = {
  monitorId: string;
};

export default function MonitorHealthChart({ monitorId }: Props){
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    
    useEffect(() => {
    let cancelled = false;
    let isFetching = false;

    const fetchChecks = async () => {
        // Prevent overlapping requests.
        if(isFetching) return;

        isFetching = true;

        try{
        const response = await fetch(
            `/api/monitors/${monitorId}/checks`,
            { cache: "no-store" },
        );

        if(!response.ok){
            throw new Error("Failed to fetch health checks");
        }

        const result = await response.json();
        const checks: HealthCheck[] = result.data;

        if(!Array.isArray(checks)){
            throw new Error("Invalid health check response");
        }

        const chartData = checks.slice().reverse().map((check) => ({
            time: new Date(check.checkedAt).toLocaleString(),
            latency: check.success ? check.latencyMs : null,
            availability: check.success ? 100 : 0
            }));

        if(!cancelled){
            setData(chartData);
            setError(null);
        }
        } catch(err){
        if(!cancelled){
            setError(err instanceof Error ? err.message : "Something went wrong");
        }
        } finally{
        isFetching = false;

            if(!cancelled){
                setLoading(false);
            }
        }
    }

    // Fetch immediately when the component mounts.
    fetchChecks();

    // Fetch updated data every 5 seconds.
    const intervalId = setInterval(fetchChecks, 5000);

    return () => {
        cancelled = true;
        clearInterval(intervalId);
    };
    }, [monitorId]);


  if(loading){
    return <p className="text-sm text-gray-500">Loading charts...</p>;
  }

  if(error){
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if(data.length === 0){
    return <p className="text-sm text-gray-500">No health check data available.</p>;
  }

  return(
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">Response Latency</h2>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                label={{
                  value: "Latency (ms)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="latency"
                name="Latency"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">Check Availability</h2>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value) => [
                  `${value}%`,
                  "Availability"
                ]}
              />
              <Line
                type="stepAfter"
                dataKey="availability"
                name="Availability"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
