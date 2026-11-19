import { NextResponse } from "next/server";
import { getIncidentById } from "@/lib/services/incident.service";
import { authenticateApiRequest } from "@/lib/supabase/api-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext){
  const { user, response } = await authenticateApiRequest();

  if(response) return response;

  const { id } = await params;

  try{
    const incident = await getIncidentById(id, user.id);

    if(!incident){
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: incident
    });
  } catch(error){
    console.error("Failed to retrieve incident:", error);

    return NextResponse.json(
      { error: "Failed to retrieve incident" },
      { status: 500 }
    );
  }
}
