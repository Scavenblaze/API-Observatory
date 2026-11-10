import { NextRequest, NextResponse } from "next/server";
import { getMonitorMetrics, type MetricsPeriod } from "@/lib/services/metrics.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_PERIODS = ["1h", "24h", "7d", "30d"] as const;

export async function GET(request: NextRequest, { params }: RouteContext){
  const { id } = await params;

  const periodParam = request.nextUrl.searchParams.get("period");
  const period: MetricsPeriod = periodParam === null ? "24h" : periodParam as MetricsPeriod;

  if (!VALID_PERIODS.includes(period)){
    return NextResponse.json(
      {
        error: "Invalid period",
        allowedPeriods: VALID_PERIODS
      },
      { status: 400 }
    );
  }

  try{
    const metrics = await getMonitorMetrics(id, period);

    if(!metrics){
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: metrics
    });
  } catch(error){
    console.error("Failed to retrieve monitor metrics:", error);

    return NextResponse.json(
      { error: "Failed to retrieve monitor metrics" },
      { status: 500 }
    );
  }
}