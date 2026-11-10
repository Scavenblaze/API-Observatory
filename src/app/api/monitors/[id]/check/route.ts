import { runHealthCheck } from "@/lib/services/health-check.service";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: RouteContext){
  const { id } = await params;

  try{
    const result = await runHealthCheck(id);

    if(!result){
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: result },
      { status: 201 }
    );
  } catch(error){
    if(error instanceof Error && error.message === "MONITOR_DISABLED"){
      return NextResponse.json(
        { error: "Cannot run a health check for a disabled monitor" },
        { status: 409 }
      );
    }

    console.error("Failed to run health check:", error);

    return NextResponse.json(
      { error: "Failed to run health check" },
      { status: 500 }
    );
  }
}