import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import IncidentDetailsClient from "./incident-details-client";

export default async function IncidentDetailsPage(){
  await requireAuthenticatedUser();

  return <IncidentDetailsClient />;
}
