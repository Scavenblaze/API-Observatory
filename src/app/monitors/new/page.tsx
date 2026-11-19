import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import NewMonitorClient from "./new-monitor-client";

export default async function NewMonitorPage() {
  await requireAuthenticatedUser();

  return <NewMonitorClient />;
}
