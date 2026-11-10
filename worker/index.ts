import "dotenv/config";

import { closeMonitorWorker } from "./monitor.worker";

console.log("API Reliability Observatory worker started");

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if(shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Shutting down worker...`);

  try{
    await closeMonitorWorker();
    console.log("Worker shut down successfully");
    process.exit(0);
  } catch(error){
    console.error("Worker shutdown failed:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));