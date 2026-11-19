import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import MonitorsClient from "./monitors-client";

export default async function MonitorsPage(){
  await requireAuthenticatedUser();

  return <MonitorsClient />;
}
