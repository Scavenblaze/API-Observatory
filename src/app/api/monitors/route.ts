import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createMonitorSchema } from "@/lib/validators/monitor.schema";
import { createMonitor, listMonitors } from "@/lib/services/monitor.service";

export async function GET(){
  try {
    const monitors = await listMonitors();

    return NextResponse.json({
      data: monitors,
      count: monitors.length
    });
  } catch (error) {
    console.error("Failed to list monitors:", error);

    return NextResponse.json(
      { error: "Failed to retrieve monitors" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest){
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const result = createMonitorSchema.safeParse(body);

  if(!result.success){
    return NextResponse.json(
      {
        error: "Invalid monitor configuration",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const monitor = await createMonitor(result.data);

    return NextResponse.json(
      { data: monitor },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create monitor:", error);

    return NextResponse.json(
      { error: "Failed to create monitor" },
      { status: 500 },
    );
  }
}