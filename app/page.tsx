import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { getLeadsWithLatestAnalysis } from "@/lib/db/queries";

// Same data as GET /api/leads, read directly on the server.
async function Board() {
  const leads = await getLeadsWithLatestAnalysis();
  return <KanbanBoard leads={leads} />;
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RealDeal</h1>
        <Button asChild>
          <Link href="/leads/new">+ New Lead</Link>
        </Button>
      </header>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading leads…</p>}
      >
        <Board />
      </Suspense>
    </main>
  );
}
