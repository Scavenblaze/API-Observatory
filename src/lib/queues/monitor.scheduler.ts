import { monitorQueue } from "./monitor.queue";

const getSchedulerId = (monitorId: string): string => {
  return `monitor:${monitorId}`;
}

export async function scheduleMonitor(monitorId: string, intervalSeconds: number){
  if(!Number.isInteger(intervalSeconds) || intervalSeconds < 10){
    throw new Error("Monitor interval must be at least 10 seconds");
  }

  await monitorQueue.upsertJobScheduler(
    getSchedulerId(monitorId),
    {
      every: intervalSeconds * 1000
    },
    {
      name: "check-monitor",
      data: { monitorId }
    }
  );
}

export async function removeMonitorSchedule(monitorId: string) {
  const schedulerId = getSchedulerId(monitorId);
  const removed = await monitorQueue.removeJobScheduler(schedulerId);
  
  console.log(`Scheduler removal for ${monitorId}:`, removed ? "SUCCESS" : "NOT FOUND");
  return removed;
}