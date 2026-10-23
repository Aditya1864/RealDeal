import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { getLeadsWithLatestAnalysis } from "@/lib/db/queries";

function PageHeader() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">RealDeal</h1>
      <Button asChild>
        <Link href="/leads/new">+ New Lead</Link>
      </Button>
    </header>
  );
}

// Same data as GET /api/leads, read directly on the server.
// The header is rendered inside the board's left pane so it moves with the
// board when the detail panel opens.
async function Board() {
  const leads = await getLeadsWithLatestAnalysis();
  return <KanbanBoard leads={leads} header={<PageHeader />} />;
}

export default function Home() {
  return (
    <main className="w-full px-6 py-8 lg:px-8">
      <Suspense
        fallback={
          <>
            <PageHeader />
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          </>
        }
      >
        <Board />
      </Suspense>
    </main>
  );
}
