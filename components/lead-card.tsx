"use client";

import { PriorityBadge } from "@/components/priority-badge";
import { missingAnalysisLabel } from "@/lib/analysis-status";
import type { LeadWithAnalysis } from "@/lib/db/queries";

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
      <h3 className="truncate text-sm font-medium">{lead.name}</h3>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {lead.location}
      </p>
      <div className="mt-2">
        {lead.analysis ? (
          <PriorityBadge
            score={lead.analysis.priorityScore}
            tag={lead.analysis.priorityTag}
          />
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {missingAnalysisLabel(lead.createdAt)}
          </p>
        )}
      </div>
    </button>
  );
}
