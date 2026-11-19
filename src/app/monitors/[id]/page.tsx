
import { Suspense } from "react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import MonitorHealthChart from "@/components/charts/monitor-health-chart";
import MonitorOverview from "@/components/monitors/monitor-overview";

type Props = {
  params: Promise<{ id: string }>;
};

const MonitorDetailsContent = async ({ params }: Props) => {
  const { id } = await params;

  return(
    <main className="space-y-8 p-6">
      <MonitorOverview monitorId={id} />

      <section>
        <h2 className="mb-4 text-xl font-semibold">Health Charts</h2>
        <MonitorHealthChart monitorId={id} />
      </section>
    </main>
  );
};

export default async function MonitorDetailsPage({ params }: Props){
  await requireAuthenticatedUser();

  return(
    <Suspense fallback={<p className="p-6">Loading monitor...</p>}>
      <MonitorDetailsContent params={params} />
    </Suspense>
  );
}
