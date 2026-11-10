import { NextRequest, NextResponse } from "next/server";
import { listIncidents } from "@/lib/services/incident.service";

const VALID_STATUSES = ["OPEN", "RESOLVED"] as const;

export async function GET(request: NextRequest){
  const statusParam = request.nextUrl.searchParams.get("status");
  const limitParam = request.nextUrl.searchParams.get("limit");

  if(statusParam !== null && !VALID_STATUSES.some((status) => status === statusParam)){
    return NextResponse.json(
      {
        error: "Invalid status",
        allowedStatuses: VALID_STATUSES
      },
      { status: 400 }
    );
  }

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
    const status = statusParam === null ? undefined : (statusParam as "OPEN" | "RESOLVED");
    const incidents = await listIncidents(status, limit);

    return NextResponse.json({
      data: incidents,
      count: incidents.length
    });
  } catch(error){
    console.error("Failed to retrieve incidents:", error);

    return NextResponse.json(
      { error: "Failed to retrieve incidents" },
      { status: 500 }
    );
  }
}
