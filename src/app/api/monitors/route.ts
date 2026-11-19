
import { NextRequest, NextResponse } from "next/server";
import { createMonitorSchema } from "@/lib/validators/monitor.schema";
import {
  createMonitor,
  listMonitors,
  MonitorQuotaExceededError,
} from "@/lib/services/monitor.service";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { validateRequestOrigin } from "@/lib/security/csrf";

const CREATE_MONITOR_LIMIT = 10;
const CREATE_MONITOR_WINDOW = 60;

export async function GET() {
  const { user, response } = await authenticateApiRequest();

  if (response) return response;

  try {
    const monitors = await listMonitors(user.id);

    return NextResponse.json({
      data: monitors,
      count: monitors.length,
    });
  } catch (error) {
    console.error("Failed to list monitors:", error);

    return NextResponse.json(
      { error: "Failed to retrieve monitors" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  const originError = validateRequestOrigin(request);

  if (originError) {
    return originError;
  }
  const { user, response } = await authenticateApiRequest();

  if (response) return response;

  // Apply per-user rate limit.
  let rateLimitResult;

  try {
    rateLimitResult = await rateLimit(
      `rate-limit:monitor-create:${user.id}`,
      CREATE_MONITOR_LIMIT,
      CREATE_MONITOR_WINDOW
    );
  } catch (error) {
    console.error("Monitor creation rate limit failed:", error);

    return NextResponse.json(
      { error: "Rate limiting service unavailable" },
      { status: 503 }
    );
  }

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many monitor creation requests",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        retryAfter: rateLimitResult.resetSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.resetSeconds),
        },
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const result = createMonitorSchema.safeParse(body);

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
    const monitor = await createMonitor({
      ...result.data,
      userId: user.id,
    });

    return NextResponse.json(
      { data: monitor },
      { status: 201 }
    );
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

    console.error("Failed to create monitor:", error);

    return NextResponse.json(
      { error: "Failed to create monitor" },
      { status: 500 }
    );
  }
}
