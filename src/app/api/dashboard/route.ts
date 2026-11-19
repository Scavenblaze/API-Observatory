import { getDashboardOverview } from "@/lib/services/dashboard.service";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";
import { NextResponse } from "next/server";

export async function GET(){
  const { user, response } = await authenticateApiRequest();

  if(response) return response;

  try{
    const overview = await getDashboardOverview(user.id);

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
