"use client";

import { PriorityBadge } from "@/components/priority-badge";
import type { LeadWithAnalysis } from "@/lib/db/queries";

// Analysis runs synchronously on submit, so a lead without one that is this
// fresh is still being analyzed; an older one means the analysis failed.
const ANALYZING_WINDOW_MS = 2 * 60 * 1000;

function summaryText(lead: LeadWithAnalysis): string {
  if (lead.analysis) return lead.analysis.summary;
  const age = Date.now() - lead.createdAt.getTime();
  return age < ANALYZING_WINDOW_MS ? "Analyzing…" : "Analysis failed";
}

export function LeadCard({
  lead,
  onSelect,
}: {
  lead: LeadWithAnalysis;
  onSelect: (leadId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lead.id)}
      className="block w-full rounded-lg border bg-card p-3 text-left text-card-foreground transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-medium">{lead.name}</h3>
        {lead.analysis && (
          <PriorityBadge
            score={lead.analysis.priorityScore}
            tag={lead.analysis.priorityTag}
          />
        )}
      </div>
      <p
        className={
          lead.analysis
            ? "mt-1.5 line-clamp-1 text-sm text-muted-foreground"
            : "mt-1.5 line-clamp-1 text-sm italic text-muted-foreground"
        }
      >
        {summaryText(lead)}
      </p>
    </button>
  );
}
