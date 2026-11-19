import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import EditMonitorClient from "./edit-monitor-client";

export default async function EditMonitorPage(){
  await requireAuthenticatedUser();

  return <EditMonitorClient />;
}
