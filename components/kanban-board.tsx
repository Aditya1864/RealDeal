"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCard } from "@/components/lead-card";
import { LeadDetailContent } from "@/components/lead-detail-content";
import { missingAnalysisLabel } from "@/lib/analysis-status";
import { cn } from "@/lib/utils";
import type { LeadWithAnalysis } from "@/lib/db/queries";

// Hot / Warm / Cold hold leads that are still in the "new" stage, split by
// priority tag. Qualified holds every qualified lead, whatever its tag. A new
// lead with no analysis yet has no tag, so it waits at the bottom of Cold.
const COLUMNS: {
  key: string;
  title: string;
  dot: string;
  includes: (lead: LeadWithAnalysis) => boolean;
}[] = [
  {
    key: "hot",
    title: "Hot",
    dot: "bg-[#d9483b]",
    includes: (l) => l.stage === "new" && l.analysis?.priorityTag === "hot",
  },
  {
    key: "warm",
    title: "Warm",
    dot: "bg-[#c98a1b]",
    includes: (l) => l.stage === "new" && l.analysis?.priorityTag === "warm",
  },
  {
    key: "cold",
    title: "Cold",
    dot: "bg-[#3d6b94]",
    includes: (l) =>
      l.stage === "new" && (l.analysis?.priorityTag ?? "cold") === "cold",
  },
  {
    key: "qualified",
    title: "Qualified",
    dot: "bg-[#1f6e4d]",
    includes: (l) => l.stage === "qualified",
  },
];

// Highest priorityScore first; unanalyzed leads last.
function byScoreDesc(a: LeadWithAnalysis, b: LeadWithAnalysis) {
  return (b.analysis?.priorityScore ?? -1) - (a.analysis?.priorityScore ?? -1);
}

export function KanbanBoard({
  leads,
  header,
  initialLeadId = null,
}: {
  leads: LeadWithAnalysis[];
  header?: ReactNode;
  /** Lead to open on first render (from the `?open=` search param). */
  initialLeadId?: number | null;
}) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(
    initialLeadId,
  );

  // Analysis runs after a lead is created; refresh until it has landed.
  const hasAnalyzing = leads.some(
    (lead) =>
      !lead.analysis && missingAnalysisLabel(lead.createdAt) === "Analyzing…",
  );
  useEffect(() => {
    if (!hasAnalyzing) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [hasAnalyzing, router]);

  // Drop ?open= from the URL so a refresh doesn't reopen the panel.
  useEffect(() => {
    if (initialLeadId !== null) router.replace("/", { scroll: false });
  }, [initialLeadId, router]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  // Keep showing the last selected lead while the panel animates closed.
  const [lastLead, setLastLead] = useState(selectedLead);
  if (selectedLead && selectedLead !== lastLead) setLastLead(selectedLead);
  const detailLead = selectedLead ?? lastLead;

  const isOpen = selectedLead !== null;

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "scrollbar-thin h-full min-w-0 overflow-y-auto transition-[width] duration-300 ease-in-out",
          isOpen ? "w-1/2 pr-4" : "w-full",
        )}
      >
        {header}
        <div className="grid min-w-[36rem] grid-cols-4 gap-5">
          {COLUMNS.map(({ key, title, dot, includes }) => {
            const columnLeads = leads.filter(includes).sort(byScoreDesc);
            return (
              <section key={key}>
                <h2 className="mb-3 flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", dot)}
                  />
                  <span className="font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {columnLeads.length}{" "}
                    {columnLeads.length === 1 ? "lead" : "leads"}
                  </span>
                </h2>
                <div className="flex flex-col gap-2.5">
                  {columnLeads.length === 0 ? (
                    <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                      No leads
                    </p>
                  ) : (
                    columnLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        selected={lead.id === selectedLead?.id}
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
          "relative h-full overflow-hidden transition-[width] duration-300 ease-in-out",
          isOpen ? "w-1/2 border-l" : "w-0",
        )}
      >
        {/* Stays put while the content below scrolls. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close lead details"
          className="absolute top-0 right-4 z-10"
          onClick={() => setSelectedLeadId(null)}
        >
          <X />
        </Button>
        {/* Fixed-width inner box so content doesn't reflow while animating. */}
        <div className="scrollbar-thin h-full min-w-72 overflow-y-auto pl-4">
          {detailLead && <LeadDetailContent lead={detailLead} />}
        </div>
      </aside>
    </div>
  );
}
