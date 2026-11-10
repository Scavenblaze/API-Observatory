import type { CreateMonitorInput } from "@/lib/validators/monitor.schema";
import { prisma } from "@/lib/db";
import { removeMonitorSchedule, scheduleMonitor } from "../queues/monitor.scheduler";

export async function createMonitor(input: CreateMonitorInput){
  const monitor = await prisma.monitor.create({
    data: {
      name: input.name,
      url: input.url,
      method: input.method,
      intervalSeconds: input.intervalSeconds,
      timeoutMs: input.timeoutMs,
      expectedStatus: input.expectedStatus,
      latencyThresholdMs: input.latencyThresholdMs,
      enabled: input.enabled
    }
  });

  if(monitor.enabled){
    await scheduleMonitor(monitor.id, monitor.intervalSeconds);
  }
  return monitor;
}

export async function listMonitors(){
  return prisma.monitor.findMany({
    orderBy: {
      createdAt: "desc",
    }
  });
}

export async function getMonitorById(id: string){
  return prisma.monitor.findUnique({
    where: {id}
  });
}

export async function updateMonitor(id: string, data: Partial<CreateMonitorInput>){
  const monitor = await prisma.monitor.update({
    where: { id },
    data
  });

  if(monitor.enabled){
    await scheduleMonitor(monitor.id, monitor.intervalSeconds);
  }
  else{
    await removeMonitorSchedule(monitor.id);
  }
  return monitor;
}

export async function deleteMonitor(id: string){
  const monitor = await prisma.monitor.delete({
    where: { id }
  });
  await removeMonitorSchedule(id);
  return monitor;
}