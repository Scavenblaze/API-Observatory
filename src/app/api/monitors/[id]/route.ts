import { deleteMonitor, getMonitorById, updateMonitor } from "@/lib/services/monitor.service";
import { createMonitorSchema } from "@/lib/validators/monitor.schema";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
    params: Promise<{id: string}>;
}

export async function GET(_request: NextRequest, {params}: RouteContext){
    const {id} = await params;
    
    try{
        const monitor = await getMonitorById(id);
        if(!monitor){
            return NextResponse.json(
                {error: "Monitor not found"},
                {status: 404}
            );
        }

        return NextResponse.json({data: monitor});

    } catch(error){
        console.error("Failed to retrieve monitor: ", error);

        return NextResponse.json(
            {error: "Failed to retrieve monitor"},
            {status: 500}
        );
    }
}

export async function PATCH(request: NextRequest, {params}: RouteContext){
    const {id} = await params;
    let body: unknown;

    try{
        body = await request.json();
    } catch{
        return NextResponse.json(
            {error: "Request body must be valid JSON"},
            {status: 400}
        );
    }

    if(typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length === 0){
        return NextResponse.json(
            {error: "Request body must be a non-empty JSON object"},
            {status: 400}
        );
    }

    //reuse create schema but with everyy field as optional
    const updateSchema = createMonitorSchema.partial().strict();
    const result = updateSchema.safeParse(body);

    if(!result.success){
        return NextResponse.json(
            {
                error: "Invalid monitor configuration",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            },
            {status: 400}
        );
    }

    try{
        const existingMonitor = await getMonitorById(id);

        if(!existingMonitor){
            return NextResponse.json(
                {error: "Monitor not found"},
                {status: 404}
            );
        }

        const updateData = Object.fromEntries(
            Object.keys(body).map((key) => [
                key,
                result.data[key as keyof typeof result.data],
            ])
        );

        const monitor = await updateMonitor(id, updateData);

        return NextResponse.json({data: monitor});
    } catch(error){
        console.error("Failed to update monitor", error);

        return NextResponse.json(
            {error: "Failed to update monitor"},
            {status: 500}
        );
    }
}

export async function DELETE(_request: NextRequest, {params}: RouteContext){
    const {id} = await params;

    try{
        const existingMonitor = await getMonitorById(id);
        
        if(!existingMonitor){
            return NextResponse.json(
                {error: "Monitor not found"},
                {status: 404}
            );
        }

        await deleteMonitor(id);
        return new NextResponse(null, {status: 204});
    } catch(error){
        console.error("Failed to delete monitor: ", error);

        return NextResponse.json(
            {error: "Failed to delete monitor"},
            {status: 500}
        );
    }
}

