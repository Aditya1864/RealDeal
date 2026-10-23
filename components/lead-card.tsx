"use client";

import {
  PriorityBadge,
  QUALIFIED_STYLE,
  TAG_STYLES,
} from "@/components/priority-badge";
import { missingAnalysisLabel } from "@/lib/analysis-status";
import { cn } from "@/lib/utils";
import type { LeadWithAnalysis } from "@/lib/db/queries";

export function LeadCard({
  lead,
  selected,
  onSelect,
}: {
  lead: LeadWithAnalysis;
  selected: boolean;
  onSelect: (leadId: number) => void;
}) {
  const qualified = lead.stage === "qualified";
  const style = qualified
    ? QUALIFIED_STYLE
    : lead.analysis
      ? TAG_STYLES[lead.analysis.priorityTag]
      : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(lead.id)}
      className={cn(
        "block w-full rounded-lg border-l-[3px] bg-card px-3.5 py-3 text-left text-card-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        style?.accent ?? "border-l-muted-foreground/30",
        selected && style
          ? style.selected
          : "ring-1 ring-black/5 dark:ring-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-[13px] font-semibold">{lead.name}</h3>
        {lead.analysis && (
          <PriorityBadge
            score={lead.analysis.priorityScore}
            tag={lead.analysis.priorityTag}
            qualified={qualified}
          />
        )}
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {lead.location}
      </p>
      {!lead.analysis && (
        <p className="mt-1 text-xs italic text-muted-foreground">
          {missingAnalysisLabel(lead.createdAt)}
        </p>
      )}
    </button>
  );
}
