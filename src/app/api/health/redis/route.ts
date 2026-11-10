import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET(){
  try{
    const result = await redis.ping();

    return NextResponse.json({
      status: result === "PONG" ? "ok" : "error",
      redis: result === "PONG" ? "connected" : "unexpected response"
    });
  } catch(error){
    console.error("Redis health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        redis: "unavailable"
      },
      { status: 503 }
    );
  }
}