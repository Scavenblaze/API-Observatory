
import {
  deleteMonitor,
  getMonitorById,
  updateMonitor,
  MonitorQuotaExceededError,
} from "@/lib/services/monitor.service";
import { updateMonitorSchema } from "@/lib/validators/monitor.schema";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { validateRequestOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { user, response } = await authenticateApiRequest();

  if (response) return response;

  const { id } = await params;

  try {
    const monitor = await getMonitorById(id, user.id);

    if (!monitor) {
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: monitor });
  } catch (error) {
    console.error("Failed to retrieve monitor:", error);

    return NextResponse.json(
      { error: "Failed to retrieve monitor" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {

  const originError = validateRequestOrigin(request);

  if (originError) {
    return originError;
  }
  const { user, response } = await authenticateApiRequest();

  if (response) return response;

  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length === 0
  ) {
    return NextResponse.json(
      { error: "Request body must be a non-empty JSON object" },
      { status: 400 }
    );
  }

  const result = updateMonitorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid monitor configuration",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const monitor = await updateMonitor(
      id,
      user.id,
      result.data
    );

    if (!monitor) {
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: monitor });
  } catch (error) {
    if (error instanceof MonitorQuotaExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          quota: error.quota,
        },
        { status: 409 }
      );
    }

    console.error("Failed to update monitor:", error);

    return NextResponse.json(
      { error: "Failed to update monitor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {

  const originError = validateRequestOrigin(request);

  if (originError) {
    return originError;
  }

  const { user, response } = await authenticateApiRequest();

  if (response) return response;

  const { id } = await params;

  try {
    const deleted = await deleteMonitor(id, user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete monitor:", error);

    return NextResponse.json(
      { error: "Failed to delete monitor" },
      { status: 500 }
    );
  }
}
