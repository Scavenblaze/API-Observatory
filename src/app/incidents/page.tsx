import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import IncidentsClient from "./incidents-client";

export default async function IncidentsPage(){
  await requireAuthenticatedUser();

  return <IncidentsClient />;
}
