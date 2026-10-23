"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCard } from "@/components/lead-card";
import { LeadDetailContent } from "@/components/lead-detail-content";
import { cn } from "@/lib/utils";
import type { LeadWithAnalysis } from "@/lib/db/queries";

const COLUMNS: { stage: LeadWithAnalysis["stage"]; title: string }[] = [
  { stage: "new", title: "New Leads" },
  { stage: "qualified", title: "Qualified" },
];

// Highest priorityScore first; unanalyzed leads last.
function byScoreDesc(a: LeadWithAnalysis, b: LeadWithAnalysis) {
  return (b.analysis?.priorityScore ?? -1) - (a.analysis?.priorityScore ?? -1);
}

export function KanbanBoard({
  leads,
  header,
}: {
  leads: LeadWithAnalysis[];
  header?: ReactNode;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  // Keep showing the last selected lead while the panel animates closed.
  const [lastLead, setLastLead] = useState(selectedLead);
  if (selectedLead && selectedLead !== lastLead) setLastLead(selectedLead);
  const detailLead = selectedLead ?? lastLead;

  const isOpen = selectedLead !== null;

  return (
    <div className="flex">
      <div
        className={cn(
          "min-w-0 transition-[width] duration-300 ease-in-out",
          isOpen ? "w-1/2 pr-4" : "w-full",
        )}
      >
        {header}
        <div className="grid grid-cols-2 gap-4">
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
                    columnLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onSelect={setSelectedLeadId}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <aside
        inert={!isOpen}
        aria-hidden={!isOpen}
        aria-label="Lead details"
        className={cn(
          "overflow-hidden transition-[width] duration-300 ease-in-out",
          isOpen ? "w-1/2 border-l" : "w-0",
        )}
      >
        {/* Fixed-width inner box so content doesn't reflow while animating. */}
        <div className="relative min-w-72 pl-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close lead details"
            className="absolute top-0 right-0"
            onClick={() => setSelectedLeadId(null)}
          >
            <X />
          </Button>
          {detailLead && <LeadDetailContent lead={detailLead} />}
        </div>
      </aside>
    </div>
  );
}
