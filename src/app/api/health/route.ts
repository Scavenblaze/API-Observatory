import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(){
    try{
        await prisma.$queryRaw`SELECT 1`;
        
        return NextResponse.json(
        {
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString()
        },
        { status: 200 }
    );
    } catch(error){
        console.error("Health check failed:", error);
        return NextResponse.json(
            {
                status: "error",
                database: "unavailable",
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        );
    }
}