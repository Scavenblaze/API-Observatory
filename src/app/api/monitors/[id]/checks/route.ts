import { NextRequest, NextResponse } from "next/server";
import { listHealthChecks } from "@/lib/services/health-check.service";
import { getMonitorById } from "@/lib/services/monitor.service";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext){
  const { user, response } = await authenticateApiRequest();

  if(response) return response;

  const { id } = await params;

  // Verify monitor ownership before retrieving its health checks.
  const limitParam = request.nextUrl.searchParams.get("limit");
  let limit = 50;

  if(limitParam !== null){
    if(!/^\d+$/.test(limitParam)){
      return NextResponse.json(
        { error: "Limit must be a positive integer" },
        { status: 400 }
      );
    }

    limit = Number(limitParam);

    if(!Number.isSafeInteger(limit) || limit < 1 || limit > 100){
      return NextResponse.json(
        { error: "Limit must be between 1 and 100" },
        { status: 400 }
      );
    }
  }

  try{
    const monitor = await getMonitorById(id, user.id);

    if (!monitor){
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    const checks = await listHealthChecks(id, limit);

    if(checks === null){
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: checks,
      count: checks.length
    });
  } catch(error){
    console.error("Failed to retrieve health checks:", error);

    return NextResponse.json(
      { error: "Failed to retrieve health checks" },
      { status: 500 }
    );
  }
}
