import { getDashboardOverview } from "@/lib/services/dashboard.service";
import { NextResponse } from "next/server";

export async function GET(){
  try{
    const overview = await getDashboardOverview();

    return NextResponse.json({
      data: overview
    });
  } catch(error){
    console.error("Failed to retrieve dashboard overview:", error);

    return NextResponse.json(
      { error: "Failed to retrieve dashboard overview" },
      { status: 500 }
    );
  }
}
