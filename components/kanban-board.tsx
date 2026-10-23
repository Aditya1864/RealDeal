import { LeadCard } from "@/components/lead-card";
import type { LeadWithAnalysis } from "@/lib/db/queries";

const COLUMNS: { stage: LeadWithAnalysis["stage"]; title: string }[] = [
  { stage: "new", title: "New Leads" },
  { stage: "qualified", title: "Qualified" },
];

// Highest priorityScore first; unanalyzed leads last.
function byScoreDesc(a: LeadWithAnalysis, b: LeadWithAnalysis) {
  return (b.analysis?.priorityScore ?? -1) - (a.analysis?.priorityScore ?? -1);
}

export function KanbanBoard({ leads }: { leads: LeadWithAnalysis[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {COLUMNS.map(({ stage, title }) => {
        const columnLeads = leads
          .filter((lead) => lead.stage === stage)
          .sort(byScoreDesc);
        return (
          <section key={stage} className="rounded-xl bg-muted/40 p-3">
            <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
              {title}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {columnLeads.length}
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {columnLeads.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  No leads
                </p>
              ) : (
                columnLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
