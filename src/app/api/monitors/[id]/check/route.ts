import { runHealthCheck } from "@/lib/services/health-check.service";
import { getMonitorById } from "@/lib/services/monitor.service";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse, type NextRequest } from "next/server";
import { validateRequestOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MANUAL_CHECK_LIMIT = 5;
const MANUAL_CHECK_WINDOW = 60;

export async function POST(request: NextRequest, { params }: RouteContext) {

  const originError = validateRequestOrigin(request);

  if (originError) {
    return originError;
  }

  const { user, response } = await authenticateApiRequest();

  if(response) return response;

  let rateLimitResult;

  try{
    rateLimitResult = await rateLimit(`rate-limit:manual-check:${user.id}`, MANUAL_CHECK_LIMIT, MANUAL_CHECK_WINDOW);
  } catch(error){
    console.error("Manual check rate limit failed:", error);

    return NextResponse.json(
      { error: "Rate limiting service unavailable" },
      { status: 503 }
    );
  }

  if(!rateLimitResult.allowed){
    return NextResponse.json(
      {
        error: "Too many manual health check requests",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        retryAfter: rateLimitResult.resetSeconds
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.resetSeconds)
        }
      }
    );
  }

  const { id } = await params;

  try{
    // Verify that this monitor belongs to the authenticated user.
    const monitor = await getMonitorById(id, user.id);

    if(!monitor){
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

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
