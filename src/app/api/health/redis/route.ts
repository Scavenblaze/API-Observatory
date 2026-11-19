import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET(){
  try{
    const result = await redis.ping();
    const isConnected = result === "PONG";

    return NextResponse.json(
      {
        status: isConnected ? "ok" : "error",
        redis: isConnected ? "connected" : "unexpected response",
        timestamp: new Date().toISOString()
      },
      { status: isConnected ? 200 : 503 }
    );
  } catch(error){
    console.error("Redis health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        redis: "unavailable",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
