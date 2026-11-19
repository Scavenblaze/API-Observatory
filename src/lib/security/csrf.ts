
import { NextResponse } from "next/server";

export function validateRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return NextResponse.json(
      { error: "Missing request origin" },
      { status: 403 }
    );
  }

  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    console.error("APP_URL is not configured");

    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  let expectedOrigin: string;

  try {
    expectedOrigin = new URL(appUrl).origin;
  } catch {
    console.error("APP_URL is invalid");

    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (origin !== expectedOrigin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  return null;
}
