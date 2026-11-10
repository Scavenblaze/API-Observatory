import { NextResponse } from "next/server";
import { getIncidentById } from "@/lib/services/incident.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext){
  const { id } = await params;

  try{
    const incident = await getIncidentById(id);

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
