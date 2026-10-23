import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetailContent } from "@/components/lead-detail-content";
import { getLeadById } from "@/lib/db/queries";

async function LeadDetail({
  params,
}: Pick<PageProps<"/leads/[id]">, "params">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const lead = await getLeadById(id);
  if (!lead) notFound();

  return <LeadDetailContent lead={lead} />;
}

// Full-page version of the board's detail panel, for direct links.
export default function LeadDetailPage(props: PageProps<"/leads/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to board
      </Link>
      <h1 className="sr-only">Lead detail</h1>
      <div className="mt-4">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <LeadDetail params={props.params} />
        </Suspense>
      </div>
    </main>
  );
}
