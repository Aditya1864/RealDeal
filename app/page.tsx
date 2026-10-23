import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { getLeadsWithLatestAnalysis } from "@/lib/db/queries";

function PageHeader() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="font-serif text-2xl font-bold">RealDeal</h1>
      <Button
        asChild
        className="bg-indigo-700 font-semibold text-white hover:bg-indigo-800"
      >
        <Link href="/leads/new">
          <Plus />
          New lead
        </Link>
      </Button>
    </header>
  );
}

// Same data as GET /api/leads, read directly on the server.
// The header is rendered inside the board's left pane so it moves with the
// board when the detail panel opens.
async function Board({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const [leads, { open }] = await Promise.all([
    getLeadsWithLatestAnalysis(),
    searchParams,
  ]);
  const openId = Number(typeof open === "string" ? open : NaN);
  return (
    <KanbanBoard
      leads={leads}
      header={<PageHeader />}
      initialLeadId={Number.isInteger(openId) && openId > 0 ? openId : null}
    />
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <main className="h-dvh w-full overflow-hidden bg-[#f7f7f5] px-6 py-8 lg:px-8 dark:bg-background">
      <Suspense
        fallback={
          <>
            <PageHeader />
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          </>
        }
      >
        <Board searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
